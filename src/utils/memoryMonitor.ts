/**
 * MemoryMonitor - Tracks memory usage and provides warnings
 * Helps identify memory leaks during development
 */

import { usePhotoStore } from '../stores/photoStore';
import { useSlideshowLibraryStore } from '../stores/slideshowLibraryStore';
import { usePlaylistLibraryStore } from '../stores/playlistLibraryStore';
import { useMusicStore } from '../stores/musicStore';

interface MemoryInfo {
  usedMB: number;
  totalMB: number;
  percent: number;
}

class MemoryMonitor {
  private checkInterval: NodeJS.Timeout | null = null;
  private warningThresholdMB = 100;
  private checkIntervalMs = 30000; // 30 seconds
  private isRunning = false;

  /**
   * Start monitoring memory usage
   */
  start(): void {
    if (this.isRunning) {
      console.log('[MemoryMonitor] Already running');
      return;
    }

    console.log('[MemoryMonitor] Starting memory monitoring', {
      checkIntervalSeconds: this.checkIntervalMs / 1000,
      warningThresholdMB: this.warningThresholdMB,
    });

    this.isRunning = true;

    // Initial check
    this.checkMemory();

    // Start periodic checks
    this.checkInterval = setInterval(() => {
      this.checkMemory();
    }, this.checkIntervalMs);
  }

  /**
   * Stop monitoring memory usage
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    console.log('[MemoryMonitor] Stopping memory monitoring');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }

    this.isRunning = false;
  }

  /**
   * Check current memory usage
   */
  private checkMemory(): void {
    const memoryInfo = this.getMemoryInfo();

    if (!memoryInfo) {
      console.log('[MemoryMonitor] Memory API not available (production build or unsupported browser)');
      return;
    }

    const { usedMB, totalMB, percent } = memoryInfo;

    console.log(`[MemoryMonitor] Memory: ${usedMB.toFixed(2)}MB / ${totalMB.toFixed(2)}MB (${percent.toFixed(1)}%)`);

    // Check if memory usage is high
    if (usedMB > this.warningThresholdMB) {
      console.warn(`[MemoryMonitor] ⚠️ HIGH MEMORY USAGE: ${usedMB.toFixed(2)}MB (threshold: ${this.warningThresholdMB}MB)`);
      this.logStoreStats();
    }
  }

  /**
   * Get current memory information
   */
  private getMemoryInfo(): MemoryInfo | null {
    // Check if performance.memory is available (Chromium-based browsers, dev mode)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!performance || !(performance as any).memory) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memory = (performance as any).memory;
    const usedMB = memory.usedJSHeapSize / 1024 / 1024;
    const totalMB = memory.totalJSHeapSize / 1024 / 1024;
    const percent = (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100;

    return { usedMB, totalMB, percent };
  }

  /**
   * Log statistics from all stores
   */
  private logStoreStats(): void {
    try {
      const photoCount = usePhotoStore.getState().photos.length;
      const slideshowCount = useSlideshowLibraryStore.getState().slideshows.length;
      const playlistCount = usePlaylistLibraryStore.getState().playlists.length;
      const spotifyPlaylistCount = useMusicStore.getState().playlists.length;
      const spotifyTrackCount = useMusicStore.getState().playlistTracks.length;

      console.log('[MemoryMonitor] Store Statistics:', {
        photos: photoCount,
        slideshows: slideshowCount,
        customPlaylists: playlistCount,
        spotifyPlaylists: spotifyPlaylistCount,
        spotifyTracks: spotifyTrackCount,
      });

      // Calculate estimated photo memory (rough estimate)
      // Blob URLs are small, but the images themselves are in memory when displayed
      const estimatedPhotoMemoryMB = photoCount * 0.2; // Rough estimate: 200KB per photo
      console.log('[MemoryMonitor] Estimated photo memory:', `${estimatedPhotoMemoryMB.toFixed(2)}MB`);
    } catch (error) {
      console.error('[MemoryMonitor] Error logging store stats:', error);
    }
  }

  /**
   * Log memory snapshot with label
   */
  logSnapshot(label: string): void {
    const memoryInfo = this.getMemoryInfo();

    if (!memoryInfo) {
      console.log(`[MemoryMonitor:${label}] Memory API not available`);
      return;
    }

    const { usedMB, totalMB, percent } = memoryInfo;
    console.log(`[MemoryMonitor:${label}]`, {
      usedMB: `${usedMB.toFixed(2)}MB`,
      totalMB: `${totalMB.toFixed(2)}MB`,
      percent: `${percent.toFixed(1)}%`,
    });
  }

  /**
   * Set warning threshold
   */
  setWarningThreshold(thresholdMB: number): void {
    this.warningThresholdMB = thresholdMB;
    console.log(`[MemoryMonitor] Warning threshold set to ${thresholdMB}MB`);
  }

  /**
   * Set check interval
   */
  setCheckInterval(intervalMs: number): void {
    this.checkIntervalMs = intervalMs;
    console.log(`[MemoryMonitor] Check interval set to ${intervalMs / 1000}s`);

    // Restart if running
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

// Export singleton instance
export const memoryMonitor = new MemoryMonitor();

// Export for debugging in console
if (typeof window !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).memoryMonitor = memoryMonitor;
}
