#!/bin/bash

# Build Error Reporter Script
# Purpose: Centralized error reporting for the build process
# Usage: ./build-error-reporter.sh <step_name> <error_message> <exit_code>

set -e
set -u

# Check if we have the required parameters
if [ $# -ne 3 ]; then
    echo "Usage: $0 <step_name> <error_message> <exit_code>"
    exit 1
fi

STEP_NAME="$1"
ERROR_MESSAGE="$2"
EXIT_CODE="$3"

# Function to generate troubleshooting guidance based on step
generate_troubleshooting() {
    case "$STEP_NAME" in
        "Environment Validation")
            echo "- Ensure Node.js (>= 18) is installed: node --version"
            echo "- Install dependencies: npm install"
            echo "- Verify TypeScript is available: npx tsc --version"
            echo "- Verify Swift is available: swiftc --version"
            ;;
        "Swift Build")
            echo "- Check Swift source files in electron/src/native/"
            echo "- Verify Xcode command line tools: xcode-select --install"
            echo "- Review build-swift.sh script for errors"
            echo "- Check libPhotosLibraryBridge.dylib compilation"
            ;;
        "TypeScript Build")
            echo "- Verify tsconfig.json configuration"
            echo "- Check for TypeScript syntax errors: npx tsc --noEmit"
            echo "- Ensure src/ directory exists and contains .ts files"
            echo "- Clean build directory: npm run build:clean"
            ;;
        "Swift Verification")
            echo "- Run Swift build again: npm run build:swift"
            echo "- Check electron/assets/libPhotosLibraryBridge.dylib exists"
            echo "- Verify file permissions on assets directory"
            ;;
        "TypeScript Verification")
            echo "- Run TypeScript build again: npm run build:ts"
            echo "- Check app/src/index.js exists"
            echo "- Verify all TypeScript files compiled successfully"
            ;;
        "Artifact Verification")
            echo "- Run full build process: npm run build"
            echo "- Check both Swift and TypeScript outputs"
            echo "- Verify all required files are present"
            ;;
        *)
            echo "- Check the specific error message above"
            echo "- Run build:clean and try again"
            echo "- Review build logs for more details"
            ;;
    esac
}

# Print standardized error format
echo "==============================================="
echo "BUILD FAILED: $STEP_NAME"
echo "==============================================="
echo "Error: $ERROR_MESSAGE"
echo "Exit Code: $EXIT_CODE"
echo ""
echo "Troubleshooting:"
generate_troubleshooting
echo "==============================================="

# Always exit with the provided exit code
exit "$EXIT_CODE"