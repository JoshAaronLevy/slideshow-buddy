# Spotify Auth & Playback Fix - Implementation Plan

**Date**: November 12, 2025  
**Related**: See `auth-investigation.md` for full technical analysis  
**Goal**: Fix auth errors and 404s in music playback through incremental, testable changes

---

## Overview

This plan breaks the fix into **5 stages**, each deliverable and testable independently. Each stage addresses specific hypotheses from the investigation report.

**Approval workflow**: Review each stage, then reply "Proceed with Stage N" to begin implementation.

---

## Stage 1: Instrumentation & Observability 🔍

**Goal**: Add structured logging to capture token state, device state, and request/response details at key moments

**Why first**: We need visibility before making fixes. Logs will validate hypotheses and help debug future issues.

**Scope**: Read-only additions (logging only, no behavior changes)

**Files to modify**:
- `src/services/MusicPlayerService.ts`
- `src/services/SpotifyAuthService.ts`
- `src/components/SlideshowPlayer.tsx`

**What will be logged**:
1. **Token state**: expiry time, age, is_expired flag
2. **Device state**: device_id, ready status, active status
3. **Playback requests**: URI/context, HTTP status/body on error
4. **Player lifecycle**: init start/success/error, device ready/not_ready

**Log format** (JSON-structured for searchability):
```typescript
{
  timestamp: number,
  component: 'MusicPlayer' | 'Auth' | 'SlideshowPlayer',
  action: string,
  details: { ... }
}
```

**Testing after Stage 1**:
- Run app, check Xcode console for structured logs
- Trigger a failure scenario (wait 1hr, play again)
- Verify logs capture token expiry, device state, error details

**Estimated changes**: ~150 lines (mostly console.log statements)

---

## Stage 2: Token Refresh on App Resume 🔄

**Goal**: Automatically refresh expired tokens when app returns from background

**Why second**: Low-risk, high-impact fix. Prevents most "stale token" errors without touching player logic.

**Scope**: Add app lifecycle listener

**Files to modify**:
- `src/App.tsx` (add `appStateChange` listener)

**What changes**:
1. Add `App.addListener('appStateChange', ...)` in App.tsx
2. On `isActive: true` (app resumed):
   - Check `isTokenExpired()`
   - If expired, call `refreshAccessToken()`
   - Log success/failure
3. Clean up listener on unmount

**Addresses**: Investigation Hypothesis #3 (75% confidence)

**Testing after Stage 2**:
- Auth → play music → works ✅
- Background app for 1+ hour → foreground → play → should work ✅
- Check logs to confirm token was refreshed on resume

**Estimated changes**: ~30 lines

---

## Stage 3: Device Activation Before Playback 🎵

**Goal**: Explicitly transfer playback to the Web Playback SDK device before calling `/play`

**Why third**: Addresses the PRIMARY root cause (404 "No active device")

**Scope**: Add device transfer call before playback

**Files to modify**:
- `src/services/MusicPlayerService.ts` (modify `startPlayback()`)

**What changes**:
1. Before calling `PUT /me/player/play`, add:
   ```typescript
   // Transfer playback to this device (make it active)
   await axios.put(
     `${SPOTIFY_CONFIG.API_BASE_URL}/me/player`,
     { device_ids: [deviceId], play: false },
     { headers: { Authorization: `Bearer ${token}` } }
   );
   await new Promise(resolve => setTimeout(resolve, 500)); // Let Spotify register
   ```
2. Add error handling for transfer failures
3. Log device transfer success/failure

**Addresses**: Investigation Hypothesis #1 (95% confidence - PRIMARY)

**Testing after Stage 3**:
- Auth → play → exit → play again → should work ✅
- Disconnect → re-auth → play → should work ✅
- Check logs to confirm device transfer before each play

**Estimated changes**: ~20 lines

**Risk**: Low. If transfer fails, fallback is current behavior (may still work for active devices).

---

## Stage 4: Fresh Token in Player Callback 🔐

**Goal**: Force token refresh in the player's `getOAuthToken` callback if expired

**Why fourth**: Fixes auth errors when token expires during a long slideshow session

**Scope**: Update player initialization to check token expiry before returning it to SDK

**Files to modify**:
- `src/services/MusicPlayerService.ts` (modify `initializePlayer()`)

**What changes**:
1. Replace the `getOAuthToken` callback (line 111-115):
   ```typescript
   getOAuthToken: async (callback) => {
     // Always check expiry before returning token to SDK
     const expired = await isTokenExpired();
     if (expired) {
       console.log('[Player] Token expired, refreshing...');
       try {
         await refreshAccessToken();
       } catch (error) {
         console.error('[Player] Token refresh failed', error);
       }
     }
     const token = await getAccessToken();
     if (token) {
       callback(token);
     }
   }
   ```
2. Import `isTokenExpired` and `refreshAccessToken` from SpotifyAuthService

**Addresses**: Investigation Hypothesis #2 (85% confidence)

**Testing after Stage 4**:
- Auth → start long slideshow (30+ min) → wait for token to expire → slideshow continues → music should keep playing ✅
- Check logs to confirm token refreshed mid-session

**Estimated changes**: ~15 lines

**Risk**: Low. Only affects token retrieval; player will get fresh token or fail gracefully.

---

## Stage 5: Cleanup & Polish 🧹

**Goal**: Fix minor issues and improve robustness

**Why last**: Nice-to-haves that improve reliability but aren't critical to core functionality

**Scope**: Cleanup tasks

**Files to modify**:
- `src/pages/Tab2.tsx` (fix auth listener cleanup)
- `src/services/MusicPlayerService.ts` (add device active check - optional)

**What changes**:

### 5a. Fix duplicate auth listeners
- Update `setupAuthListener()` in `SpotifyAuthService.ts` to return listener handle
- Update Tab2.tsx to clean up listener on unmount:
  ```typescript
  useEffect(() => {
    const listenerHandle = setupAuthListener(...);
    return () => listenerHandle.remove();
  }, []);
  ```

### 5b. Add device active verification (optional, for debugging)
- Before playback, query `/me/player/devices` to check if device is listed and active
- Log device state (active/inactive)
- This is informational; don't block playback

**Addresses**: Investigation Hypothesis #5 (30% confidence) + observability improvements

**Testing after Stage 5**:
- Navigate away from Tab2 and back multiple times → no duplicate callbacks ✅
- Play music → check logs for device active status

**Estimated changes**: ~40 lines

**Risk**: Very low. Cleanup tasks with fallbacks.

---

## Stage 6 (Optional): Token Manager Refactor 🏗️

**Goal**: Centralize token management for long-term maintainability

**Why optional**: This is a larger refactor that addresses technical debt but isn't required for immediate fixes

**Scope**: Create a `TokenManager` singleton

**Files to create**:
- `src/services/TokenManager.ts`

**Files to modify**:
- All services that call `getAccessToken()` (SpotifyService, MusicPlayerService, SpotifyAuthService)

**What changes**:
1. Create `TokenManager` class:
   - Holds token in memory + Preferences (dual storage)
   - Auto-refreshes 5 min before expiry (background timer)
   - Exposes `getValidToken()` that always returns a fresh token or throws
   - Exposes `invalidateToken()` for logout
2. Replace all `getAccessToken()` calls with `TokenManager.getValidToken()`
3. Initialize TokenManager on app launch (App.tsx)

**Benefits**:
- Single source of truth for tokens
- Proactive refresh (no more "check then refresh" logic scattered everywhere)
- Easier to add retry logic, health checks, etc.

**Testing after Stage 6**:
- All existing scenarios should continue to work
- Token refresh should happen automatically in background

**Estimated changes**: ~200 lines (new file + refactor existing calls)

**Risk**: Medium. Touches many files; requires thorough testing.

**Decision**: Defer until Stages 1-5 are stable and working. This is a "nice to have" for future maintainability.

---

## Testing Strategy (All Stages)

### Test Scenarios

**TS1: Fresh auth → immediate play**
- Expected: ✅ Works (baseline)

**TS2: Play → exit → wait 5 min → play again**
- Expected: ✅ Works after Stage 3 (device transfer)

**TS3: Play → wait 1+ hour → play again**
- Expected: ✅ Works after Stage 2 (app resume) or Stage 4 (callback refresh)

**TS4: Background app 1+ hour → foreground → play**
- Expected: ✅ Works after Stage 2 (app resume listener)

**TS5: Disconnect → re-auth → play**
- Expected: ✅ Works after Stage 3 (device transfer)

**TS6: Long slideshow (30+ min with music)**
- Expected: ✅ Music continues after Stage 4 (callback refresh)

### Verification Checklist (After Each Stage)

- [ ] App compiles without errors
- [ ] No TypeScript errors
- [ ] Xcode console shows structured logs (Stage 1+)
- [ ] All test scenarios pass
- [ ] No regressions in existing functionality

---

## Rollback Plan

Each stage is **additive and isolated**. If a stage causes issues:

1. **Stage 1**: Remove console.log statements (no behavior impact)
2. **Stage 2**: Remove app lifecycle listener (revert App.tsx changes)
3. **Stage 3**: Comment out device transfer call (revert to current behavior)
4. **Stage 4**: Revert `getOAuthToken` callback to original (simple token fetch)
5. **Stage 5**: Revert cleanup changes (listeners still work, just not cleaned up)

Each stage can be rolled back independently without affecting others.

---

## Approval Workflow

To proceed with a stage, simply reply:

```
"Proceed with Stage N"
```

I will:
1. Implement all changes for that stage
2. Show you a summary of modified files
3. Wait for your approval to test or move to next stage

You can also say:
- **"Skip Stage N"** - Move to next stage without implementing
- **"Show me Stage N code first"** - I'll show the exact changes before applying
- **"Pause"** - Stop and wait for further instructions

---

## Summary Table

| Stage | Goal | Risk | Impact | Estimated LOC | Addresses Hypothesis |
|-------|------|------|--------|---------------|---------------------|
| 1 | Add logging | None | High (observability) | ~150 | N/A (foundation) |
| 2 | App resume refresh | Low | High | ~30 | #3 (75%) |
| 3 | Device transfer | Low | Critical | ~20 | #1 (95%) PRIMARY |
| 4 | Token refresh callback | Low | High | ~15 | #2 (85%) |
| 5 | Cleanup | Very Low | Medium | ~40 | #5 (30%) |
| 6 | Token Manager (optional) | Medium | Medium | ~200 | Future-proofing |

**Recommended order**: 1 → 2 → 3 → 4 → 5 → (pause, observe) → 6 (if needed)

**Minimum viable fix**: Stages 1, 2, 3 will resolve most issues. Stage 4 is insurance for long sessions.

---

## Notes

- Each stage builds on previous stages (cumulative fixes)
- Stages 2-5 can be reordered if needed (mostly independent)
- Stage 1 must come first (establishes logging infrastructure)
- Stage 6 is a separate project (optional refactor)

**Ready to proceed?** Reply with "Proceed with Stage 1" when you're ready to start.
