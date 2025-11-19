# Option B Implementation Plan: Change TypeScript Output Directory

**Implementation Goal**: Rename TypeScript output directory from `build/` to `app/` to eliminate the electron-builder naming conflict that prevents the packaged app from finding compiled JavaScript files.

**Root Cause**: electron-builder has special internal handling for directories named `build/` that conflicts with the `buildResources` configuration, causing the directory to be excluded from packaging despite being explicitly listed in the `files` array.

**Solution**: Rename the TypeScript output directory from `build/` to `app/`. This follows common Electron conventions where application code goes in `app/`, is semantically clearer (contains the application code), and completely avoids build-system terminology that could cause conflicts with tools like webpack, rollup, or other bundlers.

**Key Decisions**:
- ✅ Directory name: `app/` (more semantic, follows Electron conventions)
- ✅ Swift build: Keep as `build/native/` (intermediate output, no changes needed)
- ✅ Testing: Run test builds after implementation to verify the fix
- ✅ Documentation: Update in Stage 10 after validation
- ✅ Git commits: Leave uncommitted for manual review

---

## IMPLEMENTATION STAGES

### Stage 1: Pre-Implementation Preparation
**Purpose**: Set up safety nets and document the current state before making changes.

**Duration**: 15-20 minutes

**Tasks**:
- [ ] Create a backup reference of current working configuration
- [ ] Document all files that reference `build/` directory
- [ ] Verify current build pipeline works (baseline test)
- [ ] Create a rollback plan document
- [ ] Ensure git working tree is clean (already verified)

**Deliverables**:
- List of all files to be modified
- Backup of working build command
- Baseline build success confirmation

**Risk**: Low - Read-only operations

---

### Stage 2: Core Configuration Updates
**Purpose**: Update the primary configuration files that define the TypeScript output directory.

**Duration**: 15-20 minutes

**Files to Modify**:
1. **`electron/tsconfig.json`**
   - Change `"outDir": "./build"` → `"outDir": "./app"`

2. **`electron/index.js`**
   - Change `require('./build/src/index.js')` → `require('./app/src/index.js')`

3. **`electron/electron-builder.config.json`**
   - Change `"build/**/*"` → `"app/**/*"` in files array

**Verification**:
- [ ] TypeScript configuration syntax is valid
- [ ] Entry point path is correct
- [ ] electron-builder config JSON is valid

**Risk**: Low - Core configuration changes that are easily testable

---

### Stage 3: Ignore Files and Build Configuration
**Purpose**: Update ignore files and build-related configurations.

**Duration**: 10-15 minutes

**Files to Modify**:
1. **`electron/.gitignore`**
   - Change `build` → `app`

2. **`electron/.npmignore`**
   - Change references to `build` → `app` (if any exist)
   - Update comment: "Allow app directory to be included in packaged app"

3. **`electron/package.json`**
   - Review if any npm scripts reference the build directory
   - Update descriptions if needed (no path changes expected here)

**Verification**:
- [ ] Git will ignore the new app directory
- [ ] npm packaging will include app directory
- [ ] No syntax errors in configuration files

**Risk**: Low - These are standard configuration files

---

### Stage 4: Build Script Updates
**Purpose**: Update all build and verification scripts that reference the TypeScript output directory.

**Duration**: 30-40 minutes

**Files to Modify**:
1. **`electron/scripts/verify-build-artifacts.sh`**
   - Change `BUILD_DIR="$ELECTRON_ROOT/build"` → `BUILD_DIR="$ELECTRON_ROOT/app"`
   - Update all path references from `build/src/` → `app/src/`
   - Update error messages mentioning "build directory" → "app directory"
   - Update success messages mentioning "build/src/index.js" → "app/src/index.js"

2. **`electron/scripts/verify-ts-build.sh`**
   - Change `BUILD_DIR="$ELECTRON_ROOT/build"` → `BUILD_DIR="$ELECTRON_ROOT/app"`
   - Update all comments and error messages referencing `build/` directory → `app/`
   - Update file path checks from `build/` → `app/`

3. **`electron/scripts/build-orchestrator.sh`**
   - Update any references to `build/src/index.js` → `app/src/index.js`
   - Update log messages that mention the build directory

4. **`electron/scripts/build-error-reporter.sh`**
   - Update error message: "Check build/src/index.js exists" → "Check app/src/index.js exists"

5. **`electron/scripts/build-cleanup.sh`**
   - Review and update any references to TypeScript `build/` directory in cleanup logic
   - Change to clean `app/` directory instead of `build/`

**Note**: Swift build script (`build-swift.sh`) uses `build/native` as an intermediate directory but moves output to `assets/`. Per the implementation decision, this will remain unchanged as it's a separate, temporary Swift build artifact.

**Verification**:
- [ ] All scripts have valid bash syntax
- [ ] All path references are consistent to use `app/src/`
- [ ] No orphaned references to old TypeScript `build/` directory
- [ ] Swift `build/native` paths remain unchanged

**Risk**: Medium - Multiple script files, but changes are systematic and testable

---

### Stage 5: Source Code Updates
**Purpose**: Update any TypeScript/JavaScript source files that reference the TypeScript output directory.

**Duration**: 20-30 minutes

**Files to Check and Potentially Modify**:
1. **`electron/src/index.ts`**
   - Search for any hardcoded references to `build/` directory (for TypeScript output)
   - Check worker path construction in PhotosWorkerManager.getWorkerPath method
   - Update development path from: `electron/build/src/workers/` → `electron/app/src/workers/`
   - Production path may also need update if it references `build/`

2. **`electron/src/workers/photosPermissionWorker.ts`** (if it exists as TypeScript)
   - Check for any self-referential paths
   - Update any imports that might reference `build/` directory

3. **Any other source files**
   - Scan for hardcoded paths mentioning TypeScript output `build/` directory
   - Swift `build/native` references should remain unchanged

**Verification**:
- [ ] No hardcoded TypeScript `/build/` paths remain in source code
- [ ] All relative path references work correctly with `app/` directory
- [ ] Worker thread paths resolve correctly in both dev and production
- [ ] Swift FFI paths remain functional (should use `assets/` not affected by this change)

**Risk**: Low-Medium - Source code changes but mostly path references

---

### Stage 6: Clean Build and Initial Testing
**Purpose**: Remove old build artifacts and perform a fresh build with the new directory structure.

**Duration**: 10-15 minutes (plus build time ~3-5 minutes)

**Tasks**:
- [ ] Run `npm run build:clean` to remove old directories
- [ ] Run `npm run build:ts` to compile TypeScript to new `app/` directory
- [ ] Verify `electron/app/src/index.js` exists and has correct size (~42KB expected)
- [ ] Run `npm run build:verify-artifacts` to validate all build artifacts
- [ ] Check that TypeScript `app/` directory has expected structure
- [ ] Verify Swift `build/native` → `assets/` flow still works correctly

**Expected Directory Structure**:
```
electron/
  app/                    (NEW - TypeScript compiled output)
    src/
      index.js          (main application module ~42KB)
      menu.js           (menu module)
      preload.js        (preload script)
      setup.js          (setup module)
      native/           (FFI bindings)
      rt/               (runtime files)
      workers/          (worker threads)
    capacitor.config.js (capacitor config output)
  assets/                 (Swift compiled output - unchanged)
    libPhotosLibraryBridge.dylib
```

**Verification**:
- [ ] TypeScript compilation succeeds
- [ ] All expected files are in `app/` directory
- [ ] Swift artifacts are in `assets/` directory (unchanged)
- [ ] Verification scripts pass with new paths

**Risk**: Low - Clean build in isolated directory

---

### Stage 7: Electron Development Testing
**Purpose**: Test that the Electron app runs correctly in development mode with the new directory structure.

**Duration**: 10-15 minutes

**Tasks**:
- [ ] Run `npm run electron:start` to start the app in development mode
- [ ] Verify app launches without "Cannot find module" errors
- [ ] Check Electron console for any path-related errors
- [ ] Verify core functionality works (window opens, UI loads)
- [ ] Test Photos library FFI (if applicable on your system)
- [ ] Check that worker threads load correctly

**Verification**:
- [ ] App starts successfully
- [ ] No module resolution errors (should load from `app/src/index.js`)
- [ ] Core features functional
- [ ] No path-related warnings in console
- [ ] Swift FFI bridge loads correctly from `assets/`

**Risk**: Low - Development mode testing, easy to debug

---

### Stage 8: Packaging Test (Unsigned)
**Purpose**: Test electron-builder packaging with the new directory structure.

**Duration**: 15-20 minutes (plus package time ~3-5 minutes)

**Tasks**:
- [ ] Run `npm run build:mac:unsigned` to create an unsigned .app package
- [ ] Verify packaging completes without errors
- [ ] Check that `app/` directory is included in the packaged app
- [ ] Locate the packaged .app file in `electron/dist/mac/`
- [ ] Verify the .app bundle structure includes app directory

**Expected Package Structure** (check with `ls -R dist/mac/Slideshow\ Buddy.app/Contents/Resources/`):
```
Resources/
  app/
    index.js
    package.json
    app/                  (TypeScript compiled output)
      src/
        index.js
        (all other compiled files)
    assets/               (Swift compiled output)
      libPhotosLibraryBridge.dylib
    node_modules/
```

**Verification**:
- [ ] Packaging succeeds without errors
- [ ] No "files: []" warning in electron-builder output
- [ ] `app/` directory is present in packaged app
- [ ] `app/src/index.js` exists in packaged app (critical file)
- [ ] `assets/libPhotosLibraryBridge.dylib` is present (Swift FFI)

**Risk**: Medium - This is the critical test that previously failed

---

### Stage 9: Launch Packaged App Test
**Purpose**: Verify the packaged app actually launches and runs correctly.

**Duration**: 10-15 minutes

**Tasks**:
- [ ] Navigate to `electron/dist/mac/` in Finder
- [ ] Double-click `Slideshow Buddy.app` to launch
- [ ] Observe whether app launches without errors
- [ ] If launch fails, check Console.app for error messages
- [ ] If launch succeeds, test basic app functionality
- [ ] Verify Photos library access works (if applicable)

**Success Criteria**:
- [ ] App launches without "Cannot find module './app/src/index.js'" error
- [ ] App window opens and displays UI
- [ ] Core features are functional
- [ ] No critical errors in system console

**Verification**:
- [ ] App launches successfully from Finder
- [ ] No module resolution errors
- [ ] UI loads correctly
- [ ] Basic functionality works

**Risk**: Medium-High - This is the ultimate validation test

---

### Stage 10: Final Validation and Documentation
**Purpose**: Perform comprehensive testing and update documentation.

**Duration**: 30-45 minutes

**Tasks**:
- [ ] Run complete build pipeline: `npm run build:reset`
- [ ] Run all verification scripts successfully
- [ ] Test both development and packaged versions
- [ ] Document the changes in CHANGELOG.md (if we do version management)
- [ ] Update documentation files (if you requested this in Question #4)
- [ ] Create a summary report of what was changed and why
- [ ] Verify the workaround command is no longer needed

**Documentation Files to Update**:
1. **`electron/BUILD.md`**
   - Update references from `build/` → `app/` for TypeScript output
   - Clarify that `build/native` is Swift intermediate (unchanged)
   - Update build artifact locations

2. **`electron/BUILD_ARCHITECTURE.md`**
   - Update directory structure diagrams
   - Show `app/` for TypeScript, `assets/` for Swift output
   - Update path references throughout

3. **`docs/ARCHITECTURE.md`**
   - Update electron build architecture section
   - Clarify separation between TypeScript (`app/`) and Swift (`assets/`) outputs

4. **`README.md`** (root)
   - Update if it contains build instructions
   - Ensure paths reflect new structure

**Verification**:
- [ ] All builds succeed consistently
- [ ] Documentation accurately reflects `app/` and `assets/` distinction
- [ ] No references to TypeScript `build/` directory remain
- [ ] Swift `build/native` references explained as intermediate (if mentioned)
- [ ] Team members can follow updated documentation

**Risk**: Low - Final validation and documentation

---

## ROLLBACK PLAN

If at any point the implementation fails or causes issues:

1. **Immediate Rollback** (if git is clean at start):
   ```bash
   git reset --hard HEAD
   git clean -fd
   ```

2. **Partial Rollback** (if mid-implementation):
   - Revert configuration changes: `git checkout electron/tsconfig.json electron/index.js electron/electron-builder.config.json`
   - Use the proven workaround command:
     ```bash
     npx electron-builder --mac --config.asar=false --config.productName="Slideshow Buddy" --config.files="**/*"
     ```

3. **Directory Cleanup**:
   ```bash
   cd electron
   rm -rf app
   npm run build:clean
   npm run build
   ```

---

## SUCCESS METRICS

The implementation will be considered successful when:

1. ✅ TypeScript compiles to `app/` directory instead of `build/`
2. ✅ All build scripts reference `app/` (TypeScript) and pass validation
3. ✅ Swift builds continue to work with `build/native` → `assets/` flow
4. ✅ Electron app runs in development mode without errors
5. ✅ `npm run build:mac:unsigned` packages successfully
6. ✅ Packaged .app includes `app/src/index.js` (critical file)
7. ✅ Packaged .app launches from Finder without "Cannot find module" error
8. ✅ App functionality works correctly in packaged version (Photos FFI, workers, etc.)
9. ✅ No workaround command-line flags needed for packaging

---

## ESTIMATED TOTAL TIME

- **Core Implementation**: 2-3 hours
- **Testing and Validation**: 1-2 hours
- **Documentation Updates**: 30-60 minutes
- **Total**: 4-6 hours (consistent with report estimate)

---

## NOTES

- This plan breaks down the work into manageable, testable stages
- Each stage has clear deliverables and verification steps
- Stages can be performed sequentially with validation between each
- The plan follows the principle of "change one thing, test, then proceed"
- Rollback is possible at any stage if issues arise
- The implementation eliminates the root cause rather than using workarounds

---

## NEXT STEPS

1. **Review this plan** and answer the clarifying questions at the top
2. **Approve or request modifications** to the implementation approach
3. **Signal to proceed with Stage 1** when ready
4. Each stage will be completed and verified before moving to the next
5. Progress will be reported after each stage completion

**Ready to begin when you give the go-ahead!**
