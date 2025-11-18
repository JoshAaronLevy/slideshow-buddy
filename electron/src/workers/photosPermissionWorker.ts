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

import { parentPort } from 'worker_threads';
import { PhotosLibraryFFI } from '../native/PhotosLibraryFFI';

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

console.log('[Photos Worker] ═══════════════════════════════════════════════');
console.log('[Photos Worker] Worker thread starting...');
console.log('[Photos Worker] Process platform:', process.platform);
console.log('[Photos Worker] Thread ID:', require('worker_threads').threadId);
console.log('[Photos Worker] Timestamp:', new Date().toISOString());

try {
  console.log('[Photos Worker] Initializing PhotosLibraryFFI...');
  photosFFI = new PhotosLibraryFFI();
  console.log('[Photos Worker] ✓ PhotosLibraryFFI initialized successfully');
  console.log('[Photos Worker] FFI ready:', photosFFI.isReady());
} catch (error) {
  console.error('[Photos Worker] ✗ Failed to initialize PhotosLibraryFFI');
  console.error('[Photos Worker] Error:', error);
  console.error('[Photos Worker] Error message:', error instanceof Error ? error.message : 'Unknown error');
  if (error instanceof Error && error.stack) {
    console.error('[Photos Worker] Stack:', error.stack);
  }
}

console.log('[Photos Worker] Worker initialized, waiting for messages...');
console.log('[Photos Worker] ═══════════════════════════════════════════════');

// Handle messages from main thread
if (parentPort) {
  parentPort.on('message', async (request: WorkerRequest) => {
    console.log('[Photos Worker] ─────────────────────────────────────────');
    console.log('[Photos Worker] Received message:', {
      id: request.id,
      type: request.type,
      timestamp: new Date().toISOString()
    });

    const response: WorkerResponse = {
      id: request.id,
      success: false
    };

    try {
      if (!photosFFI || !photosFFI.isReady()) {
        throw new Error('Photos FFI not initialized or not ready');
      }

      console.log('[Photos Worker] FFI is ready, processing request type:', request.type);

      switch (request.type) {
        case 'requestPermission': {
          console.log('[Photos Worker] Calling requestPermission()...');
          console.log('[Photos Worker] ⚠️  This call will BLOCK this worker thread until user responds');
          const startTime = Date.now();
          
          const hasPermission = await photosFFI.requestPermission();
          
          const duration = Date.now() - startTime;
          console.log('[Photos Worker] requestPermission() completed in', duration, 'ms');
          console.log('[Photos Worker] Result:', hasPermission);
          
          response.success = true;
          response.hasPermission = hasPermission;
          break;
        }

        case 'checkPermission': {
          console.log('[Photos Worker] Calling checkPermission()...');
          const startTime = Date.now();
          
          const hasPermission = photosFFI.checkPermission();
          
          const duration = Date.now() - startTime;
          console.log('[Photos Worker] checkPermission() completed in', duration, 'ms');
          console.log('[Photos Worker] Result:', hasPermission);
          
          response.success = true;
          response.hasPermission = hasPermission;
          break;
        }

        default:
          throw new Error(`Unknown request type: ${request.type}`);
      }

      console.log('[Photos Worker] ✓ Request processed successfully');
    } catch (error) {
      console.error('[Photos Worker] ✗ Error processing request:', error);
      console.error('[Photos Worker] Error type:', error.constructor.name);
      console.error('[Photos Worker] Error message:', error instanceof Error ? error.message : 'Unknown error');
      if (error instanceof Error && error.stack) {
        console.error('[Photos Worker] Error stack:', error.stack);
      }
      
      response.success = false;
      response.error = error instanceof Error ? error.message : 'Unknown error in worker';
    }

    console.log('[Photos Worker] Sending response back to main thread:', response);
    console.log('[Photos Worker] ─────────────────────────────────────────');
    
    // Send response back to main thread
    parentPort!.postMessage(response);
  });

  console.log('[Photos Worker] Message listener registered');
} else {
  console.error('[Photos Worker] ✗ parentPort is null - worker cannot communicate with main thread!');
}

// Handle worker errors
process.on('uncaughtException', (error) => {
  console.error('[Photos Worker] ✗✗✗ UNCAUGHT EXCEPTION ✗✗✗');
  console.error('[Photos Worker] Error:', error);
  console.error('[Photos Worker] Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Photos Worker] ✗✗✗ UNHANDLED REJECTION ✗✗✗');
  console.error('[Photos Worker] Promise:', promise);
  console.error('[Photos Worker] Reason:', reason);
  process.exit(1);
});
