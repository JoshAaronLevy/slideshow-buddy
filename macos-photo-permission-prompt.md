## **Context (Important — read this first)**

We are working on the macOS (Electron + React + Swift FFI) version of **Slideshow Buddy**.
This version uses a Swift `.dylib` bridged via koffi to Electron so the app can access the user's macOS Photos library.

### The goal:

Get the **macOS Photos permission dialog** to reliably appear when the app explicitly requests permission.

### The issue:

Even though the Swift bridge, FFI, Info.plist keys, and entitlements are defined in the project, **no permission dialog appears at runtime**. The iOS version works fine — the macOS version does not.

We believe one or more of the following are happening:

* The Swift FFI function `photos_request_permission` may **not be getting called** from the renderer → IPC → main → FFI path.
* The packaged `.app` may not be receiving the required Info.plist keys or entitlements at build time.
* The call to `requestPermission()` may accidentally be running in dev mode instead of the packaged `.app`.
* The Swift bridge may freeze or silently fail before making the actual `PHPhotoLibrary.requestAuthorization` call.
* The permission request may need clearer logs at each stage so we can track where the call flow stops.

### What this task is focused on:

**Do NOT redesign the architecture or move to worker threads or async Swift redesigns.**
This task’s ONLY focus is:

1. Ensuring that the FFI permission request **is actually being triggered**
2. Adding the minimal logging required to trace the flow
3. Adding a simple, obvious **test button** in the UI that calls the requestPermission path explicitly
4. Verifying Swift logging is visible in the Electron console or macOS Console
5. Ensuring the packaged `.app` includes Info.plist and entitlements correctly
6. Making sure that calling the request function does *not* freeze the app (i.e., it must only happen from an explicit user action)

This will allow us to properly test the real packaged app — not the dev server — and finally observe what TCC is doing.

---

# **Task (What I want Copilot to do)**

### Please perform the following steps **without making large structural changes**, and without guessing new architectural approaches:

---

### **(1) Add a temporary “Test Photos Permission” button in the React UI**

* Place it somewhere simple and guaranteed to render (a debug panel, modal, or temporary test screen — your choice).
* The button should clearly trigger the existing `window.electron.photos.requestPermission()` call path.
* It should log the result and any errors to the browser console.
* No styling necessary — this is for debugging only.

---

### **(2) Add clear logging at every step of the request flow**

Specifically ensure logs are added in:

1. **Renderer**

   * Before calling `window.electron.photos.requestPermission()`
   * After receiving the IPC response

2. **Preload**

   * When forwarding the IPC invoke call

3. **Electron main process**

   * When entering IPC handler
   * Before calling the FFI bridge
   * After receiving value from FFI

4. **TypeScript FFI wrapper (PhotosLibraryFFI.ts)**

   * When calling into the Swift function
   * When returning the result

5. **Swift bridge (PhotosLibraryBridge.swift / PhotosPermissionManager.swift)**

   * At the very beginning of `photos_request_permission`
   * Before calling `PHPhotoLibrary.requestAuthorization`
   * Inside authorization callback with the status returned
   * Before returning control back up the chain

These can be `console.log` in TS or `NSLog` in Swift.
**Do not alter the logic — only add logs.**

---

### **(3) Verify and fix the Swift dylib export if necessary**

* Ensure the Swift function names exported via `@_cdecl` **match the signatures Copilot finds in the koffi bindings**.
* If mismatched names or calling conventions exist, fix them.
* Do NOT convert the code to async Swift or change the semaphore design — we only want visibility + correctness for now.

---

### **(4) Ensure the packaged macOS build receives the required Info.plist and entitlements**

Copilot should inspect:

* `electron-builder.config.json`
* `entitlements.mac.plist`
* The output of the build process scripts

If something is misconfigured (wrong filename path, not copied, wrong plist key name, incorrect bundle ID, etc.), Copilot should:

* Identify exactly what is wrong
* Update the config so that the packaged `.app` includes:

  * `NSPhotoLibraryUsageDescription`
  * `com.apple.security.assets.photos.read-only`
  * `com.apple.security.app-sandbox`

This should **not** alter any signing configuration beyond what is necessary for debug builds.

---

### **(5) Confirm that the test path can be triggered only from user action**

* Ensure no automatic permission check runs on app startup.
* The only path that calls `requestPermission()` must be the new test button.
* This prevents freezes and ensures correctness.

---

### **(6) Report back**

After making all changes, Copilot should:

* Summarize where the permission-request flow begins and ends
* Confirm that logs appear in all the correct places
* Confirm that the `.app` bundle will include the correct Info.plist/entitlement values
* Identify any additional issues it notices

---

# **Important Requirements / Guardrails**

* **Do NOT implement worker threads or major redesigns.**
* **Do NOT modify Swift or TS code beyond adding logs or fixing symbol mismatches.**
* **Do NOT remove or rewrite the Swift semaphore mechanism yet.**
* **Do NOT restructure IPC flow or rename functions unless they’re mismatched.**
* **Do NOT assume dev mode — test flow must be tied to packaged `.app`.**

The goal is **pure visibility + correctness**, nothing more.

---

# **Your output should be:**

* A list of the exact files you will modify
* A description of the changes in each file
* The minimal code additions (logs, buttons, config fixes) necessary to support testing
* A confirmation that the packaged `.app` will now correctly request Photos permission once the test button is clicked

---

If anything about the request is unclear, ask me before making changes.