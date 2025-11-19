#!/bin/bash

# TypeScript Build Verification Script
# Purpose: Verify TypeScript compilation completed successfully
# Checks build/ directory and compiled JavaScript files

set -e
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ELECTRON_ROOT="$(dirname "$SCRIPT_DIR")"
ERROR_REPORTER="$SCRIPT_DIR/build-error-reporter.sh"
BUILD_DIR="$ELECTRON_ROOT/build"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Starting TypeScript build verification..."

# Function to report error and exit
report_error() {
    local error_msg="$1"
    echo -e "${RED}✗ $error_msg${NC}"
    bash "$ERROR_REPORTER" "TypeScript Verification" "$error_msg" 1
}

# Function to report success
report_success() {
    local success_msg="$1"
    echo -e "${GREEN}✓ $success_msg${NC}"
}

# Function to check if file was modified recently
is_recently_modified() {
    local file="$1"
    local minutes="${2:-10}"  # Default to 10 minutes for TypeScript builds
    
    if [ ! -f "$file" ]; then
        return 1
    fi
    
    local current_time=$(date +%s)
    local file_time=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null)
    local time_diff=$((current_time - file_time))
    local max_age=$((minutes * 60))
    
    [ "$time_diff" -le "$max_age" ]
}

# Function to get human readable file size
get_file_size() {
    local file="$1"
    if [ ! -f "$file" ]; then
        echo "File not found"
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

# Check if build directory exists
if [ ! -d "$BUILD_DIR" ]; then
    report_error "Build directory not found: $BUILD_DIR. Run 'npm run build:ts' to compile TypeScript"
fi

echo "Checking TypeScript build outputs in: $BUILD_DIR"

# Define expected compiled files (critical files for the application)
CRITICAL_FILES=("src/index.js")
EXPECTED_FILES=("src/index.js" "src/menu.js" "src/preload.js" "src/setup.js")
FAILED_CHECKS=0
MISSING_CRITICAL=0

# Check critical files first (these are absolutely required)
echo ""
echo "=== Checking Critical Files ==="
for file in "${CRITICAL_FILES[@]}"; do
    file_path="$BUILD_DIR/$file"
    
    echo ""
    echo "Checking CRITICAL: $file"
    
    if [ ! -f "$file_path" ]; then
        echo -e "${RED}✗ CRITICAL FILE NOT FOUND: $file_path${NC}"
        echo -e "${RED}  This file is required by electron/index.js${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        MISSING_CRITICAL=$((MISSING_CRITICAL + 1))
        continue
    fi
    
    report_success "Critical file exists: $file"
    
    # Check file size
    file_size=$(get_file_size "$file_path")
    actual_size=$(stat -f %z "$file_path" 2>/dev/null || stat -c %s "$file_path" 2>/dev/null)
    
    if [ "$actual_size" -eq 0 ]; then
        echo -e "${RED}✗ CRITICAL FILE IS EMPTY: $file${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        MISSING_CRITICAL=$((MISSING_CRITICAL + 1))
        continue
    fi
    
    report_success "File size: $file_size"
    
    # Check if it's valid JavaScript (basic syntax check)
    if command -v node &> /dev/null; then
        if ! node -c "$file_path" 2>/dev/null; then
            echo -e "${RED}✗ CRITICAL FILE HAS SYNTAX ERRORS: $file${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            MISSING_CRITICAL=$((MISSING_CRITICAL + 1))
            continue
        fi
        report_success "JavaScript syntax is valid"
    fi
done

# Check other expected files
echo ""
echo "=== Checking Additional Expected Files ==="
for file in "${EXPECTED_FILES[@]}"; do
    # Skip if already checked in critical files
    if [[ " ${CRITICAL_FILES[@]} " =~ " ${file} " ]]; then
        continue
    fi
    
    file_path="$BUILD_DIR/$file"
    
    echo ""
    echo "Checking: $file"
    
    if [ ! -f "$file_path" ]; then
        echo -e "${YELLOW}⚠ Expected file not found: $file_path${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        continue
    fi
    
    report_success "File exists: $file"
    
    # Check file size
    file_size=$(get_file_size "$file_path")
    actual_size=$(stat -f %z "$file_path" 2>/dev/null || stat -c %s "$file_path" 2>/dev/null)
    
    if [ "$actual_size" -eq 0 ]; then
        echo -e "${YELLOW}⚠ File is empty: $file${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        continue
    fi
    
    report_success "File size: $file_size"
    
    # Check if it's valid JavaScript
    if command -v node &> /dev/null; then
        if ! node -c "$file_path" 2>/dev/null; then
            echo -e "${YELLOW}⚠ File has syntax errors: $file${NC}"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            continue
        fi
        report_success "JavaScript syntax is valid"
    fi
done

# Check that no TypeScript source files exist in build directory
echo ""
echo "=== Checking for TypeScript Source Files in Build Directory ==="
TS_FILES_IN_BUILD=$(find "$BUILD_DIR" -name "*.ts" 2>/dev/null | wc -l | tr -d ' ')

if [ "$TS_FILES_IN_BUILD" -gt 0 ]; then
    echo -e "${YELLOW}⚠ Found $TS_FILES_IN_BUILD TypeScript files in build directory:${NC}"
    find "$BUILD_DIR" -name "*.ts" 2>/dev/null | while read -r ts_file; do
        echo -e "${YELLOW}  - $ts_file${NC}"
    done
    echo -e "${YELLOW}  TypeScript files should only be in src/, not build/${NC}"
    FAILED_CHECKS=$((FAILED_CHECKS + 1))
else
    report_success "No TypeScript source files found in build directory"
fi

# Check for common TypeScript compilation artifacts
echo ""
echo "=== Checking Build Artifacts ==="

# Check for source maps (optional but good practice)
SOURCE_MAPS=$(find "$BUILD_DIR" -name "*.js.map" 2>/dev/null | wc -l | tr -d ' ')
if [ "$SOURCE_MAPS" -gt 0 ]; then
    report_success "Found $SOURCE_MAPS source map files for debugging"
else
    echo -e "${YELLOW}⚠ No source map files found (consider enabling sourceMap in tsconfig.json)${NC}"
fi

# Check if build is recent
if [ -d "$BUILD_DIR" ]; then
    if is_recently_modified "$BUILD_DIR/src/index.js" 10; then
        report_success "Build appears to be recent (within 10 minutes)"
    else
        echo -e "${YELLOW}⚠ Build may be stale (last modified more than 10 minutes ago)${NC}"
    fi
fi

# Summary
echo ""
echo "=== Build Verification Summary ==="
if [ "$MISSING_CRITICAL" -gt 0 ]; then
    echo -e "${RED}✗ CRITICAL: $MISSING_CRITICAL critical files are missing or invalid${NC}"
    echo -e "${RED}  The application will fail to start without these files${NC}"
    echo ""
    echo "Critical missing files prevent application startup."
    echo "Run 'npm run build:ts' to rebuild TypeScript components."
    report_error "Critical TypeScript build artifacts are missing"
elif [ "$FAILED_CHECKS" -gt 0 ]; then
    echo -e "${YELLOW}⚠ TypeScript build has $FAILED_CHECKS issues${NC}"
    echo -e "${YELLOW}  Critical files are present but other issues detected${NC}"
    echo ""
    echo "Consider rebuilding: npm run build:ts"
    exit 1
else
    echo -e "${GREEN}✓ TypeScript build verification completed successfully${NC}"
    echo "All required TypeScript build artifacts are present and valid"
    exit 0
fi