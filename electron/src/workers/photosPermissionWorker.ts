/**
 * Photos Permission Worker Thread
 *
 * This worker handles blocking Photos library FFI calls in a separate thread
 * to prevent freezing the Electron main process.
 *
 * The Swift bridge uses DispatchSemaphore.wait() which blocks the calling thread
 * until the async PhotoKit permission request completes. By running this in a
 * worker thread, the main Electron event loop stays responsive.
 */

import { parentPort, workerData, threadId } from 'worker_threads';
import { PhotosLibraryFFI } from '../native/PhotosLibraryFFI';

// Simple logging helpers
const errorLog = (...args: unknown[]) => {
  console.error('[PhotosWorker]', ...args);
};

// Message types for communication with main thread
interface WorkerRequest {
  id: string;
  type: 'requestPermission' | 'checkPermission';
}

interface WorkerResponse {
  id: string;
  success: boolean;
  hasPermission?: boolean;
  error?: string;
}

// Initialize FFI in this worker thread
let photosFFI: PhotosLibraryFFI | null = null;

try {
  photosFFI = new PhotosLibraryFFI();

  const ready = photosFFI.isReady();
  if (!ready) {
    throw new Error('PhotosLibraryFFI reported not ready after initialization');
  }
} catch (error) {
  errorLog('Failed to initialize PhotosLibraryFFI:', error);
}

// Handle messages from main thread
if (!parentPort) {
  errorLog('parentPort is null - worker cannot communicate with main thread. Exiting.');
  process.exit(1);
}

parentPort.on('message', async (request: WorkerRequest) => {
  const { id, type } = request;

  const response: WorkerResponse = {
    id,
    success: false
  };

  try {
    if (!photosFFI || !photosFFI.isReady()) {
      throw new Error('Photos FFI not initialized or not ready');
    }

    switch (type) {
      case 'requestPermission': {
        const hasPermission = await photosFFI.requestPermission();
        response.success = true;
        response.hasPermission = hasPermission;
        break;
      }

      case 'checkPermission': {
        const hasPermission = photosFFI.checkPermission();
        response.success = true;
        response.hasPermission = hasPermission;
        break;
      }

      default: {
        throw new Error(`Unknown request type: ${type}`);
      }
    }
  } catch (error) {
    errorLog(`Error processing request (id=${id}, type=${type}):`, error);
    response.success = false;
    response.error = error instanceof Error ? error.message : 'Unknown error in worker';
  }

  parentPort.postMessage(response);
});

// Handle worker-level crashes so you see them in logs instead of silent death
process.on('uncaughtException', (error) => {
  errorLog('UNCAUGHT EXCEPTION in worker:', error);
  if (error && (error as Error).stack) {
    errorLog('Stack:', (error as Error).stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  errorLog('UNHANDLED REJECTION in worker:', { reason, promise });
  process.exit(1);
});
