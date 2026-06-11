import { useEffect } from 'react';

/**
 * Custom hook to intercept the Android hardware back button (popstate/backbutton event).
 * When 'isOpen' is true, pressing back will invoke 'onClose' instead of changing routes or exiting.
 */
export function useAndroidBack(isOpen: boolean, onClose: () => void) {
  useEffect(() => {
    if (!isOpen) return;

    const handler = () => {
      onClose();
      return true; // Flag indicating we fully handled the back press
    };

    const w = window as any;
    w.androidBackHandlers = w.androidBackHandlers || [];
    
    // We add the handler to the end of the stack (LIFO order ensures nested modals close in reverse order)
    w.androidBackHandlers.push(handler);

    return () => {
      if (w.androidBackHandlers) {
        w.androidBackHandlers = w.androidBackHandlers.filter((h: any) => h !== handler);
      }
    };
  }, [isOpen, onClose]);
}
