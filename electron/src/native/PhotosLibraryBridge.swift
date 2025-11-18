import Foundation
import Photos
import AppKit

/**
 * PhotosLibraryBridge - Main bridge class for accessing macOS Photos Library
 * Provides interface between Electron main process and native PHPhotoLibrary framework
 */
@objc public class PhotosLibraryBridge: NSObject {
    
    private let permissionManager = PhotosPermissionManager()
    private let assetConverter = PhotoAssetConverter()
    
    // MARK: - Public Bridge Methods
    
    /**
     * Request permission to access the photo library
     * Returns: Bool indicating if permission was granted
     */
    @objc public func requestPermission() async -> Bool {
        return await permissionManager.requestPermission()
    }
    
    /**
     * Check current photo library permission status
     * Returns: Bool indicating if permission is granted
     */
    @objc public func checkPermission() -> Bool {
        return permissionManager.checkPermission()
    }
    
    /**
     * Get photo albums from the library
     * Returns: JSON string containing array of PhotoAlbum objects
     */
    @objc public func getAlbums() async -> String {
        guard checkPermission() else {
            return createErrorResponse("Permission denied")
        }
        
        do {
            let albums = await fetchAlbums()
            let albumsData = albums.map { album in
                return [
                    "identifier": album.localIdentifier,
                    "name": getAlbumName(album),
                    "type": getAlbumType(album),
                    "count": album.estimatedAssetCount
                ]
            }
            
            let jsonData = try JSONSerialization.data(withJSONObject: albumsData)
            return String(data: jsonData, encoding: .utf8) ?? "[]"
        } catch {
            return createErrorResponse("Failed to fetch albums: \(error.localizedDescription)")
        }
    }
    
    /**
     * Get photos from a specific album or all photos
     * albumIdentifier: Optional album ID (nil for all photos)
     * quantity: Maximum number of photos to fetch
     * Returns: JSON string containing array of Photo objects
     */
    @objc public func getPhotos(fromAlbum albumIdentifier: String?, quantity: Int) async -> String {
        guard checkPermission() else {
            return createErrorResponse("Permission denied")
        }
        
        do {
            let assets = await fetchAssets(fromAlbum: albumIdentifier, quantity: quantity)
            let photos = await assetConverter.convertAssets(assets)
            
            let jsonData = try JSONSerialization.data(withJSONObject: photos)
            return String(data: jsonData, encoding: .utf8) ?? "[]"
        } catch {
            return createErrorResponse("Failed to fetch photos: \(error.localizedDescription)")
        }
    }
    
    // MARK: - Private Helper Methods
    
    private func fetchAlbums() async -> [PHAssetCollection] {
        return await withCheckedContinuation { continuation in
            var albums: [PHAssetCollection] = []
            
            // Fetch "All Photos" smart album
            let allPhotosOptions = PHFetchOptions()
            allPhotosOptions.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)
            let allPhotosAlbums = PHAssetCollection.fetchAssetCollections(
                with: .smartAlbum,
                subtype: .smartAlbumUserLibrary,
                options: nil
            )
            allPhotosAlbums.enumerateObjects { collection, _, _ in
                albums.append(collection)
            }
            
            // Fetch "Favorites" smart album
            let favoritesAlbums = PHAssetCollection.fetchAssetCollections(
                with: .smartAlbum,
                subtype: .smartAlbumFavorites,
                options: nil
            )
            favoritesAlbums.enumerateObjects { collection, _, _ in
                albums.append(collection)
            }
            
            // Fetch user albums
            let userAlbums = PHAssetCollection.fetchAssetCollections(
                with: .album,
                subtype: .albumRegular,
                options: nil
            )
            userAlbums.enumerateObjects { collection, _, _ in
                albums.append(collection)
            }
            
            // Fetch other smart albums (Recently Added, Screenshots, etc.)
            let otherSmartAlbums = PHAssetCollection.fetchAssetCollections(
                with: .smartAlbum,
                subtype: .any,
                options: nil
            )
            otherSmartAlbums.enumerateObjects { collection, _, _ in
                // Skip duplicates we already added
                if collection.assetCollectionSubtype != .smartAlbumUserLibrary &&
                   collection.assetCollectionSubtype != .smartAlbumFavorites {
                    albums.append(collection)
                }
            }
            
            continuation.resume(returning: albums)
        }
    }
    
    private func fetchAssets(fromAlbum albumIdentifier: String?, quantity: Int) async -> [PHAsset] {
        return await withCheckedContinuation { continuation in
            let fetchOptions = PHFetchOptions()
            fetchOptions.fetchLimit = quantity
            fetchOptions.sortDescriptors = [NSSortDescriptor(key: "creationDate", ascending: false)]
            fetchOptions.predicate = NSPredicate(format: "mediaType == %d", PHAssetMediaType.image.rawValue)
            
            let assets: PHFetchResult<PHAsset>
            
            if let albumId = albumIdentifier {
                // Fetch from specific album
                let albumResult = PHAssetCollection.fetchAssetCollections(
                    withLocalIdentifiers: [albumId],
                    options: nil
                )
                
                guard let album = albumResult.firstObject else {
                    continuation.resume(returning: [])
                    return
                }
                
                assets = PHAsset.fetchAssets(in: album, options: fetchOptions)
            } else {
                // Fetch all photos
                assets = PHAsset.fetchAssets(with: .image, options: fetchOptions)
            }
            
            var assetArray: [PHAsset] = []
            assets.enumerateObjects { asset, _, _ in
                assetArray.append(asset)
            }
            
            continuation.resume(returning: assetArray)
        }
    }
    
    private func getAlbumName(_ album: PHAssetCollection) -> String {
        return album.localizedTitle ?? "Unknown Album"
    }
    
    private func getAlbumType(_ album: PHAssetCollection) -> String {
        switch album.assetCollectionType {
        case .album:
            return "album"
        case .smartAlbum:
            switch album.assetCollectionSubtype {
            case .smartAlbumUserLibrary:
                return "all_photos"
            case .smartAlbumFavorites:
                return "favorites"
            case .smartAlbumRecentlyAdded:
                return "recently_added"
            case .smartAlbumScreenshots:
                return "screenshots"
            default:
                return "smart_album"
            }
        case .moment:
            return "moment"
        @unknown default:
            return "unknown"
        }
    }
    
    private func createErrorResponse(_ message: String) -> String {
        let errorObj = ["error": message]
        guard let jsonData = try? JSONSerialization.data(withJSONObject: errorObj),
              let jsonString = String(data: jsonData, encoding: .utf8) else {
            return "{\"error\": \"Unknown error\"}"
        }
        return jsonString
    }
}

// MARK: - C-Compatible Bridge Functions for Electron FFI

@_cdecl("photos_request_permission")
public func photos_request_permission() -> UnsafePointer<CChar> {
    NSLog("========================================")
    NSLog("[Swift Bridge] photos_request_permission() called")
    NSLog("[Swift Bridge] Timestamp: %@", Date().description)
    NSLog("[Swift Bridge] Thread: %@", Thread.current.description)
    NSLog("[Swift Bridge] Main thread: %@", Thread.isMainThread ? "YES" : "NO")
    
    // Check if we have the required Info.plist keys
    let bundle = Bundle.main
    let photoUsageDescription = bundle.object(forInfoDictionaryKey: "NSPhotoLibraryUsageDescription")
    let photoAddUsageDescription = bundle.object(forInfoDictionaryKey: "NSPhotoLibraryAddUsageDescription")
    
    NSLog("[Swift Bridge] NSPhotoLibraryUsageDescription: %@", String(describing: photoUsageDescription))
    NSLog("[Swift Bridge] NSPhotoLibraryAddUsageDescription: %@", String(describing: photoAddUsageDescription))
    
    if photoUsageDescription == nil {
        NSLog("[Swift Bridge] ⚠️  WARNING: NSPhotoLibraryUsageDescription is missing from Info.plist!")
        NSLog("[Swift Bridge] This is REQUIRED for the permission dialog to appear!")
    } else {
        NSLog("[Swift Bridge] ✓ Info.plist key is present")
    }
    
    let bridge = PhotosLibraryBridge()
    let semaphore = DispatchSemaphore(value: 0)
    var permissionResult: Bool = false
    
    NSLog("[Swift Bridge] Creating async Task for permission request...")
    Task {
        NSLog("[Swift Bridge] Task started on thread: %@", Thread.current.description)
        NSLog("[Swift Bridge] Calling bridge.requestPermission()...")
        permissionResult = await bridge.requestPermission()
        NSLog("[Swift Bridge] bridge.requestPermission() completed")
        NSLog("[Swift Bridge] Result: %@", permissionResult ? "✓ GRANTED" : "✗ DENIED")
        semaphore.signal()
    }
    
    NSLog("[Swift Bridge] Waiting for async Task to complete...")
    semaphore.wait()
    NSLog("[Swift Bridge] Task completed, returning result to Electron")
    NSLog("[Swift Bridge] Final permission status: %@", permissionResult ? "GRANTED" : "DENIED")
    NSLog("========================================")
    
    let resultString = permissionResult ? "true" : "false"
    return UnsafePointer(strdup(resultString)!)
}

@_cdecl("photos_check_permission")
public func photos_check_permission() -> UnsafePointer<CChar> {
    let bridge = PhotosLibraryBridge()
    let result = bridge.checkPermission()
    let resultString = result ? "true" : "false"
    return UnsafePointer(strdup(resultString)!)
}

@_cdecl("photos_get_albums")
public func photos_get_albums() -> UnsafePointer<CChar> {
    let bridge = PhotosLibraryBridge()
    let semaphore = DispatchSemaphore(value: 0)
    var albumsResult: String = "{\"error\": \"Failed to get albums\"}"
    
    Task {
        albumsResult = await bridge.getAlbums()
        semaphore.signal()
    }
    
    semaphore.wait()
    return UnsafePointer(strdup(albumsResult)!)
}

@_cdecl("photos_get_photos")
public func photos_get_photos(albumId: UnsafePointer<CChar>?, quantity: Int32) -> UnsafePointer<CChar> {
    let bridge = PhotosLibraryBridge()
    let albumIdentifier = albumId != nil ? String(cString: albumId!) : nil
    let semaphore = DispatchSemaphore(value: 0)
    var photosResult: String = "{\"error\": \"Failed to get photos\"}"
    
    Task {
        photosResult = await bridge.getPhotos(fromAlbum: albumIdentifier, quantity: Int(quantity))
        semaphore.signal()
    }
    
    semaphore.wait()
    return UnsafePointer(strdup(photosResult)!)
}