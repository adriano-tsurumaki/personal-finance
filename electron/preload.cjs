const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getTransactions: (month) => ipcRenderer.invoke('transactions:list', month),
  createTransaction: (input) =>
    ipcRenderer.invoke('transactions:create', input),
  updateTransaction: (id, input) =>
    ipcRenderer.invoke('transactions:update', id, input),
  deleteTransaction: (id) => ipcRenderer.invoke('transactions:delete', id),
});

contextBridge.exposeInMainWorld('desktopWindow', {
  platform: process.platform,
  minimize: () => ipcRenderer.invoke('window:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize'),
  close: () => ipcRenderer.invoke('window:close'),

  onMaximizedChange: (callback) => {
    const listener = (_event, maximized) => {
      callback(maximized);
    };

    ipcRenderer.on('window:maximized-change', listener);

    return () => {
      ipcRenderer.removeListener('window:maximized-change', listener);
    };
  },
});
