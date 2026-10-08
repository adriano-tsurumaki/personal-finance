import type { Api } from './shared/contracts/api';

export {};

declare global {
  interface Window {
    desktopWindow: {
      minimize(): Promise<void>;
      toggleMaximize(): Promise<boolean>;
      close(): Promise<void>;
      onMaximizedChange(callback: (isMaximized: boolean) => void): () => void;
      platform: 'win32' | 'darwin' | 'linux';
    };

    api: Api;
  }
}
