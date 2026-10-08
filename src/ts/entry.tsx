import { createRoot } from 'react-dom/client';
import App from './app';
import '../renderer/global.css';

const root = createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);
