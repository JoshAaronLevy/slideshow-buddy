#!/bin/bash

# Build Orchestrator Script
# Purpose: Master build coordination script
# Executes the full build pipeline with fail-fast error handling

set -e
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ELECTRON_ROOT="$(dirname "$SCRIPT_DIR")"
ERROR_REPORTER="$SCRIPT_DIR/build-error-reporter.sh"
CLEANUP_SCRIPT="$SCRIPT_DIR/build-cleanup.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Build step tracking
CURRENT_STEP=0
TOTAL_STEPS=7
START_TIME=$(date +%s)

echo -e "${BOLD}${CYAN}🚀 Starting Build Orchestration${NC}"
echo -e "${CYAN}===============================================${NC}"
echo "Build pipeline: Environment → Clean → Swift → TypeScript → Validation"
echo "Working directory: $ELECTRON_ROOT"
echo "Start time: $(date)"
echo ""

# Function to report step progress
report_step() {
    local step_name="$1"
    local step_description="$2"
    CURRENT_STEP=$((CURRENT_STEP + 1))
    
    echo ""
    echo -e "${BOLD}${BLUE}[$CURRENT_STEP/$TOTAL_STEPS] $step_name${NC}"
    echo -e "${BLUE}▶ $step_description${NC}"
    echo -e "${CYAN}-------------------------------------------${NC}"
}

# Function to report step success
report_step_success() {
    local step_name="$1"
    local duration="$2"
    echo -e "${GREEN}✅ $step_name completed successfully${NC}"
    echo -e "${GREEN}   Duration: ${duration}s${NC}"
}

# Function to handle build failure
handle_build_failure() {
    local failed_step="$1"
    local error_message="$2"
    local exit_code="${3:-1}"
    
    echo ""
    echo -e "${RED}${BOLD}💥 BUILD PIPELINE FAILED${NC}"
    echo -e "${RED}===============================================${NC}"
    echo -e "${RED}Failed Step: $failed_step${NC}"
    echo -e "${RED}Error: $error_message${NC}"
    echo ""
    
    # Calculate elapsed time
    local end_time=$(date +%s)
    local elapsed=$((end_time - START_TIME))
    echo -e "${YELLOW}Build failed after ${elapsed} seconds${NC}"
    echo ""
    
    # Run cleanup
    echo -e "${YELLOW}🧹 Running cleanup after failure...${NC}"
    if bash "$CLEANUP_SCRIPT"; then
        echo -e "${GREEN}✓ Workspace cleanup completed${NC}"
    else
        echo -e "${YELLOW}⚠ Cleanup completed with warnings${NC}"
    fi
    echo ""
    
    # Report error through error reporter
    bash "$ERROR_REPORTER" "$failed_step" "$error_message" "$exit_code"
}

# Function to execute build step with error handling
execute_step() {
    local step_name="$1"
    local step_command="$2"
    local step_description="$3"
    
    report_step "$step_name" "$step_description"
    
    local step_start=$(date +%s)
    
    # Execute the command and capture both exit code and output
    if eval "$step_command"; then
        local step_end=$(date +%s)
        local step_duration=$((step_end - step_start))
        report_step_success "$step_name" "$step_duration"
        return 0
    else
        local exit_code=$?
        local step_end=$(date +%s)
        local step_duration=$((step_end - step_start))
        
        echo -e "${RED}❌ $step_name failed after ${step_duration}s${NC}"
        handle_build_failure "$step_name" "Step execution failed" "$exit_code"
        return $exit_code
    fi
}

# Function to execute npm script with proper error handling
execute_npm_script() {
    local script_name="$1"
    local step_name="$2"
    local step_description="$3"
    
    # Check if script exists in package.json
    if ! npm run 2>/dev/null | grep -q "^  $script_name$"; then
        handle_build_failure "$step_name" "npm script '$script_name' not found in package.json" 1
        return 1
    fi
    
    execute_step "$step_name" "npm run $script_name" "$step_description"
}

# Function to execute shell script with proper error handling
execute_shell_script() {
    local script_path="$1"
    local step_name="$2"
    local step_description="$3"
    
    # Check if script exists and is executable
    if [ ! -f "$script_path" ]; then
        handle_build_failure "$step_name" "Script not found: $script_path" 1
        return 1
    fi
    
    if [ ! -x "$script_path" ]; then
        echo -e "${YELLOW}⚠ Script not executable, attempting to fix permissions...${NC}"
        chmod +x "$script_path" || {
            handle_build_failure "$step_name" "Cannot make script executable: $script_path" 1
            return 1
        }
    fi
    
    execute_step "$step_name" "bash '$script_path'" "$step_description"
}

# Change to electron directory
cd "$ELECTRON_ROOT" || {
    handle_build_failure "Directory Change" "Cannot change to electron directory: $ELECTRON_ROOT" 1
    exit 1
}

# Build Pipeline Execution
echo -e "${BOLD}Starting fail-fast build pipeline...${NC}"

# Step 1: Environment Validation
execute_shell_script "$SCRIPT_DIR/validate-build-env.sh" \
    "Environment Validation" \
    "Checking Node.js, npm, TypeScript, Swift, and project structure"

# Step 2: Clean Build
execute_npm_script "build:clean" \
    "Build Cleanup" \
    "Removing previous build and distribution artifacts"

# Step 3: Swift Build
execute_npm_script "build:swift" \
    "Swift Build" \
    "Compiling Swift native libraries and Photos integration"

# Step 4: Swift Verification
execute_shell_script "$SCRIPT_DIR/verify-swift-build.sh" \
    "Swift Verification" \
    "Verifying Swift build artifacts and native libraries"

# Step 5: TypeScript Build
execute_npm_script "build:ts" \
    "TypeScript Build" \
    "Compiling TypeScript source to JavaScript and running electron-rebuild"

# Step 6: TypeScript Verification
execute_shell_script "$SCRIPT_DIR/verify-ts-build.sh" \
    "TypeScript Verification" \
    "Verifying TypeScript compilation and critical entry points"

# Step 7: Final Artifact Validation
execute_shell_script "$SCRIPT_DIR/verify-build-artifacts.sh" \
    "Artifact Verification" \
    "Final validation of all build artifacts before packaging"

# Build Success
end_time=$(date +%s)
total_elapsed=$((end_time - START_TIME))

echo ""
echo -e "${BOLD}${GREEN}🎉 BUILD PIPELINE COMPLETED SUCCESSFULLY${NC}"
echo -e "${GREEN}===============================================${NC}"
echo -e "${GREEN}All build steps completed without errors${NC}"
echo -e "${GREEN}Total build time: ${total_elapsed} seconds${NC}"
echo -e "${GREEN}Build completed at: $(date)${NC}"
echo ""

echo -e "${BOLD}${CYAN}📦 Build Summary:${NC}"
echo -e "${CYAN}• Environment validation: ✅ Passed${NC}"
echo -e "${CYAN}• Build cleanup: ✅ Completed${NC}"
echo -e "${CYAN}• Swift compilation: ✅ Success${NC}"
echo -e "${CYAN}• Swift verification: ✅ Verified${NC}"
echo -e "${CYAN}• TypeScript compilation: ✅ Success${NC}"
echo -e "${CYAN}• TypeScript verification: ✅ Verified${NC}"
echo -e "${CYAN}• Artifact validation: ✅ Ready${NC}"
echo ""

echo -e "${BOLD}${GREEN}🚀 READY FOR PACKAGING${NC}"
echo -e "${GREEN}The application is ready for electron-builder packaging.${NC}"
echo -e "${GREEN}All critical files are present and validated:${NC}"
echo -e "${GREEN}  ✓ electron/index.js (entry point)${NC}"
echo -e "${GREEN}  ✓ build/src/index.js (compiled TypeScript)${NC}"
echo -e "${GREEN}  ✓ assets/libPhotosLibraryBridge.dylib (Swift native library)${NC}"
echo ""

echo -e "${CYAN}Next steps:${NC}"
echo -e "${CYAN}  1. Run packaging: npm run build:mac:reset-unsigned${NC}"
echo -e "${CYAN}  2. Test the packaged application${NC}"
echo -e "${CYAN}  3. Sign and distribute if tests pass${NC}"

exit 0