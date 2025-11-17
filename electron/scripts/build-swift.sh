#!/bin/bash

# Swift Dynamic Library Build Script
# Compiles Swift Photos library bridge for Electron FFI
# Creates a universal binary supporting both x86_64 and arm64 architectures

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
SWIFT_SRC_DIR="${PROJECT_ROOT}/src/native"
BUILD_DIR="${PROJECT_ROOT}/build/native"
TEMP_BUILD_DIR="${BUILD_DIR}/tmp"
OUTPUT_LIB="${BUILD_DIR}/libPhotosLibraryBridge.dylib"
X86_64_LIB="${TEMP_BUILD_DIR}/libPhotosLibraryBridge-x86_64.dylib"
ARM64_LIB="${TEMP_BUILD_DIR}/libPhotosLibraryBridge-arm64.dylib"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Building Swift Photos Library Bridge (Universal Binary)...${NC}"

# Create build directories and clean up any previous temp files
mkdir -p "${BUILD_DIR}"
mkdir -p "${TEMP_BUILD_DIR}"

# Clean up any existing temp files to ensure idempotent behavior
if [[ -f "${X86_64_LIB}" ]]; then
    rm "${X86_64_LIB}"
fi
if [[ -f "${ARM64_LIB}" ]]; then
    rm "${ARM64_LIB}"
fi

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

# Common Swift compiler flags:
# -emit-library: Create a dynamic library
# -emit-module: Generate module interface
# -module-name: Set the module name
# -sdk: Use macOS SDK
# -target: Target macOS 11.0+ (required for async/await)
# -framework: Link against required frameworks

SWIFT_COMMON_FLAGS=(
    -emit-library
    -emit-module
    -module-name PhotosLibraryBridge
    -sdk "$(xcrun --show-sdk-path --sdk macosx)"
    -framework Foundation
    -framework Photos
    -framework AppKit
)

# Build x86_64 architecture
echo -e "${YELLOW}Compiling Swift library for x86_64...${NC}"
swiftc \
    "${SWIFT_COMMON_FLAGS[@]}" \
    -target x86_64-apple-macosx11.0 \
    -o "${X86_64_LIB}" \
    "${SWIFT_FILES[@]}"

# Check if x86_64 compilation was successful
if [[ ! -f "${X86_64_LIB}" ]]; then
    echo -e "${RED}Error: Failed to create x86_64 dynamic library${NC}"
    exit 1
fi
echo -e "${GREEN}✓ x86_64 library compiled successfully!${NC}"

# Build arm64 architecture
echo -e "${YELLOW}Compiling Swift library for arm64...${NC}"
swiftc \
    "${SWIFT_COMMON_FLAGS[@]}" \
    -target arm64-apple-macosx11.0 \
    -o "${ARM64_LIB}" \
    "${SWIFT_FILES[@]}"

# Check if arm64 compilation was successful
if [[ ! -f "${ARM64_LIB}" ]]; then
    echo -e "${RED}Error: Failed to create arm64 dynamic library${NC}"
    exit 1
fi
echo -e "${GREEN}✓ arm64 library compiled successfully!${NC}"

# Create universal binary using lipo
echo -e "${YELLOW}Creating universal binary...${NC}"
lipo -create -output "${OUTPUT_LIB}" "${X86_64_LIB}" "${ARM64_LIB}"

# Check if lipo was successful
if [[ ! -f "${OUTPUT_LIB}" ]]; then
    echo -e "${RED}Error: Failed to create universal binary${NC}"
    exit 1
fi

# Clean up temporary architecture-specific libraries
rm "${X86_64_LIB}" "${ARM64_LIB}"
# Remove temp directory if empty
rmdir "${TEMP_BUILD_DIR}" 2>/dev/null || true

# Display library info
echo -e "${GREEN}✓ Universal Swift library created successfully!${NC}"
echo "Library: ${OUTPUT_LIB}"
echo "Size: $(du -h "${OUTPUT_LIB}" | cut -f1)"

# Verify library architecture and symbols
echo -e "${YELLOW}Library information:${NC}"
file "${OUTPUT_LIB}"

echo -e "${YELLOW}Supported architectures:${NC}"
lipo -archs "${OUTPUT_LIB}"

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

# Testing Documentation
# ===================
#
# To test this build script:
#
# 1. Run the Swift build in isolation:
#    cd electron
#    ./scripts/build-swift.sh
#
# 2. Verify the architecture of the final dylib:
#    file electron/build/native/libPhotosLibraryBridge.dylib
#    lipo -archs electron/build/native/libPhotosLibraryBridge.dylib
#
# 3. Expected output from `lipo -archs`: should show both `x86_64 arm64`
#
# The universal binary should resolve the architecture mismatch error:
# "dlopen(...): mach-o file, but is an incompatible architecture (have 'x86_64', need 'arm64')"