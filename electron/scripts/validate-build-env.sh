#!/bin/bash

# Build Environment Validation Script
# Purpose: Pre-build environment validation
# Checks Node.js, npm deps, TypeScript, Swift, and required directories

set -e
set -u

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ELECTRON_ROOT="$(dirname "$SCRIPT_DIR")"
ERROR_REPORTER="$SCRIPT_DIR/build-error-reporter.sh"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Starting build environment validation..."

# Function to report error and exit
report_error() {
    local error_msg="$1"
    echo -e "${RED}✗ $error_msg${NC}"
    bash "$ERROR_REPORTER" "Environment Validation" "$error_msg" 1
}

# Function to report success
report_success() {
    local success_msg="$1"
    echo -e "${GREEN}✓ $success_msg${NC}"
}

# Function to report warning
report_warning() {
    local warning_msg="$1"
    echo -e "${YELLOW}⚠ $warning_msg${NC}"
}

# Check Node.js version
echo "Checking Node.js version..."
if ! command -v node &> /dev/null; then
    report_error "Node.js is not installed or not in PATH"
fi

NODE_VERSION=$(node --version | sed 's/v//')
MAJOR_VERSION=$(echo "$NODE_VERSION" | cut -d. -f1)

if [ "$MAJOR_VERSION" -lt 18 ]; then
    report_error "Node.js version $NODE_VERSION is too old. Requires >= 18.0.0"
fi

report_success "Node.js version $NODE_VERSION is compatible"

# Check npm is available
echo "Checking npm availability..."
if ! command -v npm &> /dev/null; then
    report_error "npm is not installed or not in PATH"
fi

NPM_VERSION=$(npm --version)
report_success "npm version $NPM_VERSION is available"

# Check if we're in the electron directory
if [ ! -f "$ELECTRON_ROOT/package.json" ]; then
    report_error "package.json not found. Ensure script is run from electron directory"
fi

# Check npm dependencies are installed
echo "Checking npm dependencies..."
if [ ! -d "$ELECTRON_ROOT/node_modules" ]; then
    report_error "node_modules directory not found. Run 'npm install' first"
fi

# Check for critical dependencies in node_modules
CRITICAL_DEPS=("typescript" "electron" "electron-builder")
for dep in "${CRITICAL_DEPS[@]}"; do
    if [ ! -d "$ELECTRON_ROOT/node_modules/$dep" ]; then
        report_error "Critical dependency '$dep' not found in node_modules. Run 'npm install'"
    fi
done

report_success "npm dependencies are installed"

# Check TypeScript compiler
echo "Checking TypeScript compiler..."
if ! command -v npx &> /dev/null; then
    report_error "npx is not available"
fi

# Check TypeScript via npx tsc
if ! npx tsc --version &> /dev/null; then
    report_error "TypeScript compiler not available. Install with 'npm install typescript'"
fi

TSC_VERSION=$(npx tsc --version)
report_success "$TSC_VERSION is available"

# Check Swift compiler (macOS only)
echo "Checking Swift compiler..."
if ! command -v swiftc &> /dev/null; then
    report_error "Swift compiler not found. Install Xcode command line tools: 'xcode-select --install'"
fi

SWIFT_VERSION=$(swiftc --version | head -n 1)
report_success "$SWIFT_VERSION is available"

# Check required directories exist
echo "Checking required directories..."
REQUIRED_DIRS=("src" "scripts" "assets")
for dir in "${REQUIRED_DIRS[@]}"; do
    if [ ! -d "$ELECTRON_ROOT/$dir" ]; then
        report_error "Required directory '$dir' not found in electron root"
    fi
    report_success "Directory '$dir' exists"
done

# Check critical source files exist
echo "Checking critical source files..."
CRITICAL_FILES=("src/index.ts" "tsconfig.json")
for file in "${CRITICAL_FILES[@]}"; do
    if [ ! -f "$ELECTRON_ROOT/$file" ]; then
        report_error "Critical file '$file' not found"
    fi
    report_success "File '$file' exists"
done

# Check TypeScript configuration
echo "Validating TypeScript configuration..."
if ! npx tsc --noEmit > /dev/null 2>&1; then
    report_warning "TypeScript compilation check failed. There may be syntax errors"
    # Don't fail here, let the actual build catch TypeScript errors
else
    report_success "TypeScript configuration is valid"
fi

echo ""
echo -e "${GREEN}✓ Build environment validation completed successfully${NC}"
echo "Environment is ready for build process"

exit 0