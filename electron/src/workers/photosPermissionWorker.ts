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

// Simple logging helpers to avoid console spam
const DEBUG = process.env.PHOTOS_WORKER_DEBUG === 'true';

const info = (...args: unknown[]) => {
  console.log('[PhotosWorker]', ...args);
};

const debug = (...args: unknown[]) => {
  if (DEBUG) {
    console.log('[PhotosWorker][debug]', ...args);
  }
};

const errorLog = (...args: unknown[]) => {
  console.error('[PhotosWorker][error]', ...args);
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

info(
  `Worker starting (threadId=${threadId}, platform=${process.platform}, NODE_ENV=${process.env.NODE_ENV})`
);
debug('Worker data:', workerData);
debug('SLIDESHOW_BUDDY_DEV:', process.env.SLIDESHOW_BUDDY_DEV);
debug('process.resourcesPath:', process.resourcesPath);

try {
  info('Initializing PhotosLibraryFFI…');
  photosFFI = new PhotosLibraryFFI();

  const ready = photosFFI.isReady();
  if (!ready) {
    throw new Error('PhotosLibraryFFI reported not ready after initialization');
  }

  info('PhotosLibraryFFI initialized successfully (isReady = true)');
} catch (error) {
  errorLog('Failed to initialize PhotosLibraryFFI:', error);
}

// Handle messages from main thread
if (!parentPort) {
  // This should never happen in a properly created worker, but fail loudly if it does.
  errorLog('parentPort is null - worker cannot communicate with main thread. Exiting.');
  process.exit(1);
}

info('Worker initialized, waiting for messages…');

parentPort.on('message', async (request: WorkerRequest) => {
  const { id, type } = request;
  const startedAt = Date.now();

  info(`Request received (id=${id}, type=${type})`);

  const response: WorkerResponse = {
    id,
    success: false
  };

  try {
    if (!photosFFI || !photosFFI.isReady()) {
      throw new Error('Photos FFI not initialized or not ready');
    }

    debug('FFI is ready, processing request type:', type);

    switch (type) {
      case 'requestPermission': {
        info(`Calling PhotosLibraryFFI.requestPermission() for id=${id}`);
        const hasPermission = await photosFFI.requestPermission();
        const duration = Date.now() - startedAt;

        info(
          `requestPermission completed (id=${id}, duration=${duration}ms, hasPermission=${hasPermission})`
        );

        response.success = true;
        response.hasPermission = hasPermission;
        break;
      }

      case 'checkPermission': {
        info(`Calling PhotosLibraryFFI.checkPermission() for id=${id}`);
        const hasPermission = photosFFI.checkPermission();
        const duration = Date.now() - startedAt;

        info(
          `checkPermission completed (id=${id}, duration=${duration}ms, hasPermission=${hasPermission})`
        );

        response.success = true;
        response.hasPermission = hasPermission;
        break;
      }

      default: {
        throw new Error(`Unknown request type: ${type}`);
      }
    }
  } catch (error) {
    const duration = Date.now() - startedAt;
    errorLog(
      `Error processing request (id=${id}, type=${type}, duration=${duration}ms):`,
      error
    );

    response.success = false;
    response.error = error instanceof Error ? error.message : 'Unknown error in worker';
  }

  debug('Sending response back to main thread:', response);
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
