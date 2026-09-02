const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopWindow', {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
    close: () => ipcRenderer.invoke('window:close'),

    onMaximizedChange: (callback) => {
        const listener = (_event, maximized) => {
            callback(maximized);
        };

        ipcRenderer.on('window:maximized-change', listener);

        return () => {
            ipcRenderer.removeListener(
                'window:maximized-change',
                listener,
            );
        };
    },
});