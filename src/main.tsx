import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

// Notify Capgo OTA updater of a successful load
try {
  CapacitorUpdater.notifyAppReady();
} catch (e) {
  console.log('CapacitorUpdater is not available on this platform:', e);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
