### 🧠 Context

We’re working on the macOS Electron app for **Slideshow Buddy**.

We have a Swift `.dylib` (`libPhotosLibraryBridge.dylib`) that provides Photos library access via koffi FFI. The bridge exposes a C-callable function like `photos_request_permission` which internally:

* Uses `PHPhotoLibrary.requestAuthorization` (async)
* Wraps it in a `DispatchSemaphore`
* Calls `semaphore.wait()` and doesn’t return until the async call completes

On the TypeScript side, we have a `PhotosLibraryFFI` class in `electron/src/native/PhotosLibraryFFI.ts` that calls this function synchronously (from Node’s perspective) and wraps it in a Promise.

The renderer UI (React) has a **Photos permission test button** that ultimately calls:

* `window.electron.photos.requestPermission()`
* → IPC
* → Electron main process
* → `photosLibraryFFI.requestPermission()`
* → Swift `photos_request_permission` (blocking)

When I run the **packaged macOS app** and click the Photos permission test button:

* The macOS cursor turns into the spinner
* The app becomes unresponsive
* I have to force quit

This is because the **Electron main process** is calling the blocking Swift function directly, and the semaphore is blocking the main Node event loop.

### Goal

**Do NOT change the Swift bridge right now.**
Instead, move all **blocking Photos library calls** off the Electron main thread and into a **Node.js Worker Thread**, while keeping the renderer API unchanged:

* Renderer still calls `window.electron.photos.requestPermission()`
* IPC in main still uses something like `ipcMain.handle('photos:requestPermission', …)`
* But inside main, instead of calling `photosLibraryFFI.requestPermission()` directly on the main thread, we should forward the request to a worker thread that loads `PhotosLibraryFFI` and runs the blocking call there.

This way:

* The worker thread can block on the Swift semaphore
* The Electron main process stays responsive
* The renderer still gets a Promise-based API

---

### 🎯 Task

Please implement a **worker-thread-based Photos permission service** and integrate it with the existing IPC + FFI flow, with minimal disruption to the rest of the code.

#### (1) Create a dedicated worker for Photos FFI

Create a new file in the Electron side, something like:

* `electron/src/workers/photosPermissionWorker.ts` (or similar)

The worker should:

* Use `worker_threads` (`parentPort`, `parentPort.on('message', …)`, etc.)
* Import and initialize the existing `PhotosLibraryFFI` (or a minimal subset of it)
* Handle at least these message types:

  * `requestPermission`
  * `checkPermission`
* For each message:

  * Call the corresponding `PhotosLibraryFFI` method (which will block due to the Swift semaphore)
  * Send a response back to the parent with:

    * a correlation ID from the message
    * `success` / `error`
    * any payload (`hasPermission`, etc.)

This worker is allowed to block on the Swift call, because it runs on its own thread.

> You can treat this structure as a reference pattern; adapt it to the repo’s existing style and build setup.

#### (2) Add a small “PhotosWorkerManager” in the Electron main process

In the main process (likely `electron/src/index.ts`), add a small manager that:

* Lazily creates the worker thread on first use:

  * Uses `new Worker(...)` from `worker_threads`
  * Points at the compiled JS worker file path (be mindful of dev vs prod paths)
* Maintains a map of **pending requests** keyed by correlation ID:

  * When sending a message to the worker, generate a unique ID
  * Store a `resolve` / `reject` pair in a map keyed by that ID
  * When the worker responds, look up the ID and resolve/reject the matching Promise
* Exposes two async functions to the rest of the main process:

  * `photosWorkerRequestPermission(): Promise<boolean>`
  * `photosWorkerCheckPermission(): Promise<boolean>`

These functions:

* Ensure the worker exists
* Send a message (`{ id, type: 'requestPermission' }` or `'checkPermission'`)
* Return a Promise that resolves when the response message arrives

#### (3) Wire IPC handlers to call the worker instead of direct FFI

Update the existing IPC handlers in `electron/src/index.ts` (or wherever they live):

* For `'photos:checkPermission'` and `'photos:requestPermission'`:

  * **Do not** call `photosLibraryFFI.checkPermission()` or `.requestPermission()` directly on the main thread anymore.
  * Instead, call the new worker manager functions:

    * `const hasPermission = await photosWorkerCheckPermission()`
    * `const hasPermission = await photosWorkerRequestPermission()`

* Return the same shape you were already using (e.g. `{ success: true, hasPermission }`) so the renderer code does **not** need to change.

#### (4) Keep the renderer API unchanged

Do **not** change:

* `window.electron.photos.requestPermission`
* `window.electron.photos.checkPermission`
* The `PhotoService` in the React app that calls them

The whole point is for the renderer to continue working as-is, but the heavy work moves off the main thread.

#### (5) Logging and safety

Add a bit of logging (not too noisy) in:

* The worker (when it starts, when it receives messages, when it sends responses)
* The main process manager (when it spawns the worker, when it sends/receives messages)

Add basic error handling:

* If the worker throws or exits:

  * Log a clear error
  * Reject any in-flight Promises with a meaningful message
  * Optionally allow the manager to recreate the worker on the next request

#### (6) Don’t over-refactor

Please **do not**:

* Rewrite the Swift bridge
* Change the `PhotosLibraryFFI` public API
* Change the renderer UI or IPC contract
* Introduce other architectural changes beyond the worker

Focus only on:

* Creating the worker
* Adding a manager in main
* Switching IPC handlers to go through that worker

---

### ✅ Expected Outcome

After your changes:

* The app should launch normally from the packaged `.app`.
* Clicking the Photos permission test button in Settings should:

  * **Not freeze** the app or show the macOS spinner forever.
  * Trigger the worker-thread FFI call.
  * Eventually resolve (either with `hasPermission = true/false` or an error).
* The renderer should still use the same `window.electron.photos.requestPermission()` API.

Please summarize for me:

1. The new worker file you added and what it does.
2. The changes in the Electron main process (which file, what functions).
3. How dev vs prod paths to the worker are handled.
4. Any scripts or build steps I need to run to ensure the worker is included in the final macOS app.
