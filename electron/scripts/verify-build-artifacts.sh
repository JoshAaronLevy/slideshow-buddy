#!/bin/bash

# Build Artifacts Verification Script
# Purpose: Final pre-packaging validation
# Checks all build artifacts from both Swift and TypeScript builds

set -e
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ELECTRON_ROOT="$(dirname "$SCRIPT_DIR")"
ERROR_REPORTER="$SCRIPT_DIR/build-error-reporter.sh"
BUILD_DIR="$ELECTRON_ROOT/build"
ASSETS_DIR="$ELECTRON_ROOT/assets"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "Starting final build artifacts verification..."

# Function to report error and exit
report_error() {
    local error_msg="$1"
    echo -e "${RED}✗ $error_msg${NC}"
    bash "$ERROR_REPORTER" "Artifact Verification" "$error_msg" 1
}

# Function to report success
report_success() {
    local success_msg="$1"
    echo -e "${GREEN}✓ $success_msg${NC}"
}

# Function to report info
report_info() {
    local info_msg="$1"
    echo -e "${BLUE}ℹ $info_msg${NC}"
}

# Function to get file size in human readable format
get_file_size() {
    local file="$1"
    if [ ! -f "$file" ]; then
        echo "N/A"
        return
    fi
    
    local size=$(stat -f %z "$file" 2>/dev/null || stat -c %s "$file" 2>/dev/null)
    if [ "$size" -lt 1024 ]; then
        echo "${size}B"
    elif [ "$size" -lt 1048576 ]; then
        echo "$((size / 1024))KB"
    else
        echo "$((size / 1048576))MB"
    fi
}

# Track overall status
TOTAL_CHECKS=0
FAILED_CHECKS=0
CRITICAL_FAILURES=0

# Function to check file and track results
check_file() {
    local file_path="$1"
    local file_description="$2"
    local is_critical="${3:-false}"
    
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
    
    if [ ! -f "$file_path" ]; then
        echo -e "${RED}✗ MISSING: $file_description${NC}"
        echo "  Expected: $file_path"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        if [ "$is_critical" = "true" ]; then
            CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
        fi
        return 1
    fi
    
    local file_size=$(get_file_size "$file_path")
    local actual_size=$(stat -f %z "$file_path" 2>/dev/null || stat -c %s "$file_path" 2>/dev/null)
    
    if [ "$actual_size" -eq 0 ]; then
        echo -e "${RED}✗ EMPTY: $file_description${NC}"
        echo "  File: $file_path"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        if [ "$is_critical" = "true" ]; then
            CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
        fi
        return 1
    fi
    
    report_success "$file_description ($file_size)"
    return 0
}

echo ""
echo -e "${BLUE}=== CRITICAL APPLICATION FILES ===${NC}"
echo "These files are absolutely required for the application to start"

# Check critical entry point
check_file "$ELECTRON_ROOT/index.js" "Electron main entry point" true

# Check critical TypeScript build output
check_file "$BUILD_DIR/src/index.js" "Main application module (compiled from TypeScript)" true

echo ""
echo -e "${BLUE}=== TYPESCRIPT BUILD ARTIFACTS ===${NC}"

# Check TypeScript build directory
if [ ! -d "$BUILD_DIR" ]; then
    echo -e "${RED}✗ Build directory not found: $BUILD_DIR${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
else
    report_success "Build directory exists"
    
    # Check additional TypeScript outputs
    check_file "$BUILD_DIR/src/menu.js" "Menu module"
    check_file "$BUILD_DIR/src/preload.js" "Preload script"
    check_file "$BUILD_DIR/src/setup.js" "Setup module"
    
    # Check for TypeScript runtime files if they exist
    if [ -d "$BUILD_DIR/src/rt" ]; then
        check_file "$BUILD_DIR/src/rt/electron-rt.js" "Electron runtime"
        check_file "$BUILD_DIR/src/rt/electron-plugins.js" "Electron plugins" false
    fi
    
    # Check for workers if they exist in build
    if [ -d "$BUILD_DIR/src/workers" ]; then
        check_file "$BUILD_DIR/src/workers/photosPermissionWorker.js" "Photos permission worker"
    fi
    
    # Check for native FFI bindings if they exist
    if [ -d "$BUILD_DIR/src/native" ]; then
        check_file "$BUILD_DIR/src/native/PhotosLibraryFFI.js" "Photos library FFI bindings"
        check_file "$BUILD_DIR/src/native/types.js" "Native types definitions"
    fi
fi

echo ""
echo -e "${BLUE}=== SWIFT BUILD ARTIFACTS ===${NC}"

# Check Swift build directory
if [ ! -d "$ASSETS_DIR" ]; then
    echo -e "${RED}✗ Assets directory not found: $ASSETS_DIR${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
    CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
else
    report_success "Assets directory exists"
    
    # Check Swift dynamic library
    check_file "$ASSETS_DIR/libPhotosLibraryBridge.dylib" "Photos library bridge (Swift)" true
    
    # Check for other assets
    check_file "$ASSETS_DIR/appIcon.icns" "macOS app icon"
    check_file "$ASSETS_DIR/appIcon.png" "PNG app icon"
    
    # Check for splash assets if they exist
    if [ -f "$ASSETS_DIR/splash.png" ]; then
        check_file "$ASSETS_DIR/splash.png" "Splash screen"
    fi
    if [ -f "$ASSETS_DIR/splash.gif" ]; then 
        check_file "$ASSETS_DIR/splash.gif" "Animated splash screen"
    fi
fi

echo ""
echo -e "${BLUE}=== CONFIGURATION FILES ===${NC}"

# Check configuration files
check_file "$ELECTRON_ROOT/package.json" "Package configuration" true
check_file "$ELECTRON_ROOT/tsconfig.json" "TypeScript configuration"

# Check electron-builder config if it exists
if [ -f "$ELECTRON_ROOT/electron-builder.config.json" ]; then
    check_file "$ELECTRON_ROOT/electron-builder.config.json" "Electron builder configuration"
fi

echo ""
echo -e "${BLUE}=== ENTRY POINT VALIDATION ===${NC}"

# Validate the critical entry point dependency
ENTRY_POINT="$ELECTRON_ROOT/index.js"
if [ -f "$ENTRY_POINT" ]; then
    # Check if index.js correctly references the build output
    if grep -q "./build/src/index.js" "$ENTRY_POINT" 2>/dev/null; then
        if [ -f "$BUILD_DIR/src/index.js" ]; then
            report_success "Entry point dependency is satisfied"
        else
            echo -e "${RED}✗ Entry point references missing build output${NC}"
            echo "  '$ENTRY_POINT' requires './build/src/index.js'"
            echo "  But '$BUILD_DIR/src/index.js' does not exist"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            CRITICAL_FAILURES=$((CRITICAL_FAILURES + 1))
        fi
    else
        echo -e "${YELLOW}⚠ Could not verify entry point dependency${NC}"
        echo "  Unable to confirm if index.js references build output correctly"
    fi
else
    echo -e "${RED}✗ Entry point validation failed - file not found${NC}"
fi

echo ""
echo -e "${BLUE}=== FINAL READINESS REPORT ===${NC}"

# Calculate success rate
SUCCESS_RATE=0
if [ "$TOTAL_CHECKS" -gt 0 ]; then
    SUCCESS_RATE=$(( (TOTAL_CHECKS - FAILED_CHECKS) * 100 / TOTAL_CHECKS ))
fi

echo "Total checks performed: $TOTAL_CHECKS"
echo "Successful checks: $((TOTAL_CHECKS - FAILED_CHECKS))"
echo "Failed checks: $FAILED_CHECKS"
echo "Critical failures: $CRITICAL_FAILURES"
echo "Success rate: $SUCCESS_RATE%"

echo ""

# Determine final status
if [ "$CRITICAL_FAILURES" -gt 0 ]; then
    echo -e "${RED}✗ BUILD ARTIFACTS VERIFICATION FAILED${NC}"
    echo -e "${RED}  Critical failures detected: $CRITICAL_FAILURES${NC}"
    echo -e "${RED}  The application will not start successfully${NC}"
    echo ""
    echo "❌ PACKAGING SHOULD NOT PROCEED"
    echo ""
    echo "Required actions:"
    echo "1. Run 'npm run build:clean' to clean build artifacts"
    echo "2. Run 'npm run build:ts' to rebuild TypeScript"
    echo "3. Run 'npm run build:swift' to rebuild Swift components"
    echo "4. Re-run this verification"
    
    report_error "Critical build artifacts are missing or invalid"
    
elif [ "$FAILED_CHECKS" -gt 0 ]; then
    echo -e "${YELLOW}⚠ BUILD ARTIFACTS HAVE ISSUES${NC}"
    echo -e "${YELLOW}  Non-critical issues detected: $FAILED_CHECKS${NC}"
    echo -e "${YELLOW}  The application may start but some features might not work${NC}"
    echo ""
    echo "⚠️  PACKAGING MAY PROCEED WITH CAUTION"
    echo ""
    echo "Recommended actions:"
    echo "1. Review the failed checks above"
    echo "2. Consider rebuilding affected components"
    echo "3. Test the application before distribution"
    
    exit 1
    
else
    echo -e "${GREEN}✅ BUILD ARTIFACTS VERIFICATION SUCCESSFUL${NC}"
    echo -e "${GREEN}  All required build artifacts are present and valid${NC}"
    echo ""
    echo "🚀 READY FOR PACKAGING"
    echo ""
    echo "All build artifacts are ready for electron-builder packaging."
    echo "The application should start successfully after packaging."
    
    exit 0
fi