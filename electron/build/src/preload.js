"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable @typescript-eslint/no-explicit-any */
const electron_1 = require("electron");
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('./rt/electron-rt');
// Common helper function to create menu event listeners
const createMenuEventListener = (eventName) => {
    return (callback) => {
        const removeListener = () => {
            electron_1.ipcRenderer.removeListener(eventName, callback);
        };
        electron_1.ipcRenderer.on(eventName, () => {
            // console.log(`Menu event received: ${eventName}`);
            callback();
        });
        return removeListener;
    };
};
// Expose Photos API, Slideshow API, Spotify OAuth API, Window API, System API, Menu API, Browser API, and Dialog API to renderer process
electron_1.contextBridge.exposeInMainWorld('electron', {
    photos: {
        requestPermission: () => {
            console.log('[PRELOAD] ═══ photos:requestPermission IPC call ═══');
            console.log('[PRELOAD] Forwarding to main process via ipcRenderer.invoke("photos:requestPermission")');
            console.log('[PRELOAD] Timestamp:', new Date().toISOString());
            const result = electron_1.ipcRenderer.invoke('photos:requestPermission');
            result.then(r => {
                console.log('[PRELOAD] IPC response received from main process:', r);
            }).catch(e => {
                console.error('[PRELOAD] IPC error:', e);
            });
            return result;
        },
        checkPermission: () => electron_1.ipcRenderer.invoke('photos:checkPermission'),
        getAlbums: () => electron_1.ipcRenderer.invoke('photos:getAlbums'),
        getPhotos: (albumId, quantity) => electron_1.ipcRenderer.invoke('photos:getPhotos', { albumId, quantity })
    },
    browser: {
        openExternal: (url) => electron_1.ipcRenderer.invoke('browser:openExternal', url)
    },
    dialog: {
        selectImages: () => electron_1.ipcRenderer.invoke('dialog:selectImages')
    },
    photoLibrary: {
        generateHash: (filePath) => electron_1.ipcRenderer.invoke('photoLibrary:generateHash', filePath),
        validateFile: (filePath) => electron_1.ipcRenderer.invoke('photoLibrary:validateFile', filePath),
        getFileSize: (filePath) => electron_1.ipcRenderer.invoke('photoLibrary:getFileSize', filePath)
    },
    slideshow: {
        keepAwakeStart: () => electron_1.ipcRenderer.invoke('slideshow:keep-awake-start'),
        keepAwakeStop: () => electron_1.ipcRenderer.invoke('slideshow:keep-awake-stop')
    },
    spotify: {
        onOAuthCallback: (callback) => {
            const wrappedCallback = (_event, url) => {
                // console.log('[Preload] OAuth callback received in preload:', url);
                // console.log('[Preload] URL length:', url.length);
                // console.log('[Preload] URL starts with expected prefix:', url.startsWith('com.slideshowbuddy://callback'));
                callback(url);
            };
            const removeListener = () => {
                electron_1.ipcRenderer.removeListener('spotify:oauth-callback', wrappedCallback);
            };
            electron_1.ipcRenderer.on('spotify:oauth-callback', wrappedCallback);
            // console.log('[Preload] Spotify OAuth callback listener registered');
            return removeListener;
        }
    },
    window: {
        setTitle: (title) => electron_1.ipcRenderer.invoke('window:set-title', title)
    },
    system: {
        getTheme: () => electron_1.ipcRenderer.invoke('system:get-theme'),
        onThemeChange: (callback) => {
            const removeListener = () => {
                electron_1.ipcRenderer.removeListener('theme-changed', callback);
            };
            electron_1.ipcRenderer.on('theme-changed', (event, theme) => {
                // console.log('Theme changed in preload:', theme);
                callback(theme);
            });
            return removeListener;
        }
    },
    storage: {
        get: (key) => electron_1.ipcRenderer.invoke('storage:get', key),
        set: (key, value) => electron_1.ipcRenderer.invoke('storage:set', key, value),
        remove: (key) => electron_1.ipcRenderer.invoke('storage:remove', key),
        clear: () => electron_1.ipcRenderer.invoke('storage:clear')
    },
    keychain: {
        getPassword: (account) => electron_1.ipcRenderer.invoke('keychain:getPassword', account),
        setPassword: (account, password) => electron_1.ipcRenderer.invoke('keychain:setPassword', account, password),
        deletePassword: (account) => electron_1.ipcRenderer.invoke('keychain:deletePassword', account)
    },
    menu: {
        // Menu event listeners
        onNewSlideshow: createMenuEventListener('menu:new-slideshow'),
        onPreferences: createMenuEventListener('menu:preferences'),
        onImportPhotos: createMenuEventListener('menu:import-photos'),
        onImportMusic: createMenuEventListener('menu:import-music'),
        onExportSlideshow: createMenuEventListener('menu:export-slideshow'),
        onSlideshowSettings: createMenuEventListener('menu:slideshow-settings'),
        onShowSlideshows: createMenuEventListener('menu:show-slideshows'),
        onShowMusic: createMenuEventListener('menu:show-music'),
        onShowSettings: createMenuEventListener('menu:show-settings'),
        onPlaySlideshow: createMenuEventListener('menu:play-slideshow'),
        onPauseSlideshow: createMenuEventListener('menu:pause-slideshow'),
        onStopSlideshow: createMenuEventListener('menu:stop-slideshow'),
        onNextPhoto: createMenuEventListener('menu:next-photo'),
        onPreviousPhoto: createMenuEventListener('menu:previous-photo'),
        onShowHelp: createMenuEventListener('menu:show-help'),
        onShowShortcuts: createMenuEventListener('menu:show-shortcuts'),
        onClearRecent: createMenuEventListener('menu:clear-recent'),
        // Menu state management
        updateState: (state) => electron_1.ipcRenderer.invoke('menu:update-state', state)
    }
});
