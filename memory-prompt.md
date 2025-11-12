You are a senior engineer. Investigate a suspected memory leak in our Ionic + Capacitor iOS app (WKWebView). Do not change any code. Create a root-level `memory-investigation.md` reporting your findings.

## Context
- App integrates Spotify auth + playback (PKCE, Web Playback SDK / API), photo selection, and slideshows.
- The app, when left idle in background while attached to Xcode, is terminated with “Terminated due to memory issue”.
- First-run playback/auth now works; the kill occurs after several minutes of inactivity (no slideshow playing).

## What to examine (read-only):
1) **Player lifecycle**
   - Where player is created; whether it’s a singleton; conditions that trigger re-init.
   - Whether previous instances are disconnected; any global references or closures that keep old players alive.
   - Any AudioContext / WebAudio allocations that persist on background.

2) **Event listeners & timers**
   - All `App.addListener` (appUrlOpen, appStateChange, resume, pause), Browser/Keyboard/Network/Haptics listeners.
   - `setInterval`/`setTimeout` loops (playback status, auth status, device polling).
   - Whether these are cleaned up on unmount/tab change/background.

3) **Images & slideshow memory**
   - How photos are loaded (Blob URLs, base64, file URLs), thumbnailing strategy, revocation of resources.
   - Any canvases / ImageBitmaps not disposed; offscreen images kept mounted.

4) **Navigation & component lifecycles**
   - Tab/page components that remain mounted (“keep-alive” behavior).
   - Any global stores retaining large objects (images, responses).

5) **Network/logging**
   - Background polling, retry strategies, and whether large payloads or errors are stored in memory.
   - Excessive console logging that might pin objects.

6) **Reproduction guidance**
   - Provide steps I can follow with Instruments (Allocations/Leaks/VM Tracker) to see the same growth, including where to “Mark Generation”.

## Deliverable
Create `memory-investigation.md` with:
- Summary of likely leak sources (ranked)
- File paths & symbols involved (components, hooks, services)
- Evidence for each (why it leaks / how it could grow when idle)
- A proposed minimal instrumentation plan (what to log/measure) to confirm
- A step-by-step profiling playbook (Instruments + Safari Web Inspector)
- A short “hardening plan” (singleton player, teardown on background, listener hygiene, image disposal, polling caps)

Do not modify application code; produce only the report.