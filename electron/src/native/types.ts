/**
 * TypeScript definitions for Swift Photos Library FFI
 * Defines interfaces for FFI function signatures and return types
 */

// Raw FFI function signatures (what koffi sees)
export interface SwiftPhotosLibraryFFI {
  // Permission functions
  photos_request_permission: () => string;
  photos_check_permission: () => string;
  
  // Data retrieval functions  
  photos_get_albums: () => string;
  photos_get_photos: (albumId: string | null, quantity: number) => string;
}

// High-level TypeScript interfaces for parsed JSON responses
export interface PhotoAlbum {
  identifier: string;
  name: string;
  type: string;
  count: number;
}

export interface Photo {
  identifier: string;
  filename: string;
  creationDate: string;
  modificationDate?: string;
  width: number;
  height: number;
  thumbnailData?: string; // Base64 encoded thumbnail
  isFavorite: boolean;
  mediaType: 'image' | 'video';
  mediaSubtypes: string[];
}

// API Response types (what we get back from Swift as JSON)
export interface PhotosPermissionResponse {
  granted: boolean;
  error?: string;
}

export interface PhotoAlbumsResponse {
  albums: PhotoAlbum[];
  error?: string;
}

export interface PhotosResponse {
  photos: Photo[];
  error?: string;
}

// Error handling
export class PhotosLibraryError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = 'PhotosLibraryError';
  }
}

// Memory management types
export interface FFIStringResult {
  value: string;
  pointer: any; // koffi pointer type
}