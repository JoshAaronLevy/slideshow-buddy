/**
 * MacOSFeedbackService - Audio feedback utilities for macOS desktop
 * Provides audio feedback as an alternative to haptic feedback
 * Alternative to haptic feedback which doesn't exist on desktop
 */

// Global audio context instance
let audioContext: AudioContext | null = null;

/**
 * Initialize the audio context if it doesn't exist
 */
const initAudioContext = (): AudioContext | null => {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    // Resume context if it's suspended (required for some browsers)
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    return audioContext;
  } catch (error) {
    console.error('Failed to initialize audio context:', error);
    return null;
  }
};

/**
 * Play a simple tone using Web Audio API
 */
const playTone = (frequency: number, duration: number, volume: number = 0.1): Promise<void> => {
  return new Promise((resolve) => {
    const context = initAudioContext();
    if (!context) {
      resolve();
      return;
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    // Connect oscillator to gain to destination
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    // Configure oscillator
    oscillator.frequency.setValueAtTime(frequency, context.currentTime);
    oscillator.type = 'sine'; // Clean, non-intrusive sound
    
    // Configure gain (volume) with smooth fade
    gainNode.gain.setValueAtTime(0, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, context.currentTime + 0.01); // Quick fade in
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration / 1000); // Smooth fade out
    
    // Start and stop oscillator
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration / 1000);
    
    // Resolve promise when sound completes
    setTimeout(() => resolve(), duration);
  });
};

/**
 * Play a frequency sweep (for success/error tones)
 */
const playFrequencySweep = (startFreq: number, endFreq: number, duration: number, volume: number = 0.1): Promise<void> => {
  return new Promise((resolve) => {
    const context = initAudioContext();
    if (!context) {
      resolve();
      return;
    }

    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    // Connect oscillator to gain to destination
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    // Configure oscillator with frequency sweep
    oscillator.frequency.setValueAtTime(startFreq, context.currentTime);
    oscillator.frequency.linearRampToValueAtTime(endFreq, context.currentTime + duration / 1000);
    oscillator.type = 'sine';
    
    // Configure gain (volume) with smooth fade
    gainNode.gain.setValueAtTime(0, context.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, context.currentTime + 0.01); // Quick fade in
    gainNode.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration / 1000); // Smooth fade out
    
    // Start and stop oscillator
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + duration / 1000);
    
    // Resolve promise when sound completes
    setTimeout(() => resolve(), duration);
  });
};

/**
 * Trigger a light impact audio feedback
 * Use for: button taps, toggles, small interactions
 * Sound: 800Hz, 50ms, subtle click/tick
 */
export const impactLight = async (): Promise<void> => {
  try {
    console.debug('MacOS audio feedback: light impact');
    await playTone(800, 50, 0.08);
  } catch (error) {
    console.error('MacOS audio feedback error (light):', error);
  }
};

/**
 * Trigger a medium impact audio feedback
 * Use for: selections, card taps, medium emphasis actions
 * Sound: 600Hz, 80ms, normal click
 */
export const impactMedium = async (): Promise<void> => {
  try {
    console.debug('MacOS audio feedback: medium impact');
    await playTone(600, 80, 0.10);
  } catch (error) {
    console.error('MacOS audio feedback error (medium):', error);
  }
};

/**
 * Trigger a heavy impact audio feedback
 * Use for: important actions, deletions, major state changes
 * Sound: 400Hz, 120ms, deeper/stronger sound
 */
export const impactHeavy = async (): Promise<void> => {
  try {
    console.debug('MacOS audio feedback: heavy impact');
    await playTone(400, 120, 0.12);
  } catch (error) {
    console.error('MacOS audio feedback error (heavy):', error);
  }
};

/**
 * Trigger a success notification audio feedback
 * Use for: successful operations, confirmations
 * Sound: ascending tone (600→800Hz), positive chime
 */
export const notificationSuccess = async (): Promise<void> => {
  try {
    console.debug('MacOS audio feedback: success notification');
    await playFrequencySweep(600, 800, 150, 0.10);
  } catch (error) {
    console.error('MacOS audio feedback error (success):', error);
  }
};

/**
 * Trigger a warning notification audio feedback
 * Use for: warnings, cautions, attention needed
 * Sound: 700Hz, 100ms, attention beep
 */
export const notificationWarning = async (): Promise<void> => {
  try {
    console.debug('MacOS audio feedback: warning notification');
    await playTone(700, 100, 0.12);
  } catch (error) {
    console.error('MacOS audio feedback error (warning):', error);
  }
};

/**
 * Trigger an error notification audio feedback
 * Use for: errors, failures, blocked actions
 * Sound: descending tone (800→400Hz), negative/alert sound
 */
export const notificationError = async (): Promise<void> => {
  try {
    console.debug('MacOS audio feedback: error notification');
    await playFrequencySweep(800, 400, 150, 0.12);
  } catch (error) {
    console.error('MacOS audio feedback error (error):', error);
  }
};

/**
 * Trigger a selection audio feedback
 * Use for: picker/selector changes, scrolling through options
 * Sound: 1000Hz, 30ms, soft tick
 */
export const selectionChanged = async (): Promise<void> => {
  try {
    console.debug('MacOS audio feedback: selection changed');
    await playTone(1000, 30, 0.06);
  } catch (error) {
    console.error('MacOS audio feedback error (selection):', error);
  }
};