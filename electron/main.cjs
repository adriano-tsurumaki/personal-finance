const path = require('node:path');
const {
  app,
  BrowserWindow,
  WebContentsView,
  dialog,
  ipcMain,
} = require('electron');
const started = require('electron-squirrel-startup');
const { initDb } = require('../src/main/db.ts');
const { getDevelopmentDatabasePath } = require('../src/main/db/config.ts');
const { registerIpcHandlers } = require('../src/main/ipc.ts');

const TITLEBAR_HEIGHT = 28;

let mainWindow = null;
let contentView = null;

if (started) {
  app.quit();
}

function getPreloadPath() {
  return path.join(__dirname, 'preload.js');
}

const rendererFile = (name) =>
  path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/src/html/${name}`);

const rendererUrl = (name) =>
  new URL(`src/html/${name}`, MAIN_WINDOW_VITE_DEV_SERVER_URL).toString();

function resizeContentView() {
  if (!mainWindow || !contentView) {
    return;
  }

  const { width, height } = mainWindow.getContentBounds();

  contentView.setBounds({
    x: 0,
    y: TITLEBAR_HEIGHT,
    width,
    height: Math.max(0, height - TITLEBAR_HEIGHT),
  });
}

function sendMaximizedState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send(
    'window:maximized-change',
    mainWindow.isMaximized(),
  );
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 700,
    minHeight: 500,

    /*
     * Remove the native frame. The application draws the controls and
     * defines the draggable region.
     */
    frame: false,

    backgroundColor: '#181818',

    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  /*
   * A BrowserWindow carrega apenas a TitleBar.
   */
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(rendererUrl('titlebar.html'));
  } else {
    await mainWindow.loadFile(rendererFile('titlebar.html'));
  }

  /*
   * React content runs in a separate renderer.
   */
  contentView = new WebContentsView({
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.contentView.addChildView(contentView);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await contentView.webContents.loadURL(rendererUrl('index.html'));
  } else {
    await contentView.webContents.loadFile(rendererFile('index.html'));
  }

  resizeContentView();

  mainWindow.on('resize', resizeContentView);
  mainWindow.on('maximize', () => {
    resizeContentView();
    sendMaximizedState();
  });

  mainWindow.on('unmaximize', () => {
    resizeContentView();
    sendMaximizedState();
  });

  mainWindow.on('restore', resizeContentView);

  if (!app.isPackaged) {
    contentView.webContents.openDevTools({ mode: 'detach' });
  }

  /*
   * Keep the title bar alive if only the React renderer fails.
   */
  contentView.webContents.on('render-process-gone', (_event, details) => {
    console.error('The content renderer failed:', details.reason);

    /*
     * Reload the renderer after an unexpected failure.
     */
    if (details.reason !== 'clean-exit') {
      setTimeout(() => {
        if (contentView && !contentView.webContents.isDestroyed()) {
          contentView.webContents.reload();
        }
      }, 500);
    }
  });

  mainWindow.on('closed', () => {
    /*
     * Explicitly destroy the WebContents when the WebContentsView is no
     * longer needed.
     */
    if (contentView && !contentView.webContents.isDestroyed()) {
      contentView.webContents.close();
    }

    contentView = null;
    mainWindow = null;
  });
}

ipcMain.handle('window:minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.handle('window:toggle-maximize', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);

  if (!window) {
    return false;
  }

  if (window.isMaximized()) {
    window.unmaximize();
  } else {
    window.maximize();
  }

  return window.isMaximized();
});

ipcMain.handle('window:close', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

app
  .whenReady()
  .then(async () => {
    const dbPath = app.isPackaged
      ? path.join(app.getPath('userData'), 'personal_finance.db')
      : getDevelopmentDatabasePath(app.getAppPath());
    const migrationsFolder = path.join(
      app.isPackaged ? process.resourcesPath : app.getAppPath(),
      'drizzle',
    );
    const db = initDb(dbPath, migrationsFolder);
    app.once('will-quit', () => db.$client.close());

    registerIpcHandlers(db, () => contentView?.webContents);
    await createWindow();
  })
  .catch((error) => {
    console.error('Failed to initialize the application:', error);
    dialog.showErrorBox(
      'Startup error',
      'The application could not be initialized and will now close.\n\n' +
        (error instanceof Error ? error.message : String(error)),
    );
    app.quit();
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
