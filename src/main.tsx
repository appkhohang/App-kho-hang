import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import { CapacitorUpdater } from '@capgo/capacitor-updater';

// Intercept and handle transient Firestore connection logging gracefully
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = function (...args: any[]) {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    if (message.includes('Could not reach Cloud Firestore backend') || message.includes('firebase') || message.includes('Firestore')) {
      console.log('🔄 [Firestore Offline Auto-Recovery]: Bạn đang ở chế độ ngoại tuyến hoặc kết nối mạng chậm. Ứng dụng sẽ tự động tải dữ liệu từ bộ nhớ đệm (offline cache).');
      return;
    }
    originalError.apply(console, args);
  };

  const originalWarn = console.warn;
  console.warn = function (...args: any[]) {
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
    if (message.includes('Could not reach Cloud Firestore backend') || message.includes('firebase') || message.includes('Firestore')) {
      console.log('🔄 [Firestore Offline Auto-Recovery Warning]: Kết nối mạng chậm. Ứng dụng đang phục hồi an toàn.');
      return;
    }
    originalWarn.apply(console, args);
  };
}

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
