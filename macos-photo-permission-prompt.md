### 🧠 Context

We’re working on the macOS Electron app for **Slideshow Buddy**.

I am building an **unsigned local macOS app** using electron-builder (e.g. `npm run build:mac:unsigned`), and then opening:

`electron/dist/mac-arm64/Slideshow Buddy.app`

On startup, the app now crashes with:

> Error: ENOENT: no such file or directory, open '/Users/.../Slideshow Buddy.app/Contents/Resources/app-update.yml'

This is coming from the Electron auto-update / `electron-updater` logic that expects an `app-update.yml` file in the `Contents/Resources` folder, which is normally created when publishing builds.

For now, I **do not want any auto-update logic for local builds**. I just need the app to launch so I can test Photos permission and other features. Auto-update can be re-enabled later for real signed, published builds.

---

### 🎯 Task

Please:

1. **Find where auto-updates are initialized** in the Electron main process.

   * This is likely where `autoUpdater` from `electron-updater` is imported and used.
   * It may be in `electron/src/index.ts` or another main-process file.

2. **Guard all auto-update initialization / usage** so that it does *not* run in my current local unsigned builds.

   Specifically:

   * For now, it’s fine to completely skip auto-update logic when:

     * the app is not published / no update URL is configured, or
     * we’re in a dev-like scenario, or
     * we’re running the unsigned local mac build from `dist/mac*`.
   * A simple, explicit condition like
     `if (!app.isPackaged) { /* skip autoUpdater entirely */ }`
     is okay, but feel free to add a slightly more robust guard if appropriate.
   * The important part: whatever is trying to read or require `app-update.yml` on startup should **not run at all** in my current workflow.

3. Make sure:

   * The app can start **without** `app-update.yml` being present.
   * No `ENOENT` is thrown if `app-update.yml` does not exist.
   * Auto-update logic remains intact for future real production builds, but is cleanly bypassed for now.

4. Do **not**:

   * Add dummy `app-update.yml` files manually in `dist`.
   * Put hard-coded file operations against `app-update.yml` that assume it exists.
   * Remove `electron-updater` entirely; just guard it.

---

### ✅ Expected result

After your changes:

* When I build and run the macOS app from `electron/dist/mac-arm64/Slideshow Buddy.app`, it should:

  * Launch without crashing.
  * Not try to read `app-update.yml`.
  * Not attempt to check for or download updates.
* Auto-updates should be effectively **disabled** for my current unsigned local builds, but the code should be easy to re-enable for real production builds later.

Please list:

* The files you modified.
* The conditions you use to skip autoUpdater.
* Any environment variables or flags I might need to set (if you add any).
