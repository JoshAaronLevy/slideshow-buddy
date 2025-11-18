### 🧠 Context

I’m working on the Electron/macOS wrapper for Slideshow Buddy.

* TypeScript compiles to `build/`.

  * I have confirmed that `build/src/index.js` exists after running `npm run build:ts`.

* My build script is:

  ```jsonc
  "build": "npm run build:swift && npm run build:ts",
  "build:mac:unsigned": "npm run build && electron-builder --mac --publish never --config.mac.identity=null"
  ```

* When I run `npm run build:mac:unsigned`, electron-builder fails with:

  > Application entry file "build/src/index.js" in the ".../dist/mac-arm64/slideshow-buddy.app/Contents/Resources/app.asar" does not exist. Seems like a wrong configuration.

So:

* `build/src/index.js` exists **on disk** in the `electron` folder.
* But that file is **not present inside app.asar** at the path electron-builder expects.

This means my electron-builder configuration (and/or package.json `"main"`) is not aligned with the actual TypeScript output.

---

### 🎯 Task

Please inspect and fix the configuration so that:

1. **The Electron main entry file is clearly and correctly defined**, using `build/src/index.js`:

   * Either via `electron/package.json` `"main": "build/src/index.js"`, or
   * via `extraMetadata.main` in `electron-builder.config.json`, but they must agree.

2. **The `build` folder is actually included in the packaged app:**

   * In `electron-builder.config.json`, the `files` array (or equivalent) must include something like:

     ```jsonc
     "files": [
       "build/**/*",
       "node_modules/**/*",
       "package.json"
     ]
     ```

   * Confirm there is no `files` pattern that explicitly **excludes** the `build` folder.

3. Ensure the config you end up with matches this mental model:

   * I run `npm run build` in the `electron` folder.
   * That creates `build/src/index.js` (and other compiled JS) relative to the `electron` project root.
   * When electron-builder packages, it:

     * Uses `build/src/index.js` as the main entry point.
     * Includes the `build` folder in the app.asar so that `build/src/index.js` exists at that exact path inside app.asar.

4. Do **not** change my build scripts (`build`, `build:ts`, `build:mac:unsigned`) unless they are clearly wrong.
   Focus on:

   * `electron/package.json` `"main"`,
   * `electron-builder.config.json` (or equivalent) `files` and `extraMetadata.main`.

5. After making changes, summarize for me:

   * What `"main"` is now set to in `electron/package.json`.
   * What the relevant part of `electron-builder.config.json` looks like (especially `files` and any `extraMetadata.main` / `appId` / `directories` changes).
   * Why these changes guarantee that `build/src/index.js` will be present and used as the app entry in the packaged app.