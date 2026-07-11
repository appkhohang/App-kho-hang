import fs from 'fs';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import path from 'path';

// Load .env configuration
dotenv.config();

function run() {
  // Sanitize inputs to remove any trailing/leading spaces or newlines copied by mistake
  let supaUrl = (process.env.CAPGO_SUPABASE_URL || '').replace(/\s+/g, '');
  if (supaUrl) {
    if (!/^https?:\/\//i.test(supaUrl)) {
      supaUrl = 'https://' + supaUrl;
    }
    // Remove trailing slashes
    supaUrl = supaUrl.replace(/\/+$/, '');
  }
  // Uploading bundles requires write access to Supabase DB and Storage.
  // We check for CAPGO_SUPABASE_SERVICE_KEY first, and fall back to CAPGO_SUPABASE_ANON_KEY.
  let supaAnonKey = process.env.CAPGO_SUPABASE_SERVICE_KEY || process.env.CAPGO_SUPABASE_ANON_KEY;
  if (supaAnonKey) {
    supaAnonKey = supaAnonKey.replace(/\s+/g, '');
  }

  if (!supaUrl || !supaAnonKey) {
    console.error('\x1b[31m%s\x1b[0m', '❌ Lỗi: Thiếu cấu hình Supabase!');
    console.error('Vui lòng khai báo các biến sau trong file `.env` ở thư mục gốc của bạn:');
    console.log('\x1b[36m%s\x1b[0m', 'CAPGO_SUPABASE_URL=https://your-project-id.supabase.co');
    console.log('\x1b[36m%s\x1b[0m', 'CAPGO_SUPABASE_SERVICE_KEY=your-supabase-service-role-key');
    console.log('\n\x1b[33m%s\x1b[0m', '💡 Lưu ý quan trọng:');
    console.log('Khác với ứng dụng di động (chỉ cần đọc công khai bằng Anon Key),');
    console.log('Script đẩy bản cập nhật (Upload) này cần quyền GHI dữ liệu vào database và Storage.');
    console.log('Vì vậy, biến trên phải là mã khóa "service_role" bí mật (không được để lộ công khai).');
    process.exit(1);
  }

  try {
    // 1. Tăng phiên bản tự động bằng script bump-version
    console.log('\x1b[35m%s\x1b[0m', '🚀 Bước 1: Tăng số hiệu phiên bản ứng dụng (Bump Version)...');
    execSync('node scripts/bump-version.js', { stdio: 'inherit' });

    // 2. Biên dịch code web tĩnh mới nhất
    console.log('\n\x1b[35m%s\x1b[0m', '🚀 Bước 2: Build code web tĩnh ứng dụng (Vite production build)...');
    execSync('npx vite build', { stdio: 'inherit' });

    // 3. Đọc số hiệu phiên bản mới nhất vừa tăng
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const version = pkg.version;

    // 4. Gọi Capgo CLI để đóng gói và đẩy trực tiếp lên Supabase
    console.log(`\n\x1b[35m%s\x1b[0m`, `🚀 Bước 3: Đóng gói và upload bundle v${version} lên Supabase...`);
    
    const cmd = `npx @capgo/cli bundle upload --supa-host "${supaUrl}" --supa-anon "${supaAnonKey}" -a sb_self_hosted -c production -b "${version}" --zip com.xuongan.quanlykho`;
    
    console.log(`Chạy câu lệnh: ${cmd.substring(0, 100)}... [ANON KEY HIDDEN]`);
    
    execSync(cmd, { stdio: 'inherit' });

    console.log('\n\x1b[32m%s\x1b[0m', `🎉 Thành công! Phiên bản v${version} đã được đóng gói và cập nhật trực tiếp lên Supabase Storage/Database.`);
    console.log('Các thiết bị cài đặt ứng dụng có cấu hình localSupa sẽ tự động tải bản vá này trong lần khởi chạy tiếp theo.');

  } catch (error) {
    console.error('\n\x1b[31m%s\x1b[0m', '❌ Đã xảy ra lỗi trong quá trình đẩy phiên bản cập nhật:');
    console.error(error.message || error);
    process.exit(1);
  }
}

run();
