import type { Api } from './shared/contracts/api';
import type { AppearanceApi } from './shared/contracts/appearance';

export {};

declare global {
  interface Window {
    appearance: AppearanceApi;
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
