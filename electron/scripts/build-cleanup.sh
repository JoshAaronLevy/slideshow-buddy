#!/bin/bash

# Build Cleanup Script
# Purpose: Cleanup on build failure - remove incomplete artifacts
# Preserves logs and leaves workspace in clean state for retry

set -u
# Note: NOT using "set -e" because cleanup should continue even if some operations fail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ELECTRON_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$ELECTRON_ROOT/app"
DIST_DIR="$ELECTRON_ROOT/dist"
LOGS_DIR="$ELECTRON_ROOT/logs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "Starting build cleanup..."

# Function to report cleanup action
report_cleanup() {
    local action="$1"
    echo -e "${BLUE}🧹 $action${NC}"
}

# Function to report success
report_success() {
    local success_msg="$1"
    echo -e "${GREEN}✓ $success_msg${NC}"
}

# Function to report warning (non-critical issues)
report_warning() {
    local warning_msg="$1"
    echo -e "${YELLOW}⚠ $warning_msg${NC}"
}

# Function to safely remove directory
safe_remove_directory() {
    local dir="$1"
    local description="$2"
    
    if [ ! -d "$dir" ]; then
        echo "  Directory not found: $dir (nothing to clean)"
        return 0
    fi
    
    report_cleanup "Removing $description: $dir"
    
    # Check if directory is empty first
    if [ -z "$(ls -A "$dir" 2>/dev/null)" ]; then
        rmdir "$dir" 2>/dev/null || {
            report_warning "Could not remove empty directory: $dir"
            return 1
        }
        report_success "Removed empty $description directory"
        return 0
    fi
    
    # Directory has contents, remove recursively
    local item_count=0
    if command -v find >/dev/null 2>&1; then
        item_count=$(find "$dir" -type f | wc -l | tr -d ' ')
        echo "  Found $item_count files in $description directory"
    fi
    
    rm -rf "$dir" 2>/dev/null || {
        report_warning "Could not completely remove: $dir"
        # Try to remove contents at least
        find "$dir" -type f -delete 2>/dev/null || true
        return 1
    }
    
    report_success "Removed $description directory ($item_count files cleaned)"
    return 0
}

# Function to create logs directory if needed
ensure_logs_directory() {
    if [ ! -d "$LOGS_DIR" ]; then
        mkdir -p "$LOGS_DIR" 2>/dev/null || {
            report_warning "Could not create logs directory: $LOGS_DIR"
            return 1
        }
        report_success "Created logs directory: $LOGS_DIR"
    fi
    return 0
}

# Function to backup build logs if they exist
backup_build_logs() {
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_created=false
    
    ensure_logs_directory || return 1
    
    # Look for various log files that might exist
    local log_files=(
        "$ELECTRON_ROOT/npm-debug.log"
        "$ELECTRON_ROOT/package-lock.log" 
        "$BUILD_DIR/tsc.log"
        "$BUILD_DIR/compile.log"
        "$ELECTRON_ROOT/electron-builder.log"
    )
    
    for log_file in "${log_files[@]}"; do
        if [ -f "$log_file" ]; then
            local log_name=$(basename "$log_file")
            local backup_name="${timestamp}_${log_name}"
            local backup_path="$LOGS_DIR/$backup_name"
            
            if cp "$log_file" "$backup_path" 2>/dev/null; then
                report_success "Backed up log: $log_name → $backup_name"
                backup_created=true
            else
                report_warning "Could not backup log: $log_file"
            fi
        fi
    done
    
    # Check for TypeScript build logs in build directory
    if [ -d "$BUILD_DIR" ]; then
        find "$BUILD_DIR" -name "*.log" -type f 2>/dev/null | while read -r log_file; do
            if [ -f "$log_file" ]; then
                local log_name=$(basename "$log_file")
                local rel_path=${log_file#$BUILD_DIR/}
                local backup_name="${timestamp}_build_${rel_path//\//_}"
                local backup_path="$LOGS_DIR/$backup_name"
                
                if cp "$log_file" "$backup_path" 2>/dev/null; then
                    report_success "Backed up build log: $rel_path → $backup_name"
                    backup_created=true
                fi
            fi
        done
    fi
    
    if [ "$backup_created" = true ]; then
        echo ""
        report_success "Build logs preserved in: $LOGS_DIR"
        echo "  Logs can be reviewed for debugging build failures"
    else
        echo "  No build logs found to backup"
    fi
}

# Function to clean npm cache issues
clean_npm_artifacts() {
    report_cleanup "Cleaning npm artifacts"
    
    # Remove package-lock.json if it exists (will be regenerated)
    if [ -f "$ELECTRON_ROOT/package-lock.json" ]; then
        # Only remove if it seems corrupted or from failed install
        if ! npm ls &>/dev/null 2>&1; then
            rm -f "$ELECTRON_ROOT/package-lock.json" 2>/dev/null || true
            report_success "Removed potentially corrupted package-lock.json"
        fi
    fi
    
    # Clean npm cache for this project specifically
    npm cache clean --force 2>/dev/null || {
        report_warning "Could not clean npm cache"
    }
}

# Main cleanup sequence
echo ""
echo "=== Build Cleanup Sequence ==="

# Step 1: Backup any existing logs
echo ""
echo "Step 1: Preserving build logs"
backup_build_logs

# Step 2: Remove incomplete app directory
echo ""
echo "Step 2: Cleaning build artifacts"
safe_remove_directory "$BUILD_DIR" "TypeScript app"

# Step 3: Remove incomplete dist directory  
echo ""
echo "Step 3: Cleaning distribution artifacts"
safe_remove_directory "$DIST_DIR" "distribution"

# Step 4: Clean npm related artifacts if needed
echo ""
echo "Step 4: Cleaning npm artifacts"
clean_npm_artifacts

# Step 5: Remove any temporary files
echo ""
echo "Step 5: Cleaning temporary files"
temp_files=(
    "$ELECTRON_ROOT/.tmp"
    "$ELECTRON_ROOT/tmp"
    "$ELECTRON_ROOT/*.tmp"
    "$ELECTRON_ROOT/*.temp"
)

for pattern in "${temp_files[@]}"; do
    # Use shell globbing to find matching files/dirs
    for item in $pattern; do
        [ -e "$item" ] || continue  # Skip non-existent files
        if [ -f "$item" ]; then
            rm -f "$item" 2>/dev/null && report_success "Removed temporary file: $(basename "$item")"
        elif [ -d "$item" ]; then
            rm -rf "$item" 2>/dev/null && report_success "Removed temporary directory: $(basename "$item")"
        fi
    done
done

# Step 6: Verify clean state
echo ""
echo "Step 6: Verifying clean state"

clean_state=true

if [ -d "$BUILD_DIR" ]; then
    report_warning "Build directory still exists: $BUILD_DIR"
    clean_state=false
fi

if [ -d "$DIST_DIR" ]; then
    report_warning "Distribution directory still exists: $DIST_DIR"  
    clean_state=false
fi

# Check for any remaining artifacts that might cause issues
remaining_artifacts=$(find "$ELECTRON_ROOT" -maxdepth 2 -name "*.log" -o -name "*.tmp" -o -name ".tmp" 2>/dev/null | wc -l | tr -d ' ')
if [ "$remaining_artifacts" -gt 0 ]; then
    report_warning "Found $remaining_artifacts remaining temporary artifacts"
    clean_state=false
fi

# Final summary
echo ""
echo "=== Cleanup Summary ==="

if [ "$clean_state" = true ]; then
    echo -e "${GREEN}✅ Workspace cleanup completed successfully${NC}"
    echo -e "${GREEN}  Build environment is ready for fresh build attempt${NC}"
    echo ""
    echo "📁 Workspace is now clean:"
    echo "  • Build artifacts removed"
    echo "  • Distribution artifacts removed" 
    echo "  • Temporary files cleaned"
    echo "  • Logs preserved for debugging"
    echo ""
    echo "🔄 Ready for build retry"
else
    echo -e "${YELLOW}⚠️ Workspace cleanup completed with warnings${NC}"
    echo -e "${YELLOW}   Some artifacts could not be completely removed${NC}"
    echo ""
    echo "🔍 Manual cleanup may be needed for:"
    echo "  • Check file permissions in electron directory"
    echo "  • Verify no processes are using build files"
    echo "  • Consider restarting terminal/IDE if issues persist"
fi

echo ""
echo "Build cleanup script completed"

# Always exit 0 - cleanup failures shouldn't fail the overall build process
# The goal is to get the workspace as clean as possible for retry
exit 0