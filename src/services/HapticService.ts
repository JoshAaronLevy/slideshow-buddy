/**
 * HapticService - Haptic feedback utilities
 * Provides tactile feedback for user interactions
 */

import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { isMacOS } from '../utils/platform';
import * as macOSFeedbackService from './MacOSFeedbackService';

/**
 * Trigger a light impact haptic feedback
 * Use for: button taps, toggles, small interactions
 */
export const impactLight = async (): Promise<void> => {
  try {
    // Platform detection
    if (isMacOS()) {
      await macOSFeedbackService.impactLight();
      return;
    }

    // iOS/Android haptic feedback
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch (error) {
    // Haptics not available (web/unsupported device)
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Trigger a medium impact haptic feedback
 * Use for: selections, card taps, medium emphasis actions
 */
export const impactMedium = async (): Promise<void> => {
  try {
    // Platform detection
    if (isMacOS()) {
      await macOSFeedbackService.impactMedium();
      return;
    }

    // iOS/Android haptic feedback
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Trigger a heavy impact haptic feedback
 * Use for: important actions, deletions, major state changes
 */
export const impactHeavy = async (): Promise<void> => {
  try {
    // Platform detection
    if (isMacOS()) {
      await macOSFeedbackService.impactHeavy();
      return;
    }

    // iOS/Android haptic feedback
    await Haptics.impact({ style: ImpactStyle.Heavy });
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Trigger a success notification haptic feedback
 * Use for: successful operations, confirmations
 */
export const notificationSuccess = async (): Promise<void> => {
  try {
    // Platform detection
    if (isMacOS()) {
      await macOSFeedbackService.notificationSuccess();
      return;
    }

    // iOS/Android haptic feedback
    await Haptics.notification({ type: NotificationType.Success });
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Trigger a warning notification haptic feedback
 * Use for: warnings, cautions, attention needed
 */
export const notificationWarning = async (): Promise<void> => {
  try {
    // Platform detection
    if (isMacOS()) {
      await macOSFeedbackService.notificationWarning();
      return;
    }

    // iOS/Android haptic feedback
    await Haptics.notification({ type: NotificationType.Warning });
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Trigger an error notification haptic feedback
 * Use for: errors, failures, blocked actions
 */
export const notificationError = async (): Promise<void> => {
  try {
    // Platform detection
    if (isMacOS()) {
      await macOSFeedbackService.notificationError();
      return;
    }

    // iOS/Android haptic feedback
    await Haptics.notification({ type: NotificationType.Error });
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};

/**
 * Trigger a selection haptic feedback
 * Use for: picker/selector changes, scrolling through options
 */
export const selectionChanged = async (): Promise<void> => {
  try {
    // Platform detection
    if (isMacOS()) {
      await macOSFeedbackService.selectionChanged();
      return;
    }

    // iOS/Android haptic feedback
    await Haptics.selectionChanged();
  } catch (error) {
    console.debug('Haptic feedback not available:', error);
  }
};
