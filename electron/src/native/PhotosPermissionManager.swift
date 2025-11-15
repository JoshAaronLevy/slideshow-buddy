import Foundation
import Photos

/**
 * PhotosPermissionManager - Handles photo library permissions for macOS
 * Manages authorization status and permission requests
 */
@objc public class PhotosPermissionManager: NSObject {
    
    /**
     * Check current photo library authorization status
     * Returns: Bool indicating if permission is granted
     */
    @objc public func checkPermission() -> Bool {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        return status == .authorized
    }
    
    /**
     * Get detailed authorization status
     * Returns: String representation of current status
     */
    @objc public func getAuthorizationStatus() -> String {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        return authorizationStatusToString(status)
    }
    
    /**
     * Request photo library access with user prompt
     * Returns: Bool indicating if permission was granted after request
     */
    @objc public func requestPermission() async -> Bool {
        return await withCheckedContinuation { continuation in
            let currentStatus = PHPhotoLibrary.authorizationStatus(for: .readWrite)
            
            switch currentStatus {
            case .authorized:
                // Already authorized
                continuation.resume(returning: true)
                
            case .limited:
                // Limited access is considered authorized for our purposes
                continuation.resume(returning: true)
                
            case .denied, .restricted:
                // Previously denied or restricted - cannot request again
                continuation.resume(returning: false)
                
            case .notDetermined:
                // Need to request permission
                PHPhotoLibrary.requestAuthorization(for: .readWrite) { status in
                    let granted = (status == .authorized || status == .limited)
                    continuation.resume(returning: granted)
                }
                
            @unknown default:
                // Unknown status - assume denied for safety
                continuation.resume(returning: false)
            }
        }
    }
    
    /**
     * Get user-friendly permission status message
     * Returns: String message describing current permission state
     */
    @objc public func getPermissionStatusMessage() -> String {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        
        switch status {
        case .authorized:
            return "Full access to photo library granted"
            
        case .limited:
            return "Limited access to photo library granted"
            
        case .denied:
            return "Photo library access denied. Please enable in System Preferences > Security & Privacy > Privacy > Photos"
            
        case .restricted:
            return "Photo library access restricted by system policies"
            
        case .notDetermined:
            return "Photo library access not yet requested"
            
        @unknown default:
            return "Unknown photo library permission status"
        }
    }
    
    /**
     * Check if the app can request permission (i.e., not previously denied)
     * Returns: Bool indicating if permission request is possible
     */
    @objc public func canRequestPermission() -> Bool {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        return status == .notDetermined
    }
    
    /**
     * Check if user has limited access (iOS 14+ feature)
     * Returns: Bool indicating if access is limited
     */
    @objc public func hasLimitedAccess() -> Bool {
        let status = PHPhotoLibrary.authorizationStatus(for: .readWrite)
        return status == .limited
    }
    
    // MARK: - Private Helper Methods
    
    private func authorizationStatusToString(_ status: PHAuthorizationStatus) -> String {
        switch status {
        case .authorized:
            return "authorized"
        case .limited:
            return "limited"
        case .denied:
            return "denied"
        case .restricted:
            return "restricted"
        case .notDetermined:
            return "not_determined"
        @unknown default:
            return "unknown"
        }
    }
}

// MARK: - C-Compatible Functions for Electron FFI

@_cdecl("photos_permission_get_status")
public func photos_permission_get_status() -> UnsafePointer<CChar> {
    let manager = PhotosPermissionManager()
    let status = manager.getAuthorizationStatus()
    return UnsafePointer(strdup(status)!)
}

@_cdecl("photos_permission_get_message")
public func photos_permission_get_message() -> UnsafePointer<CChar> {
    let manager = PhotosPermissionManager()
    let message = manager.getPermissionStatusMessage()
    return UnsafePointer(strdup(message)!)
}

@_cdecl("photos_permission_can_request")
public func photos_permission_can_request() -> Bool {
    let manager = PhotosPermissionManager()
    return manager.canRequestPermission()
}

@_cdecl("photos_permission_has_limited")
public func photos_permission_has_limited() -> Bool {
    let manager = PhotosPermissionManager()
    return manager.hasLimitedAccess()
}