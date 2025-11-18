### 🧠 Context

I’m working on the macOS Electron app for **Slideshow Buddy**.

I build the unsigned mac app with something like:

```bash
cd electron
npm run build:swift
npm run build:ts
npm run build:mac:unsigned
```

and then open:

`electron/dist/mac-arm64/Slideshow Buddy.app`

On startup, the app crashes with:

> **Error: ENOENT: no such file or directory, open '.../Contents/Resources/app-update.yml'**

This is coming from **electron-updater** / `autoUpdater` trying to read `app-update.yml` from the app’s `Resources` folder. That file only exists for published builds, but I’m doing a local unsigned build for dev/testing.

Previously, we tried to “guard” the auto-update logic, but I’m still seeing the error. That strongly suggests that simply **importing** `autoUpdater` is enough to trigger the read of `app-update.yml` when the module is initialized.

For now, in my **local unsigned builds**, I want **electron-updater completely disabled** — including not importing it at all. I don’t care about updates during this phase; I just need the app to launch and run.

---

### 🎯 Task

Please make the following changes, with as little disruption as possible to the rest of the app:

---

#### (1) Find all usages of electron-updater / autoUpdater

Search the Electron main process code (and any related modules) for:

* `electron-updater`
* `autoUpdater`
* `app-update.yml` (if referenced directly)

Common files to check:

* `electron/src/index.ts` (or `main.ts` / `main.js`)
* Any helper modules that deal with updates

---

#### (2) Remove all **top-level imports** of `autoUpdater`

If you see something like:

```ts
import { autoUpdater } from 'electron-updater';
```

or similar at the **top of a file**, that must be changed.

The problem is: in packaged builds, simply importing `autoUpdater` causes its singleton instance to be created, and its constructor attempts to read `app-update.yml`. That read explodes when the file is missing, even if we never call `checkForUpdates`.

Replace any top-level imports with a **guarded, conditional dynamic require** pattern, for example:

> **Note:** treat the code below as a reference pattern; please adapt it to the existing style and structure.

```ts
function getAutoUpdater() {
  // For now, completely disable auto-updates in local builds.
  // We only want this code path to be used in real production builds later.
  if (process.env.ENABLE_AUTO_UPDATE !== 'true') {
    return null;
  }

  // Only require electron-updater when we explicitly enable it.
  // This prevents it from trying to read app-update.yml in local unsigned builds.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { autoUpdater } = require('electron-updater');
  return autoUpdater;
}
```

Then:

* Only call `getAutoUpdater()` in code paths where updates are actually needed (probably nowhere right now).
* In my current workflow, I will *not* set `ENABLE_AUTO_UPDATE`, so `getAutoUpdater()` must return `null` and **never require** `electron-updater` at all.

The important rule:

> **In local unsigned builds, the module `electron-updater` must never be imported or required.**

---

#### (3) Guard any existing update logic

If there are functions like:

* `initAutoUpdater()`
* `setupAutoUpdater()`
* `autoUpdater.checkForUpdatesAndNotify()`
* etc.

Please:

* Wrap them in conditions that first get the autoUpdater instance via `getAutoUpdater()` (or similar).
* If `getAutoUpdater()` returns `null`, those functions should simply no-op and log something like “Auto-updater disabled in this build”.

Do **not** attempt any filesystem reads of `app-update.yml` manually. We want the absence of that file to be a non-issue.

---

#### (4) Do NOT try to hack around by adding app-update.yml

Please **do not**:

* Add a dummy `app-update.yml` into `dist` manually.
* Add `app-update.yml` to `extraResources` as a fake file.
* Modify node_modules / electron-updater source.

We’re solving this solely by **not importing electron-updater at all** unless we explicitly enable it via an environment variable.

---

#### (5) Summarize changes

After making the modifications, please summarize:

1. All files you changed.
2. How `electron-updater` is now conditionally required.
3. What environment variable (`ENABLE_AUTO_UPDATE`) controls whether it’s used.
4. The expected behavior:

   * In my current unsigned mac build (with `ENABLE_AUTO_UPDATE` not set), no import or require for `electron-updater` should happen, and the app should **not** try to read `app-update.yml`.

---

### ✅ Expected outcome

Once your changes are in place, I will:

```bash
cd electron
npm run build:swift
npm run build:ts
npm run build:mac:unsigned
```

Then open:

`electron/dist/mac-arm64/Slideshow Buddy.app`

Expected behavior:

* The app launches without crashing.
* No `ENOENT` for `app-update.yml`.
* No update checks are performed.
* Everything else (including the Photos FFI and UI) works as before.

---

If anything is unclear about how I want `electron-updater` disabled, ask me before making large changes.
