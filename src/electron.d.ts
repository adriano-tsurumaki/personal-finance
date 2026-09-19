import { Api } from './shared/types';

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
