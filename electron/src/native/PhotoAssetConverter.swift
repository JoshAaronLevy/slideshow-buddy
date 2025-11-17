import Foundation
import Photos
import AppKit

/**
 * PhotoAssetConverter - Converts native PHAssets to web-compatible Photo objects
 * Handles thumbnail generation and format conversion for efficient web use
 */
@objc public class PhotoAssetConverter: NSObject {
    
    private let imageManager = PHImageManager.default()
    private let thumbnailSize = CGSize(width: 512, height: 512)
    private let imageOptions: PHImageRequestOptions
    
    override init() {
        imageOptions = PHImageRequestOptions()
        imageOptions.version = .current
        imageOptions.deliveryMode = .highQualityFormat
        imageOptions.resizeMode = .exact
        imageOptions.isNetworkAccessAllowed = true
        imageOptions.isSynchronous = false
        super.init()
    }
    
    /**
     * Convert array of PHAssets to Photo objects
     * Returns: Array of dictionaries representing Photo objects
     */
    @objc public func convertAssets(_ assets: [PHAsset]) async -> [[String: Any]] {
        var photos: [[String: Any]] = []
        
        await withTaskGroup(of: [String: Any]?.self) { group in
            for asset in assets {
                group.addTask { [weak self] in
                    return await self?.convertSingleAsset(asset)
                }
            }
            
            for await photo in group {
                if let validPhoto = photo {
                    photos.append(validPhoto)
                }
            }
        }
        
        return photos
    }
    
    /**
     * Convert single PHAsset to Photo object
     * Returns: Dictionary representing Photo object or nil if conversion fails
     */
    public func convertSingleAsset(_ asset: PHAsset) async -> [String: Any]? {
        return await withCheckedContinuation { continuation in
            imageManager.requestImage(
                for: asset,
                targetSize: thumbnailSize,
                contentMode: .aspectFill,
                options: imageOptions
            ) { [weak self] image, info in
                guard let self = self,
                      let image = image else {
                    continuation.resume(returning: nil)
                    return
                }
                
                // Check if this is the final result (not degraded)
                if let isDegraded = info?[PHImageResultIsDegradedKey] as? Bool, isDegraded {
                    // Skip degraded images and wait for the high-quality version
                    return
                }
                
                guard let base64String = self.imageToBase64(image) else {
                    continuation.resume(returning: nil)
                    return
                }
                
                let photo: [String: Any] = [
                    "id": asset.localIdentifier,
                    "uri": "data:image/jpeg;base64,\(base64String)",
                    "filename": self.generateFilename(for: asset),
                    "timestamp": Int(asset.creationDate?.timeIntervalSince1970 ?? 0) * 1000, // Convert to milliseconds
                    "selected": false
                ]
                
                continuation.resume(returning: photo)
            }
        }
    }
    
    /**
     * Convert NSImage to base64 JPEG string
     * Returns: Base64 string or nil if conversion fails
     */
    private func imageToBase64(_ image: NSImage) -> String? {
        guard let tiffData = image.tiffRepresentation,
              let bitmapRep = NSBitmapImageRep(data: tiffData) else {
            return nil
        }
        
        // Configure JPEG compression
        let jpegProperties: [NSBitmapImageRep.PropertyKey: Any] = [
            .compressionFactor: 0.8 // Good quality while keeping file size reasonable
        ]
        
        guard let jpegData = bitmapRep.representation(
            using: .jpeg,
            properties: jpegProperties
        ) else {
            return nil
        }
        
        return jpegData.base64EncodedString()
    }
    
    /**
     * Generate appropriate filename for asset
     * Returns: String filename with .jpg extension
     */
    private func generateFilename(for asset: PHAsset) -> String {
        if let creationDate = asset.creationDate {
            let formatter = DateFormatter()
            formatter.dateFormat = "yyyy-MM-dd_HH-mm-ss"
            let dateString = formatter.string(from: creationDate)
            return "photo_\(dateString).jpg"
        } else {
            return "photo_\(asset.localIdentifier.prefix(8)).jpg"
        }
    }
    
    /**
     * Get image metadata for debugging
     * Returns: Dictionary with image information
     */
    @objc public func getAssetMetadata(_ asset: PHAsset) -> [String: Any] {
        return [
            "localIdentifier": asset.localIdentifier,
            "creationDate": asset.creationDate?.timeIntervalSince1970 ?? 0,
            "modificationDate": asset.modificationDate?.timeIntervalSince1970 ?? 0,
            "mediaType": asset.mediaType.rawValue,
            "mediaSubtypes": asset.mediaSubtypes.rawValue,
            "pixelWidth": asset.pixelWidth,
            "pixelHeight": asset.pixelHeight,
            "duration": asset.duration,
            "isFavorite": asset.isFavorite,
            "isHidden": asset.isHidden,
            "burstIdentifier": asset.burstIdentifier ?? ""
        ]
    }
    
    /**
     * Request full-size image for specific asset (for slideshow display)
     * Returns: Base64 string of full-size image
     */
    @objc public func getFullSizeImage(for asset: PHAsset) async -> String? {
        return await withCheckedContinuation { continuation in
            let fullSizeOptions = PHImageRequestOptions()
            fullSizeOptions.version = .current
            fullSizeOptions.deliveryMode = .highQualityFormat
            fullSizeOptions.isNetworkAccessAllowed = true
            fullSizeOptions.isSynchronous = false
            
            imageManager.requestImage(
                for: asset,
                targetSize: PHImageManagerMaximumSize,
                contentMode: .aspectFit,
                options: fullSizeOptions
            ) { [weak self] image, info in
                guard let self = self,
                      let image = image else {
                    continuation.resume(returning: nil)
                    return
                }
                
                // Check if this is the final result
                if let isDegraded = info?[PHImageResultIsDegradedKey] as? Bool, isDegraded {
                    return
                }
                
                let base64String = self.imageToBase64(image)
                continuation.resume(returning: base64String)
            }
        }
    }
}

// MARK: - C-Compatible Functions for Electron FFI

@_cdecl("photos_convert_asset")
public func photos_convert_asset(assetId: UnsafePointer<CChar>) -> UnsafePointer<CChar> {
    let converter = PhotoAssetConverter()
    let identifier = String(cString: assetId)
    
    // Fetch asset by identifier
    let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [identifier], options: nil)
    guard let asset = fetchResult.firstObject else {
        return UnsafePointer(strdup("{\"error\": \"Asset not found\"}")!)
    }
    
    // Use semaphore to wait for async operation in synchronous context
    let semaphore = DispatchSemaphore(value: 0)
    var result: [String: Any]?
    
    Task {
        result = await converter.convertSingleAsset(asset)
        semaphore.signal()
    }
    
    semaphore.wait()
    
    guard let finalResult = result,
          let jsonData = try? JSONSerialization.data(withJSONObject: finalResult),
          let jsonString = String(data: jsonData, encoding: .utf8) else {
        return UnsafePointer(strdup("{\"error\": \"Conversion failed\"}")!)
    }
    
    return UnsafePointer(strdup(jsonString)!)
}

@_cdecl("photos_get_asset_metadata")
public func photos_get_asset_metadata(assetId: UnsafePointer<CChar>) -> UnsafePointer<CChar> {
    let converter = PhotoAssetConverter()
    let identifier = String(cString: assetId)
    
    let fetchResult = PHAsset.fetchAssets(withLocalIdentifiers: [identifier], options: nil)
    guard let asset = fetchResult.firstObject else {
        return UnsafePointer(strdup("{\"error\": \"Asset not found\"}")!)
    }
    
    let metadata = converter.getAssetMetadata(asset)
    guard let jsonData = try? JSONSerialization.data(withJSONObject: metadata),
          let jsonString = String(data: jsonData, encoding: .utf8) else {
        return UnsafePointer(strdup("{\"error\": \"Metadata serialization failed\"}")!)
    }
    
    return UnsafePointer(strdup(jsonString)!)
}