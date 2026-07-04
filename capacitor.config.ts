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
      
      // === CẤU HÌNH CAPGO CLOUD (MẶC ĐỊNH) ===
      appId: '9bc744d0-6da2-4d42-9d7e-441b4c25b763'
      
      // === CẤU HÌNH SELF-HOSTED (SUPABASE) ===
      // Để chuyển đổi sang Supabase tự lưu trữ (Self-Hosted), hãy làm theo 2 bước:
      // 1. Comment dòng `appId` của Capgo Cloud ở trên (thêm dấu // phía trước).
      // 2. Mở comment 2 dòng dưới đây và thay bằng URL / Anon Key từ Supabase Dashboard của bạn:
      // localSupa: 'https://your-supabase-project.supabase.co',
      // localSupaAnon: 'your-supabase-anon-key'
    }
  }
};

export default config;
