const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  indicatorAnchor: {
    get: () => ipcRenderer.invoke('indicator-anchor:get'),
    save: (input) => ipcRenderer.invoke('indicator-anchor:save', input),
    remove: () => ipcRenderer.invoke('indicator-anchor:remove'),
  },
  installment: {
    list: () => ipcRenderer.invoke('installments:list'),
    preview: (input) => ipcRenderer.invoke('installments:preview', input),
    create: (input, token) =>
      ipcRenderer.invoke('installments:create', input, token),
    rename: (id, name, note) =>
      ipcRenderer.invoke('installments:rename', id, name, note),
    previewRemove: (id) =>
      ipcRenderer.invoke('installments:preview-remove', id),
    remove: (id, token) => ipcRenderer.invoke('installments:remove', id, token),
  },
  getFinancialMonth: (month) => ipcRenderer.invoke('financial:month', month),
  recurrence: {
    previewBoundary: (input) =>
      ipcRenderer.invoke('recurrences:preview-boundary', input),
    dismissLegacy: (id) => ipcRenderer.invoke('recurrences:dismiss-legacy', id),
    list: () => ipcRenderer.invoke('recurrences:list'),
    month: (month) => ipcRenderer.invoke('recurrences:month', month),
    forecast: (start, end) =>
      ipcRenderer.invoke('recurrences:forecast', start, end),
    create: (input) => ipcRenderer.invoke('recurrences:create', input),
    update: (input) => ipcRenderer.invoke('recurrences:update', input),
    boundary: (input) => ipcRenderer.invoke('recurrences:boundary', input),
    resume: (input) => ipcRenderer.invoke('recurrences:resume', input),
    confirm: (input) => ipcRenderer.invoke('recurrences:confirm', input),
    ignore: (input) => ipcRenderer.invoke('recurrences:ignore', input),
    restore: (input) => ipcRenderer.invoke('recurrences:restore', input),
    coverage: (input) => ipcRenderer.invoke('recurrences:coverage', input),
  },
  getCreditCards: () => ipcRenderer.invoke('cards:list'),
  previewCreditCard: (input, month) =>
    ipcRenderer.invoke('cards:preview', input, month),
  suggestInvoicePeriod: (id, date) =>
    ipcRenderer.invoke('invoices:suggest', id, date),
  createCreditCard: (input) => ipcRenderer.invoke('cards:create', input),
  renameCreditCard: (id, name) => ipcRenderer.invoke('cards:rename', id, name),
  archiveCreditCard: (id) => ipcRenderer.invoke('cards:archive', id),
  previewInvoicePeriod: (id, month) =>
    ipcRenderer.invoke('invoices:period', id, month),
  getCardInvoices: (id) => ipcRenderer.invoke('invoices:list', id),
  getInvoiceDetails: (id) => ipcRenderer.invoke('invoices:details', id),
  setInvoicePayment: (id, input) =>
    ipcRenderer.invoke('invoices:payment', id, input),
  registerInvoice: (id, input) =>
    ipcRenderer.invoke('invoices:register', id, input),
  previewInvoiceCorrection: (id, input) =>
    ipcRenderer.invoke('invoices:preview-correction', id, input),
  correctInvoice: (id, input, token) =>
    ipcRenderer.invoke('invoices:correct', id, input, token),
  getUnlinkedCreditEntries: () => ipcRenderer.invoke('invoices:unlinked'),
  previewInvoiceAssociation: (id, input) =>
    ipcRenderer.invoke('invoices:preview-association', id, input),
  associateInvoice: (id, input, token) =>
    ipcRenderer.invoke('invoices:associate', id, input, token),
  previewTransactionCreation: (input) =>
    ipcRenderer.invoke('transactions:preview-create', input),
  previewTransactionUpdate: (id, input) =>
    ipcRenderer.invoke('transactions:preview-update', id, input),
  previewTransactionDeletion: (id) =>
    ipcRenderer.invoke('transactions:preview-delete', id),
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
  deleteTransaction: (id, token) =>
    ipcRenderer.invoke('transactions:delete', id, token),
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
