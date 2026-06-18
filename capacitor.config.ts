import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xuongan.quanlykho',
  appName: 'Quan Ly Xuong An',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    CapacitorUpdater: {
      autoUpdate: true,
      appId: '9bc744d0-6da2-4d42-9d7e-441b4c25b763'
    }
  }
};

export default config;
