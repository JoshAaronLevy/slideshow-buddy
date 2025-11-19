#!/bin/bash

# Swift Build Verification Script
# Purpose: Verify Swift build completed successfully
# Checks Swift output files in electron/assets/

set -e
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ELECTRON_ROOT="$(dirname "$SCRIPT_DIR")"
ERROR_REPORTER="$SCRIPT_DIR/build-error-reporter.sh"
ASSETS_DIR="$ELECTRON_ROOT/assets"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Starting Swift build verification..."

# Function to report error and exit
report_error() {
    local error_msg="$1"
    echo -e "${RED}✗ $error_msg${NC}"
    bash "$ERROR_REPORTER" "Swift Verification" "$error_msg" 1
}

# Function to report success
report_success() {
    local success_msg="$1"
    echo -e "${GREEN}✓ $success_msg${NC}"
}

# Function to check if file was modified within last N minutes
is_recently_modified() {
    local file="$1"
    local minutes="${2:-5}"  # Default to 5 minutes
    
    if [ ! -f "$file" ]; then
        return 1
    fi
    
    # Get current time and file modification time in seconds since epoch
    local current_time=$(date +%s)
    local file_time=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null)
    local time_diff=$((current_time - file_time))
    local max_age=$((minutes * 60))
    
    [ "$time_diff" -le "$max_age" ]
}

# Function to get human readable time since modification
get_time_since_modification() {
    local file="$1"
    
    if [ ! -f "$file" ]; then
        echo "File not found"
        return
    fi
    
    local current_time=$(date +%s)
    local file_time=$(stat -f %m "$file" 2>/dev/null || stat -c %Y "$file" 2>/dev/null)
    local time_diff=$((current_time - file_time))
    
    if [ "$time_diff" -lt 60 ]; then
        echo "${time_diff} seconds ago"
    elif [ "$time_diff" -lt 3600 ]; then
        echo "$((time_diff / 60)) minutes ago"
    else
        echo "$((time_diff / 3600)) hours ago"
    fi
}

# Check if assets directory exists
if [ ! -d "$ASSETS_DIR" ]; then
    report_error "Assets directory not found: $ASSETS_DIR"
fi

echo "Checking Swift build outputs in: $ASSETS_DIR"

# Define expected Swift output files
EXPECTED_FILES=("libPhotosLibraryBridge.dylib")
FAILED_CHECKS=0

# Check each expected file
for file in "${EXPECTED_FILES[@]}"; do
    file_path="$ASSETS_DIR/$file"
    
    echo ""
    echo "Checking: $file"
    
    # Check if file exists
    if [ ! -f "$file_path" ]; then
        echo -e "${RED}✗ File not found: $file_path${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        continue
    fi
    
    report_success "File exists: $file"
    
    # Check if file is not empty
    file_size=$(stat -f %z "$file_path" 2>/dev/null || stat -c %s "$file_path" 2>/dev/null)
    if [ "$file_size" -eq 0 ]; then
        echo -e "${RED}✗ File is empty (0 bytes): $file${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        continue
    fi
    
    report_success "File size: $file_size bytes"
    
    # Check modification timestamp (within last 5 minutes)
    modification_time=$(get_time_since_modification "$file_path")
    echo "Last modified: $modification_time"
    
    if ! is_recently_modified "$file_path" 5; then
        echo -e "${YELLOW}⚠ File was not recently modified: $file${NC}"
        echo -e "${YELLOW}  This may indicate the Swift build didn't run or failed${NC}"
        FAILED_CHECKS=$((FAILED_CHECKS + 1))
        continue
    fi
    
    report_success "File was recently modified (within 5 minutes)"
    
    # Additional checks for dynamic libraries
    if [[ "$file" == *.dylib ]]; then
        # Check if it's a valid Mach-O file (macOS dynamic library)
        if command -v file &> /dev/null; then
            file_type=$(file "$file_path")
            if [[ "$file_type" == *"Mach-O"* ]] || [[ "$file_type" == *"dynamically linked shared library"* ]]; then
                report_success "Valid dynamic library format"
            else
                echo -e "${RED}✗ Invalid dynamic library format: $file${NC}"
                echo "File type: $file_type"
                FAILED_CHECKS=$((FAILED_CHECKS + 1))
                continue
            fi
        fi
        
        # Check if library has required symbols (basic check)
        if command -v nm &> /dev/null; then
            if nm "$file_path" &> /dev/null; then
                symbol_count=$(nm "$file_path" | wc -l | tr -d ' ')
                report_success "Library contains $symbol_count symbols"
            else
                echo -e "${YELLOW}⚠ Could not read symbols from: $file${NC}"
            fi
        fi
    fi
done

# Summary
echo ""
if [ "$FAILED_CHECKS" -eq 0 ]; then
    echo -e "${GREEN}✓ Swift build verification completed successfully${NC}"
    echo "All expected Swift build artifacts are present and valid"
    exit 0
else
    echo -e "${RED}✗ Swift build verification failed${NC}"
    echo "Failed checks: $FAILED_CHECKS"
    echo ""
    echo "Missing or invalid Swift build artifacts detected."
    echo "Run 'npm run build:swift' to rebuild Swift components."
    report_error "$FAILED_CHECKS Swift build artifacts are missing or invalid"
fi