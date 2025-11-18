### 🧠 Context

We’re working on the macOS Electron app for **Slideshow Buddy**.

* The app has a **Photos permission test button** in the UI.
* When I click it in the packaged macOS app, the OS prompts:

> “Slideshow Buddy would like to access files in your Desktop folder”

This is **not** what we want.

What we want:

* The standard **Photos Library** permission dialog, like on iOS/macOS Photos apps:

  * “Slideshow Buddy would like to access your photos”
* This dialog is controlled by **PhotoKit’s `PHPhotoLibrary`** +

  * `NSPhotoLibraryUsageDescription` (Info.plist)
  * `com.apple.security.assets.photos.read-only` entitlement (which we already have configured)

We **do not** want to access the Desktop folder, Documents, or generic filesystem paths as part of this permission request. We only want to request permission to the user’s **Apple Photos library** (the iCloud-synced library visible in the Photos app / `Photos Library.photoslibrary`), via PhotoKit.

The current behavior (Desktop prompt) suggests that:

* Either the test button is calling a file-based import flow (NSOpenPanel, Electron `dialog.showOpenDialog`, or something that touches `~/Desktop`), **or**
* The Swift Photos manager is trying to access the Photos Library via filesystem path (`~/Pictures/Photos Library.photoslibrary`) or other file operations before/while calling PhotoKit.

For this task, I want to strictly **separate “Photos permission via PhotoKit” from any “filesystem-based import” logic.**

---

### 🎯 Task

Please inspect and adjust the Photos permission flow so that:

> Clicking the Photos permission test button only triggers a **PhotoKit-based permission request** via `PHPhotoLibrary`, and does **not** cause Desktop/file/folder access prompts.

#### (1) Inspect Swift Photos permission code

Look at the Swift files related to Photos / permission, for example:

* `electron/src/native/PhotosPermissionManager.swift`
* `electron/src/native/PhotosLibraryBridge.swift`
* Any other Swift code involved in `requestPermission` / `checkPermission`

I need you to:

1. Find the method that implements the “request Photos permission” logic that’s ultimately called by the FFI function (e.g. `photos_request_permission`).
2. Verify **exactly** what it’s doing:

   * It should ideally be using **only**:

     * `PHPhotoLibrary.authorizationStatus(for: .readWrite)` (or `.readOnly` / default)
     * `PHPhotoLibrary.requestAuthorization(for: .readWrite)` (or equivalent)
   * It should **not**:

     * Use `FileManager` or `NSFileManager` to inspect paths like `~/Desktop`, `~/Pictures`, or the Photos Library bundle.
     * Open or probe files/directories on the filesystem as part of “checking permission”.
     * Use `NSOpenPanel` / `NSSavePanel` / Electron’s `dialog.showOpenDialog` to drive permission.

If there is *any* filesystem or NSOpenPanel logic inside the permission code path, please refactor so that:

* The **permission check and request** functions are **pure PhotoKit** – no file access at all.

You can keep any filesystem-based “browse-and-import” logic elsewhere, but it must not run when the button is testing **Photos permission**.

> You may use small Swift snippets as reference, but please integrate with the existing structure instead of rewriting everything.

---

#### (2) Ensure the permission flow is PhotoKit-only

Update the Swift permission manager so that the logic is essentially:

* **Check permission:**

  * Use `PHPhotoLibrary.authorizationStatus` (or `authorizationStatus(for: .readWrite)`) to return:

    * `authorized` or `limited` → treat as allowed
    * `notDetermined` → treat as not yet requested
    * `denied` / `restricted` → treat as denied

* **Request permission:**

  * If status is already `authorized` or `limited`, just return success.
  * Otherwise, call **only** `PHPhotoLibrary.requestAuthorization` (or the `for: .readWrite` variant), and resolve based on the new status.
  * Do **not** touch any file paths or libraries on disk as part of this.

You can use async/continuation or completion handlers, but keep the API compatible with the existing FFI bridge (we already moved the blocking call into a worker thread, so the semaphore-based approach can stay for now).

---

#### (3) Confirm the FFI bridge is calling the PhotoKit path (not file-import)

In `PhotosLibraryBridge.swift` and `PhotosPermissionManager.swift`:

* Make sure the function exposed via `@_cdecl("photos_request_permission")` (or similar) calls **only** the PhotoKit-based permission logic.
* It must **not** call any functions that:

  * open NSOpenPanel,
  * walk filesystem directories,
  * directly access the Photos Library `.photoslibrary` bundle via path.

If needed, split logic so that:

* One function is **“PhotoKit permission only”**
* A separate function (not used by the test button) handles “browse-and-import via file picker”.

---

#### (4) Verify the JS/TS side is not mixing file-import calls

On the JS/TS side, please:

1. Locate the **Photos permission test button handler** in the renderer (React), likely in:

   * `src/services/PhotoService.ts`
   * A settings or debug component where the button lives.

2. Confirm that this test button:

   * Calls only `window.electron.photos.requestPermission()`.
   * That IPC handler should map to `'photos:requestPermission'` in the Electron main process.
   * That handler should now call the worker-based function that ultimately triggers the **Swift PhotoKit permission request**, and nothing else.

3. Confirm it does **not**:

   * Call any “browse photos” functions.
   * Trigger Electron `dialog.showOpenDialog` / NSOpenPanel.
   * Touch Desktop or other directories.

---

#### (5) Logging / sanity checks

Add or verify the existing logs so that when I click the Photos permission test button, I can see:

* In the renderer console:

  * A log like: `[Photos Permission Test] Invoking photos.requestPermission`
* In the main process logs:

  * A log when the IPC handler for `'photos:requestPermission'` runs
  * A log when the worker request is sent and when it resolves
* In the Swift logs:

  * A log like `[Swift PhotosPermissionManager] requestPermission() called (PhotoKit only)`
  * A log when `PHPhotoLibrary.authorizationStatus` / `requestAuthorization` returns a status

This will help ensure the code path is exactly what we expect.

---

#### (6) Do **not** change Info.plist or entitlements for this task

We already have:

* `NSPhotoLibraryUsageDescription` in Info.plist
* `com.apple.security.assets.photos.read-only` in entitlements

Please **do not** modify these in this task. Focus only on:

* Ensuring the permission code calls PhotoKit properly.
* Ensuring the test button path does not touch the filesystem.

---

### ✅ Expected outcome

After your changes:

* When I build and run the packaged macOS app and click the Photos permission test button:

  * I should **not** see a prompt about the Desktop folder.
  * Instead, if permissions haven’t been granted yet, I should see the **Photos Library** permission dialog.
  * If permission has already been granted/denied, the call should resolve accordingly without any Desktop prompt.

Please summarize:

1. Which Swift files you modified and what changed in the permission logic.
2. Which JS/TS files you verified/updated to ensure the test button only calls the PhotoKit permission path.
3. Any logs I should look for to confirm the PhotoKit flow is being hit.
