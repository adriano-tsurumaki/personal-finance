const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getCategories: () => ipcRenderer.invoke('categories:list'),
  createCategory: (input) => ipcRenderer.invoke('categories:create', input),
  updateCategory: (id, input) =>
    ipcRenderer.invoke('categories:update', id, input),
  archiveCategory: (id) => ipcRenderer.invoke('categories:archive', id),
  listProfiles: () => ipcRenderer.invoke('profiles:list'),
  getActiveProfile: () => ipcRenderer.invoke('profiles:current'),
  createProfile: (input) => ipcRenderer.invoke('profiles:create', input),
  enterProfile: (id) => ipcRenderer.invoke('profiles:enter', id),
  leaveProfile: () => ipcRenderer.invoke('profiles:leave'),
  getProfileOptions: () => ipcRenderer.invoke('profiles:options'),
  updateProfileLocale: (locale) =>
    ipcRenderer.invoke('profiles:update-locale', locale),
  getTransactions: (month) => ipcRenderer.invoke('transactions:list', month),
  getMonthlyStatement: (month) =>
    ipcRenderer.invoke('statements:monthly', month),
  getTransaction: (id) => ipcRenderer.invoke('transactions:get', id),
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
