You are a senior engineer auditing our Ionic + Capacitor iOS app’s Spotify auth & playback. Do not change code. Investigate and create a root-level file named `auth-investigation.md` containing your report.

## Context
- App signs in to Spotify via Authorization Code + PKCE, opens auth in system browser, handles `com.slideshowbuddy://callback`, then exchanges the code via our backend.
- Scopes include: streaming, user-read-email, user-read-private, playlist-read-private, playlist-read-collaborative, user-read-recently-played, user-read-playback-state, user-modify-playback-state.
- Symptom: 
  - First time after creating a playlist + slideshow and linking them, playback works.
  - Later, returning to play the same linked playlist throws an “auth error” during music player initialization.
  - After disconnect + re-authorize, attempting playback shows a **404** error.
- We recently fixed CORS for `capacitor://localhost` and ATS for our Render domain. Token flow works initially.

## Tasks (investigate only, be opinionated)
1) **Repro path & state**  
   - Describe a consistent repro path from app launch → playlist selection → play.  
   - Identify what auth state exists at each step (e.g., secure storage vs session storage vs in-memory).  
   - Note when/where tokens are read/written/cleared, and whether a refresh flow triggers on app resume or tab switch.

2) **Token lifecycle audit**  
   - Find how and where access token and refresh token are stored (Preferences/Keychain/sessionStorage/etc.).  
   - Determine when expiration is checked and when refresh is attempted.  
   - Verify the app always uses the latest token for player initialization and Web API calls (no stale closure / cached header / race conditions).  
   - Confirm scope set includes everything needed for the chosen playback approach.

3) **Player initialization & “active device”**  
   - Map the full initialization sequence for the music player (SDK/component hooks, event listeners, ready state, device id availability).  
   - Confirm there is an “active device” prior to issuing play commands (common root cause of 404 from /me/player/* endpoints).  
   - Identify any timing race (e.g., issuing /play before device is ready/active; missing transfer of playback to the device; missing resume after app is backgrounded).  
   - Document any assumptions about Premium requirement and iOS/WebView support for the chosen SDK.

4) **Playlist/track identifiers**  
   - Inspect how playlist is persisted in app state: are we storing IDs vs URIs vs URLs?  
   - Check if later runs pass the correct identifier to playback endpoints.  
   - Look for accidental inclusion of “spotify:playlist:” or full URLs where a bare ID is required, or vice versa.

5) **Networking paths & base URLs**  
   - Verify the base API URL for the backend is consistent and free of accidental trailing slash issues.  
   - Confirm all Spotify Web API calls use the front-end token (not the backend), and that the backend is only used for token exchange/refresh.

6) **Error capture & observability**  
   - Identify where errors are surfaced.  
   - Propose a temporary, minimal logging plan (no code yet—just what/where to add) to capture: request URL, response status/body, device/player readiness, token expiry time vs now, and selected playlist id at the moment of failure.

7) **App lifecycle**  
   - Note how the app handles background → foreground transitions: are auth/player listeners re-attached? Is any state cleared unexpectedly?  
   - Check for multiple, stacked URL-open listeners or duplicate player instances after navigation.

8) **Ranked hypotheses**  
   - Provide a ranked list (highest probability first) of what’s causing the auth error then 404 (e.g., player not active when calling /play, stale token after resume, wrong identifier, missing transfer-playback step, etc.). Tie each to concrete evidence from the code.

9) **Actionable next steps**  
   - Recommend the smallest, safest instrumentation changes to conclusively validate the top 2–3 hypotheses (what to log and where).  
   - Suggest a remediation plan for each top hypothesis (again, only in prose—no code changes now).

## Deliverable
Create `auth-investigation.md` at the repo root with:
- Summary (one paragraph)
- Reproduction steps
- Observations (with file paths and function/component names)
- Ranked hypotheses with evidence
- Proposed logs/metrics to add
- Next steps checklist