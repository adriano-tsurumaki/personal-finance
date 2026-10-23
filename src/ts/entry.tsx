import { createRoot } from 'react-dom/client';
import App from './app';
import '../renderer/global.css';
import { initializeAppearance } from '@store/appearance';
import { loadThemeFonts } from '@lib/theme-fonts';

const disconnectAppearance = initializeAppearance();
loadThemeFonts();

if (import.meta.hot) {
  import.meta.hot.dispose(disconnectAppearance);
}

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
