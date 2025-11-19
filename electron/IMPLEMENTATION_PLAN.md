# Build Architecture Implementation Plan

## File Structure for Implementation

```
electron/
├── scripts/
│   ├── validate-build-env.sh          # Pre-build environment validation
│   ├── verify-swift-build.sh          # Swift build artifact verification  
│   ├── verify-ts-build.sh             # TypeScript build artifact verification
│   ├── verify-build-artifacts.sh      # Final build artifact validation
│   ├── build-orchestrator.sh          # Master build coordination script
│   ├── build-error-reporter.sh        # Centralized error reporting utility
│   └── build-cleanup.sh               # Build cleanup and rollback utility
├── build/
│   ├── logs/                          # Build process logs
│   ├── src/                           # TypeScript compiled output
│   └── native/                        # Swift compiled libraries
├── package.json                       # Updated npm scripts
└── BUILD_ARCHITECTURE.md             # Architecture documentation (complete)
```

## Script Specifications

### 1. validate-build-env.sh
**Purpose**: Pre-build environment validation
**Location**: `electron/scripts/validate-build-env.sh`
**Dependencies**: None
**Exit Codes**: 0=success, 1=missing prerequisites, 2=permission errors

**Key Functions**:
- Check Swift compiler availability and version
- Verify TypeScript compiler installation  
- Validate Node.js dependencies
- Check source file existence
- Verify build directory permissions
- Generate environment report

### 2. verify-swift-build.sh  
**Purpose**: Swift build output verification
**Location**: `electron/scripts/verify-swift-build.sh`
**Dependencies**: `build-error-reporter.sh`
**Exit Codes**: 0=success, 1=missing library, 2=architecture issues

**Key Functions**:
- Check dylib file existence and size
- Verify universal binary architecture (x86_64 + arm64)
- Validate assets directory copy
- Test library symbol exports
- Generate verification report

### 3. verify-ts-build.sh
**Purpose**: TypeScript build output validation  
**Location**: `electron/scripts/verify-ts-build.sh`
**Dependencies**: `build-error-reporter.sh`
**Exit Codes**: 0=success, 1=missing files, 2=syntax errors

**Key Functions**:
- Check main entry point `build/src/index.js`
- Validate JavaScript syntax
- Verify module resolution
- Check required TypeScript outputs
- Generate verification report

### 4. verify-build-artifacts.sh
**Purpose**: Complete build artifact validation
**Location**: `electron/scripts/verify-build-artifacts.sh` 
**Dependencies**: `build-error-reporter.sh`
**Exit Codes**: 0=success, 1=missing artifacts, 2=critical files missing

**Key Functions**:
- Validate all required build outputs
- Check entry point resolution
- Verify packaging prerequisites
- Generate final build report

### 5. build-orchestrator.sh
**Purpose**: Master build coordination
**Location**: `electron/scripts/build-orchestrator.sh`
**Dependencies**: All verification scripts
**Exit Codes**: 0=success, 1=build failure, 2=verification failure

**Key Functions**:
- Execute build stages in sequence
- Handle stage failures and cleanup
- Coordinate error reporting
- Manage build logging
- Generate build summary

### 6. build-error-reporter.sh
**Purpose**: Centralized error reporting utility
**Location**: `electron/scripts/build-error-reporter.sh`
**Dependencies**: None (utility script)
**Exit Codes**: Always 0 (utility function)

**Key Functions**:
- Standardized error message formatting
- Log aggregation and storage
- Error classification
- Actionable error suggestions
- Build failure summaries

### 7. build-cleanup.sh
**Purpose**: Build cleanup and rollback
**Location**: `electron/scripts/build-cleanup.sh`
**Dependencies**: None
**Exit Codes**: 0=success, 1=cleanup failure

**Key Functions**:
- Clean partial build artifacts
- Preserve build logs for debugging
- Restore previous working state
- Reset build environment
- Generate cleanup report

## Updated package.json Scripts

```json
{
  "scripts": {
    "prebuild": "./scripts/validate-build-env.sh",
    "build:swift": "./scripts/build-swift.sh",
    "build:swift:verified": "./scripts/build-swift.sh && ./scripts/verify-swift-build.sh",
    "build:ts": "tsc && electron-rebuild", 
    "build:ts:verified": "tsc && electron-rebuild && ./scripts/verify-ts-build.sh",
    "build:orchestrated": "./scripts/build-orchestrator.sh",
    "build:verified": "npm run prebuild && npm run build:orchestrated && ./scripts/verify-build-artifacts.sh",
    "build:safe": "npm run build:verified",
    "build:clean": "./scripts/build-cleanup.sh && npm run build:safe",
    "build:mac:safe": "npm run build:safe && electron-builder --mac --publish never",
    "build:mac:clean": "npm run build:clean && electron-builder --mac --publish never",
    "build:mac:reset": "npm run build:clean && npm run build:mac:safe"
  }
}
```

## Implementation Order

1. **Phase 1: Core Utilities**
   - Create `build-error-reporter.sh` (foundation for all other scripts)
   - Create `build-cleanup.sh` (cleanup utility)
   - Create `validate-build-env.sh` (pre-build validation)

2. **Phase 2: Verification Scripts** 
   - Create `verify-swift-build.sh`
   - Create `verify-ts-build.sh` 
   - Create `verify-build-artifacts.sh`

3. **Phase 3: Build Orchestration**
   - Create `build-orchestrator.sh`
   - Update `package.json` scripts
   - Enhance existing `build-swift.sh` with error capture

4. **Phase 4: Testing & Validation**
   - Test each script individually
   - Test complete build pipeline
   - Test failure scenarios
   - Validate error reporting

## Script Template Standards

All scripts should follow these standards:

### Error Handling Template
```bash
#!/bin/bash
set -euo pipefail  # Exit on error, undefined vars, pipe failures

# Source error reporting utilities
source "$(dirname "$0")/build-error-reporter.sh"

# Main script logic with error handling
trap 'report_error "Script failed at line $LINENO"' ERR

# Your script content here
```

### Logging Template  
```bash
# Create log file for this script
SCRIPT_NAME=$(basename "$0" .sh)
LOG_FILE="build/logs/${SCRIPT_NAME}-$(date +%Y%m%d-%H%M%S).log"
mkdir -p "$(dirname "$LOG_FILE")"

# Log all output
exec > >(tee "$LOG_FILE") 2>&1
```

### Success/Failure Reporting
```bash
# On success
echo "[SUCCESS] $SCRIPT_NAME completed successfully"
exit 0

# On failure  
report_error "SCRIPT_NAME" "ERROR_TYPE" "Detailed error message" "$LOG_FILE"
exit 1
```

## Testing Strategy

### Unit Testing
- Each script tested in isolation
- Mock dependencies for unit tests
- Test success and failure paths
- Verify exit codes and outputs

### Integration Testing
- Test complete build pipeline
- Test with real Swift and TypeScript code
- Test with missing dependencies
- Test permission issues

### Failure Scenario Testing
```bash
# Test scenarios to implement
1. Missing Swift compiler
2. TypeScript syntax errors  
3. Missing source files
4. Permission denied errors
5. Incomplete previous builds
6. Network/dependency issues
```

## Success Criteria

- **Zero false positives**: No build failures on valid code
- **Zero false negatives**: No missed build issues  
- **Clear error messages**: All failures have actionable guidance
- **Fast feedback**: Build failures detected within 30 seconds
- **Reliable cleanup**: Failed builds don't leave artifacts
- **Comprehensive logging**: All build steps logged for debugging

This implementation plan provides the detailed specifications needed to create the robust build process that will eliminate the core issue of `Error: Cannot find module './build/src/index.js'`.