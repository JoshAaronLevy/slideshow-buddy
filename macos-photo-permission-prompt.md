### 🧠 Context

We’re working on the macOS Electron app for **Slideshow Buddy**. We have a Swift dynamic library `libPhotosLibraryBridge.dylib` that’s used via koffi FFI to access the Photos library.

In **dev**, the FFI bridge can load the Swift dylib successfully.

In the **packaged macOS app** (`Slideshow Buddy.app` under `electron/dist/mac-arm64/`), the app immediately crashes on startup with:

> PhotosLibraryError: Failed to load Swift Photos library: Failed to load shared library: dlopen(.../Slideshow Buddy.app/Contents/Resources/app.asar/assets/libPhotosLibraryBridge.dylib, 0x0006): tried: '.../app.asar/assets/libPhotosLibraryBridge.dylib' (errno=20)

This tells us:

* The FFI loader is trying to load the dylib from a path inside `app.asar` (e.g. `app.asar/assets/...`).
* `app.asar` is a file, not a directory, so `dlopen` fails with `errno=20` ("Not a directory").
* Native binaries like `.dylib` must **not** be loaded from inside the asar — they need to live in `Contents/Resources` (outside the asar) and be loaded using `process.resourcesPath`.

The goal of this task is **only** to fix how the Swift dylib is packaged and located at runtime in the macOS build so the app can start and the Photos bridge can load. We are *not* changing the Photos permissions logic in this task.

---

### 🎯 Task – Fix dylib packaging and loading (no big refactors)

Please do the following, focusing only on what’s necessary to make `libPhotosLibraryBridge.dylib` load correctly in the packaged macOS app:

---

#### (1) Inspect how `libPhotosLibraryBridge.dylib` is currently loaded

* Open `electron/src/native/PhotosLibraryFFI.ts` (or the equivalent file where the koffi interface is initialized).
* Find where it computes the path(s) to `libPhotosLibraryBridge.dylib`.
* Identify:

  * What path it uses in **dev**.
  * What path it uses in **production** (packaged app).
* Right now, the error shows it’s using something that resolves to:

  * `.../Contents/Resources/app.asar/assets/libPhotosLibraryBridge.dylib`
    which is incorrect for a packaged app.

---

#### (2) Adjust runtime path resolution for the dylib

We want the code to:

* In **dev**:

  * Continue to load from the existing path where `build-swift.sh` drops the dylib (probably under `electron/assets`).
* In **packaged macOS**:

  * Load from **`process.resourcesPath`**, e.g.:

    * `path.join(process.resourcesPath, 'assets', 'libPhotosLibraryBridge.dylib')`

Please:

* Implement robust logic in `PhotosLibraryFFI` that:

  * Detects whether it’s running in a packaged build vs dev.
  * Constructs a list of candidate paths to the dylib.
  * Checks them (e.g. with `fs.existsSync`), logs which one is used, and throws a meaningful error if none are found.
* Keep the code style consistent with the existing file.
* You can use small reference snippets, but please integrate with the existing patterns instead of rewriting the whole module.

---

#### (3) Ensure electron-builder actually copies the dylib into the right place

Open the Electron Builder config (`electron/electron-builder.config.*` – JSON or JS) and:

* Confirm that `libPhotosLibraryBridge.dylib` is being copied into `Contents/Resources/assets` in the packaged app.

* If it isn’t:

  * Add an **`extraResources`** entry (or similar) so that when we build for macOS, the dylib is included under `Resources/assets/`.

  * The intent is: after building, we should have something like:

    * `Slideshow Buddy.app/Contents/Resources/assets/libPhotosLibraryBridge.dylib`

* Ensure this configuration works for the `mac` / `mac-arm64` build target we’re using (e.g. `npm run build:mac:unsigned` or similar).

* Do **not** put the `.dylib` in `app.asar`. It must be in `Contents/Resources` (outside asar) where `process.resourcesPath` points.

---

#### (4) Do not over-refactor

Please **do not**:

* Change the overall architecture of the FFI bridge.
* Introduce worker threads, native addons, or other significant new abstractions.
* Rename the dylib file or change its build output location without also updating the Swift build script and all references.
* Touch the Photos permission logic, IPC handlers, or React UI beyond what’s absolutely required to fix dylib loading.

This task is strictly about:

* Correctly packaging the Swift dylib into the macOS app.
* Correctly resolving and loading its path at runtime in both dev and packaged modes.

---

#### (5) Add minimal logging

Add a few targeted logs (not too noisy) to the FFI loader to help diagnose future path issues:

* Log all candidate paths being tried.
* Log which path successfully loads (or that none could be loaded).
* Make sure the error message we saw originally gets replaced by something that clearly says:

  * Which paths were tried.
  * That the dylib could not be found or opened.

---

### 📋 Expected output

After you make these changes, please summarize:

1. Which files you modified.
2. Where the dylib is expected to live in:

   * Dev mode
   * Packaged macOS app
3. The logic now used to locate and load `libPhotosLibraryBridge.dylib` at runtime.
4. Any additional steps I need to run (e.g. `npm run build:swift`, `npm run build:mac:unsigned`) to test this in the packaged app.
