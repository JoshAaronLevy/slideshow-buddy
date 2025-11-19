"use strict";
/**
 * TypeScript definitions for Swift Photos Library FFI
 * Defines interfaces for FFI function signatures and return types
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PhotosLibraryError = void 0;
// Error handling
class PhotosLibraryError extends Error {
    constructor(message, code) {
        super(message);
        this.code = code;
        this.name = 'PhotosLibraryError';
    }
}
exports.PhotosLibraryError = PhotosLibraryError;
