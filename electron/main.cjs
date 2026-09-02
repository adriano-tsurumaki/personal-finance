const path = require('node:path');
const {
    app,
    BrowserWindow,
    WebContentsView,
    ipcMain,
} = require('electron');
const started = require('electron-squirrel-startup');

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
    path.join(
        __dirname,
        `../renderer/${MAIN_WINDOW_VITE_NAME}/src/html/${name}`,
    );

const rendererUrl = (name) =>
    new URL(
        `src/html/${name}`,
        MAIN_WINDOW_VITE_DEV_SERVER_URL,
    ).toString();

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
         * Remove a barra nativa. Agora somos responsáveis por desenhar
         * os botões e a região arrastável.
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
     * O conteúdo React fica em um renderer separado.
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
     * Se somente o React falhar, a TitleBar continua viva.
     */
    contentView.webContents.on(
        'render-process-gone',
        (_event, details) => {
            console.error(
                'O renderer do conteúdo falhou:',
                details.reason,
            );

            /*
             * Você pode mostrar uma página de erro ou tentar recarregar.
             */
            if (details.reason !== 'clean-exit') {
                setTimeout(() => {
                    if (
                        contentView &&
                        !contentView.webContents.isDestroyed()
                    ) {
                        contentView.webContents.reload();
                    }
                }, 500);
            }
        },
    );

    mainWindow.on('closed', () => {
        /*
         * WebContentsView precisa ter seu WebContents destruído
         * explicitamente quando não será mais usado.
         */
        if (
            contentView &&
            !contentView.webContents.isDestroyed()
        ) {
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

    if (!window) return false;

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

app.whenReady().then(createWindow);

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
