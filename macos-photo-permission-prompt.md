### 🧠 Context

We’re working on the macOS Electron app for **Slideshow Buddy**.

We recently moved the blocking Swift Photos permission call into a **Node.js Worker Thread**. The flow is:

* Renderer → `window.electron.photos.requestPermission()`
* IPC to main: `'photos:requestPermission'`
* Main → `Photos Worker Manager` → worker thread
* Worker imports and uses `PhotosLibraryFFI` to call the Swift `.dylib`

When I click the Photos permission test button in the **packaged app**, the logs from the main process show:

```text
[Photos Worker Manager] Sending request to worker: { id: 'req_1_...', type: 'requestPermission' }
[Photos Worker Manager] Request sent, waiting for response...
[Photos Worker Manager] ✗✗✗ Worker error: TypeError [Error]: Not running in an Electron environment!
    at Object.<anonymous> (.../node_modules/electron-is-dev/index.js:5:8)
    ...
    at Object.<anonymous> (.../build/src/native/PhotosLibraryFFI.js:21:51)
...
[Photos Worker Manager] Rejecting pending request ... due to worker error
[MAIN-PROCESS-IPC] ⚠️  Exception caught in IPC handler
[MAIN-PROCESS-IPC] Error: Error: Worker error: Not running in an Electron environment!
```

So the worker never reaches the Swift Photos permission call. It crashes as soon as it tries to load `PhotosLibraryFFI`, because that file depends on `electron-is-dev`, which throws when not running in a “real” Electron context.

### Goal

Make the Photos FFI and worker thread **not depend on `electron-is-dev` at all**, and use a worker-safe, environment-safe way to determine:

* dev vs packaged (for library path resolution)
* without assuming `process.type` or other Electron-only globals

Also, make sure that when the worker fails, the renderer actually sees an error instead of “nothing happens”.

---

### 🎯 Task

Please do the following, with minimal structural changes:

---

#### (1) Find all usages of `electron-is-dev`

Search the project (especially the Electron side) for:

* `electron-is-dev`
* `isDev` constants derived from it

Most important: the usage inside the Photos-related code:

* `electron/src/native/PhotosLibraryFFI.ts` (or the compiled JS version `build/src/native/PhotosLibraryFFI.js`)
* Any worker files that import that module

---

#### (2) Remove `electron-is-dev` from Photos FFI and the worker path

The worker thread is just a **Node.js worker**, not an Electron main process, so `electron-is-dev` is not appropriate there.

Please:

* Remove any `import isDev from 'electron-is-dev'` (or similar) from `PhotosLibraryFFI` and from any worker files.

* Instead, implement a **simple, worker-safe dev/prod detection**, for example:

  > **Use this as a reference pattern only; adapt it to the project’s existing style and logic.**

  ```ts
  const isDev =
    process.env.NODE_ENV === 'development' ||
    process.env.SLIDESHOW_BUDDY_ENV === 'development';
  ```

* We can then:

  * Set `NODE_ENV` or `SLIDESHOW_BUDDY_ENV` appropriately from the main process or build scripts.
  * Or, if you prefer, base dev vs prod on something like `process.env.ELECTRON_RUN_AS_NODE` / `app.isPackaged` (but anything Electron-specific must not run inside the worker).

The key rule:

> **PhotosLibraryFFI must not import or rely on `electron-is-dev`, especially when used inside a Worker.**

---

#### (3) Adjust PhotosLibraryFFI path resolution to work in both dev and prod without Electron-specific checks

In `PhotosLibraryFFI` (TS source):

* Update the logic that resolves the path to `libPhotosLibraryBridge.dylib` so that it does **not** rely on `electron-is-dev`.
* Use a combination of:

  * `process.resourcesPath` (for the packaged app)
  * a reasonable dev path (e.g. relative to the project root / `__dirname` / `path.resolve`), guarded by `isDev`.

Make sure this logic is **pure Node**:

* No imports from `electron` (`app`, `BrowserWindow`, etc.) inside `PhotosLibraryFFI`.
* No reads of `process.type` that assume Electron main/renderer.

If you need Electron-specific information (e.g. `app.isPackaged`), that should be handled in the main process and passed into the worker via:

* `workerData`
* or an environment variable

But ideally, `PhotosLibraryFFI` should be able to decide based on `process.env.NODE_ENV` and `process.resourcesPath`.

---

#### (4) Make the worker initialization use the updated PhotosLibraryFFI

In the Photos permission worker (e.g. `electron/src/workers/photosPermissionWorker.ts`):

* Ensure you import `PhotosLibraryFFI` without pulling in any Electron-only modules.
* If necessary, pass a simple env flag into the worker via `workerData` or process.env so that `PhotosLibraryFFI` can correctly detect dev vs prod without `electron-is-dev`.

Confirm that:

* The worker can require/import `PhotosLibraryFFI` successfully in the packaged app.
* No “Not running in an Electron environment!” errors are thrown.

---

#### (5) Make sure the renderer sees errors

In the IPC handler for `'photos:requestPermission'`:

* You already log the error and stack in the main process (good).
* Ensure the handler **returns a structured error back to the renderer**, not just throws and leaves the renderer hanging.

For example (conceptually):

* If the worker fails, the IPC handler should resolve to something like:

  ```ts
  { success: false, error: 'Worker error: ...' }
  ```

* Then, in the renderer, where `window.electron.photos.requestPermission()` is called, make sure you:

  * Handle the error case
  * Log it or show a toast / message

You don’t have to add UI right now, but at least ensure the Promise rejects or returns a meaningful result so the renderer isn’t “doing nothing”.

---

#### (6) Don’t change the Swift bridge or PhotoKit logic here

For this task:

* **Do not** modify the Swift code (`PhotosPermissionManager.swift`, `PhotosLibraryBridge.swift`, etc.).
* **Do not** change how the Swift permission API works.
* We’re only fixing:

  * The worker’s ability to load `PhotosLibraryFFI` without `electron-is-dev`, and
  * Error propagation back to the renderer.

---

### ✅ Expected outcome

After your changes, when I:

```bash
cd electron
npm run build:swift
npm run build:ts
npm run build:mac:unsigned
cd dist/mac-arm64/Slideshow\ Buddy.app/Contents/MacOS
./"Slideshow Buddy"
```

and click the Photos permission test button:

* The worker thread should start successfully and load `PhotosLibraryFFI` without throwing `Not running in an Electron environment!`.
* The main process logs should show:

  * Worker request sent
  * Worker response received (either permission granted/denied or some other error)
* The renderer should receive a response (or rejected Promise), not silently do nothing.

Please summarize:

1. All files where you removed `electron-is-dev` usage.
2. How `isDev` / dev vs prod is now detected in `PhotosLibraryFFI`.
3. How the worker is now initialized so it can safely use `PhotosLibraryFFI` in the packaged app.
4. How errors from the worker are propagated back to the renderer.