import { Menu, app, shell, dialog, BrowserWindow } from 'electron';
import type { MenuItemConstructorOptions } from 'electron';

/**
 * Creates the macOS application menu with standard menus and keyboard shortcuts
 * @param mainWindow - The main BrowserWindow instance
 */
function createMenu(mainWindow: BrowserWindow): void {
  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    {
      label: app.name,
      submenu: [
        {
          label: `About ${app.name}`,
          click: () => {
            showAboutDialog(mainWindow);
          }
        },
        { type: 'separator' },
        {
          label: 'Preferences...',
          accelerator: 'CmdOrCtrl+,',
          click: () => {
            mainWindow.webContents.send('menu:preferences');
          }
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'New Slideshow',
          accelerator: 'CmdOrCtrl+N',
          click: () => {
            mainWindow.webContents.send('menu:new-slideshow');
          }
        },
        {
          label: 'Open Recent',
          submenu: [
            {
              label: 'Clear Menu',
              click: () => {
                mainWindow.webContents.send('menu:clear-recent');
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Import Photos...',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            mainWindow.webContents.send('menu:import-photos');
          }
        },
        {
          label: 'Import Music...',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            mainWindow.webContents.send('menu:import-music');
          }
        },
        { type: 'separator' },
        {
          label: 'Export Slideshow...',
          accelerator: 'CmdOrCtrl+E',
          enabled: false, // Will be enabled when slideshow is active
          click: () => {
            mainWindow.webContents.send('menu:export-slideshow');
          }
        },
        { type: 'separator' },
        { role: 'close' }
      ]
    },
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Slideshow Settings...',
          accelerator: 'CmdOrCtrl+T',
          enabled: false, // Will be enabled when slideshow is selected
          click: () => {
            mainWindow.webContents.send('menu:slideshow-settings');
          }
        }
      ]
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Show Slideshows',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow.webContents.send('menu:show-slideshows');
          }
        },
        {
          label: 'Show Music Library',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow.webContents.send('menu:show-music');
          }
        },
        {
          label: 'Show Settings',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow.webContents.send('menu:show-settings');
          }
        }
      ]
    },
    // Slideshow menu
    {
      label: 'Slideshow',
      submenu: [
        {
          label: 'Play Slideshow',
          accelerator: 'Space',
          enabled: false, // Will be enabled when slideshow is selected
          click: () => {
            mainWindow.webContents.send('menu:play-slideshow');
          }
        },
        {
          label: 'Pause Slideshow',
          accelerator: 'Space',
          enabled: false, // Will be enabled when slideshow is playing
          click: () => {
            mainWindow.webContents.send('menu:pause-slideshow');
          }
        },
        {
          label: 'Stop Slideshow',
          accelerator: 'Escape',
          enabled: false, // Will be enabled when slideshow is playing
          click: () => {
            mainWindow.webContents.send('menu:stop-slideshow');
          }
        },
        { type: 'separator' },
        {
          label: 'Next Photo',
          accelerator: 'Right',
          enabled: false, // Will be enabled when slideshow is playing
          click: () => {
            mainWindow.webContents.send('menu:next-photo');
          }
        },
        {
          label: 'Previous Photo',
          accelerator: 'Left',
          enabled: false, // Will be enabled when slideshow is playing
          click: () => {
            mainWindow.webContents.send('menu:previous-photo');
          }
        }
      ]
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ]
    },
    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Slideshow Buddy Help',
          accelerator: 'CmdOrCtrl+?',
          click: () => {
            mainWindow.webContents.send('menu:show-help');
          }
        },
        {
          label: 'Keyboard Shortcuts',
          click: () => {
            mainWindow.webContents.send('menu:show-shortcuts');
          }
        },
        { type: 'separator' },
        {
          label: 'Report an Issue',
          click: async () => {
            await shell.openExternal('https://github.com/yourusername/slideshow-buddy/issues');
          }
        },
        {
          label: 'Learn More',
          click: async () => {
            await shell.openExternal('https://github.com/yourusername/slideshow-buddy');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Shows the About dialog with app information
 * @param parentWindow - Parent window for the dialog
 */
function showAboutDialog(parentWindow: BrowserWindow): void {
  const appName = app.name || 'Slideshow Buddy';
  const appVersion = app.getVersion() || '1.0.0';
  
  dialog.showMessageBox(parentWindow, {
    type: 'info',
    title: `About ${appName}`,
    message: appName,
    detail: [
      `Version ${appVersion}`,
      '',
      'Create beautiful photo slideshows with music.',
      '',
      'Built with Electron and Ionic React',
      '',
      `Copyright © ${new Date().getFullYear()}`
    ].join('\n'),
    buttons: ['OK'],
    defaultId: 0,
    icon: undefined // You can add an app icon path here if available
  });
}

/**
 * Updates menu item states based on current application state
 * @param state - Current application state
 */
function updateMenuState(state: {
  hasSlideshow?: boolean;
  isPlaying?: boolean;
  canExport?: boolean;
}): void {
  const menu = Menu.getApplicationMenu();
  if (!menu) return;

  // Helper function to find menu item by label
  const findMenuItem = (menu: Menu, labels: string[]): Electron.MenuItem | null => {
    for (const item of menu.items) {
      if (item.label === labels[0]) {
        if (labels.length === 1) {
          return item;
        } else if (item.submenu) {
          return findMenuItem(item.submenu, labels.slice(1));
        }
      }
    }
    return null;
  };

  // Update File menu items
  const exportItem = findMenuItem(menu, ['File', 'Export Slideshow...']);
  if (exportItem) {
    exportItem.enabled = state.canExport || false;
  }

  // Update Edit menu items
  const settingsItem = findMenuItem(menu, ['Edit', 'Slideshow Settings...']);
  if (settingsItem) {
    settingsItem.enabled = state.hasSlideshow || false;
  }

  // Update Slideshow menu items
  const playItem = findMenuItem(menu, ['Slideshow', 'Play Slideshow']);
  const pauseItem = findMenuItem(menu, ['Slideshow', 'Pause Slideshow']);
  const stopItem = findMenuItem(menu, ['Slideshow', 'Stop Slideshow']);
  const nextItem = findMenuItem(menu, ['Slideshow', 'Next Photo']);
  const prevItem = findMenuItem(menu, ['Slideshow', 'Previous Photo']);

  if (playItem) {
    playItem.enabled = (state.hasSlideshow && !state.isPlaying) || false;
  }
  if (pauseItem) {
    pauseItem.enabled = state.isPlaying || false;
  }
  if (stopItem) {
    stopItem.enabled = state.isPlaying || false;
  }
  if (nextItem) {
    nextItem.enabled = state.isPlaying || false;
  }
  if (prevItem) {
    prevItem.enabled = state.isPlaying || false;
  }
}

export { createMenu, showAboutDialog, updateMenuState };