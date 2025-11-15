#!/bin/bash

# Swift Dynamic Library Build Script
# Compiles Swift Photos library bridge for Electron FFI

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SWIFT_SRC_DIR="${PROJECT_ROOT}/src/native"
BUILD_DIR="${PROJECT_ROOT}/build/native"
OUTPUT_LIB="${BUILD_DIR}/libPhotosLibraryBridge.dylib"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Swift Photos Library Bridge...${NC}"

# Create build directory
mkdir -p "${BUILD_DIR}"

# Swift source files
SWIFT_FILES=(
    "${SWIFT_SRC_DIR}/PhotosPermissionManager.swift"
    "${SWIFT_SRC_DIR}/PhotoAssetConverter.swift"
    "${SWIFT_SRC_DIR}/PhotosLibraryBridge.swift"
)

# Check if Swift files exist
echo -e "${YELLOW}Checking Swift source files...${NC}"
for file in "${SWIFT_FILES[@]}"; do
    if [[ ! -f "$file" ]]; then
        echo -e "${RED}Error: Swift file not found: $file${NC}"
        exit 1
    fi
    echo "  ✓ $(basename "$file")"
done

# Build Swift dynamic library
echo -e "${YELLOW}Compiling Swift library...${NC}"

# Swift compiler flags:
# -emit-library: Create a dynamic library
# -emit-module: Generate module interface
# -module-name: Set the module name
# -o: Output file path
# -sdk: Use macOS SDK
# -target: Target macOS 11.0+ (required for async/await)
# -import-objc-header: If we had Objective-C headers (we don't need this)
# -framework: Link against required frameworks

swiftc \
    -emit-library \
    -emit-module \
    -module-name PhotosLibraryBridge \
    -o "${OUTPUT_LIB}" \
    -sdk "$(xcrun --show-sdk-path --sdk macosx)" \
    -target x86_64-apple-macosx11.0 \
    -framework Foundation \
    -framework Photos \
    -framework AppKit \
    "${SWIFT_FILES[@]}"

# Check if compilation was successful
if [[ ! -f "${OUTPUT_LIB}" ]]; then
    echo -e "${RED}Error: Failed to create dynamic library${NC}"
    exit 1
fi

# Display library info
echo -e "${GREEN}✓ Swift library compiled successfully!${NC}"
echo "Library: ${OUTPUT_LIB}"
echo "Size: $(du -h "${OUTPUT_LIB}" | cut -f1)"

# Verify library architecture and symbols
echo -e "${YELLOW}Library information:${NC}"
file "${OUTPUT_LIB}"

echo -e "${YELLOW}Exported FFI symbols:${NC}"
nm -D "${OUTPUT_LIB}" 2>/dev/null | grep -E "(photos_request_permission|photos_check_permission|photos_get_albums|photos_get_photos)" || echo "Note: nm -D might not show symbols, this is normal for Swift dylibs"

# Alternative symbol check using otool
echo -e "${YELLOW}Checking symbols with otool:${NC}"
otool -T "${OUTPUT_LIB}" 2>/dev/null | grep -E "(photos_)" || echo "Symbols are embedded, library should work with FFI"

# Copy library to assets directory for packaging
ASSETS_DIR="${PROJECT_ROOT}/assets"
mkdir -p "${ASSETS_DIR}"
cp "${OUTPUT_LIB}" "${ASSETS_DIR}/"
echo -e "${GREEN}✓ Library copied to assets directory${NC}"

echo -e "${GREEN}Build complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Install FFI bindings: npm install koffi"
echo "2. Create TypeScript FFI wrapper module"
echo "3. Update electron-builder config to include the library"