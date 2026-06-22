/**
 * Sổ Sách Xưởng An - Notification Helper
 * Provides robust system/browser-level notifications (Web Notification API) for mobile application/APK.
 */

/**
 * Play a high-quality synthesised notification sound using Web Audio API (cross-platform offline friendly)
 */
export function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Play a dual-tone chime (friendly notification sound)
    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(440, now); // A4
    osc2.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
    
    // Smooth volume fade
    gainNode.gain.setValueAtTime(0.18, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.5);
    osc2.stop(now + 0.5);
  } catch (e) {
    console.warn("Could not play notification chime via Web Audio:", e);
  }
}

/**
 * Requests browser permission to display system notifications
 */
export function requestNotificationPermission() {
  if (!("Notification" in window)) {
    console.warn("This device does not support system notifications.");
    return;
  }
  
  if (Notification.permission === "default") {
    Notification.requestPermission()
      .then((permission) => {
        console.log(`System Notification permission status: ${permission}`);
      })
      .catch((err) => {
        console.error("Error requesting notification permission:", err);
      });
  }
}

/**
 * Triggers a native system notification outside the app (works in browser and PWA/APK webview)
 */
export function sendSystemNotification(title: string, body: string, options?: NotificationOptions) {
  // Always trigger the premium audio chime
  playNotificationChime();
  
  if (!("Notification" in window)) {
    return;
  }
  
  if (Notification.permission === "granted") {
    try {
      const notif = new Notification(title, {
        body,
        tag: "xuang_an_notif_" + Date.now(),
        requireInteraction: false,
        silent: true, // we handle the sound ourselves with Web Audio
        ...options
      });
      
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    } catch (e) {
      console.warn("Direct Notification constructor failed. Fallback to Service Worker.", e);
      if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.showNotification(title, {
            body,
            silent: true,
            ...options
          });
        });
      }
    }
  } else if (Notification.permission === "default") {
    // Attempt to prompt and notify if granted
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        try {
          new Notification(title, { body, silent: true, ...options });
        } catch (e) {
          if (navigator.serviceWorker && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, { body, silent: true, ...options }));
          }
        }
      }
    });
  }
}
