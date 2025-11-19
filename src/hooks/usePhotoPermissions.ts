/**
 * usePhotoPermissions - Centralized hook for managing photo permissions on macOS
 * Handles permission checks, requests, loading states, and user notifications
 */

import { useState, useCallback } from 'react';
import { useIonToast, useIonAlert } from '@ionic/react';
import { isMacOS } from '../utils/platform';

export interface PhotoPermissionState {
  hasPermission: boolean | null;
  isChecking: boolean;
  isRequesting: boolean;
}

export interface UsePhotoPermissionsReturn {
  state: PhotoPermissionState;
  checkPermission: () => Promise<boolean>;
  requestPermission: (options?: { showNotifications?: boolean }) => Promise<boolean>;
  openSystemSettings: () => Promise<void>;
}

export const usePhotoPermissions = (): UsePhotoPermissionsReturn => {
  const [state, setState] = useState<PhotoPermissionState>({
    hasPermission: null,
    isChecking: false,
    isRequesting: false,
  });

  const [presentToast] = useIonToast();
  const [presentAlert] = useIonAlert();

  /**
   * Check if the app currently has photo permissions
   */
  const checkPermission = useCallback(async (): Promise<boolean> => {
    if (!isMacOS() || !(window as any).electron?.photos) {
      console.warn('[usePhotoPermissions] Photos API not available');
      return false;
    }

    setState(prev => ({ ...prev, isChecking: true }));

    try {
      const result = await (window as any).electron.photos.checkPermission();
      
      if (!result.success) {
        console.error('[usePhotoPermissions] Failed to check permission:', result.error);
        setState(prev => ({ ...prev, hasPermission: false, isChecking: false }));
        return false;
      }

      const hasPermission = result.hasPermission || false;
      setState(prev => ({ ...prev, hasPermission, isChecking: false }));
      return hasPermission;
    } catch (error) {
      console.error('[usePhotoPermissions] Error checking permission:', error);
      setState(prev => ({ ...prev, hasPermission: false, isChecking: false }));
      return false;
    }
  }, []);

  /**
   * Open macOS System Settings to the app's permissions
   */
  const openSystemSettings = useCallback(async (): Promise<void> => {
    try {
      if ((window as any).electron?.shell) {
        // Open the Privacy & Security > Photos section
        await (window as any).electron.shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Photos');
      }
    } catch (error) {
      console.error('[usePhotoPermissions] Error opening system settings:', error);
    }
  }, []);

  /**
   * Request photo permissions from the user
   * @param options.showNotifications - Whether to show success/error notifications (default: true)
   */
  const requestPermission = useCallback(async (options?: { showNotifications?: boolean }): Promise<boolean> => {
    const showNotifications = options?.showNotifications ?? true;

    if (!isMacOS() || !(window as any).electron?.photos) {
      console.warn('[usePhotoPermissions] Photos API not available');
      return false;
    }

    setState(prev => ({ ...prev, isRequesting: true }));

    // Show loading toast
    if (showNotifications) {
      await presentToast({
        message: 'Checking photo library access...',
        duration: 0, // Keep it visible until dismissed
        position: 'top',
        color: 'light',
        cssClass: 'photo-permission-loading-toast',
      });
    }

    try {
      // First check if we already have permission
      const checkResult = await (window as any).electron.photos.checkPermission();
      
      if (!checkResult.success) {
        console.error('[usePhotoPermissions] Failed to check permission:', checkResult.error);
        setState(prev => ({ ...prev, isRequesting: false }));
        
        // Dismiss loading toast and show error
        if (showNotifications) {
          await presentToast({
            message: '',
            duration: 1,
          });
          
          await presentToast({
            message: 'Failed to check photo permissions. Please try again.',
            duration: 0,
            position: 'top',
            color: 'danger',
            buttons: [{ text: 'Dismiss', role: 'cancel' }],
          });
        }
        
        return false;
      }

      // If already granted, no need to request
      if (checkResult.hasPermission) {
        setState(prev => ({ ...prev, hasPermission: true, isRequesting: false }));
        
        // Dismiss loading toast and show success
        if (showNotifications) {
          await presentToast({
            message: '',
            duration: 1,
          });
          
          await presentToast({
            message: 'Photo library access granted! You can now browse and select photos when creating slideshows.',
            duration: 4000,
            position: 'top',
            color: 'success',
          });
        }
        
        return true;
      }

      // Request permission
      const requestResult = await (window as any).electron.photos.requestPermission();
      
      if (!requestResult.success) {
        console.error('[usePhotoPermissions] Failed to request permission:', requestResult.error);
        setState(prev => ({ ...prev, hasPermission: false, isRequesting: false }));
        
        // Dismiss loading toast and show error
        if (showNotifications) {
          await presentToast({
            message: '',
            duration: 1,
          });
          
          await presentToast({
            message: `Error requesting photo access: ${requestResult.error}`,
            duration: 0,
            position: 'top',
            color: 'danger',
            buttons: [{ text: 'Dismiss', role: 'cancel' }],
          });
        }
        
        return false;
      }

      const hasPermission = requestResult.hasPermission || false;
      setState(prev => ({ ...prev, hasPermission, isRequesting: false }));

      // Dismiss loading toast
      await presentToast({
        message: '',
        duration: 1,
      });

      if (hasPermission) {
        // Show success notification
        if (showNotifications) {
          await presentToast({
            message: 'Photo library access granted! You can now browse and select photos when creating slideshows.',
            duration: 4000,
            position: 'top',
            color: 'success',
          });
        }
      } else {
        // Show denial dialogue
        if (showNotifications) {
          await presentAlert({
            header: 'Photo Access Denied',
            message: 'You can still create slideshows using the file importer to select photos manually. If you change your mind later, you can grant photo access from the Settings page.',
            buttons: [
              {
                text: 'Got It!',
                role: 'cancel',
              },
            ],
          });
        }
      }

      return hasPermission;
    } catch (error) {
      console.error('[usePhotoPermissions] Error requesting permission:', error);
      setState(prev => ({ ...prev, hasPermission: false, isRequesting: false }));
      
      // Dismiss loading toast and show error
      if (showNotifications) {
        await presentToast({
          message: '',
          duration: 1,
        });
        
        await presentToast({
          message: 'An unexpected error occurred while requesting photo access.',
          duration: 0,
          position: 'top',
          color: 'danger',
          buttons: [{ text: 'Dismiss', role: 'cancel' }],
        });
      }
      
      return false;
    }
  }, [presentToast, presentAlert]);

  return {
    state,
    checkPermission,
    requestPermission,
    openSystemSettings,
  };
};
