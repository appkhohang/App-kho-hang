import fs from 'fs';
import path from 'path';

const file = path.join('node_modules', '@capgo', 'cli', 'dist', 'index.js');

function patch() {
  if (!fs.existsSync(file)) {
    console.log(`⚠️ Warning: Capgo CLI index.js not found at ${file}. Skipping patch.`);
    return;
  }

  try {
    let content = fs.readFileSync(file, 'utf8');
    const target = 'return Y.data.url';
    const replacement = 'let resUrl = Y.data.url; if (resUrl && resUrl.startsWith("/")) { resUrl = A.supabaseUrl + resUrl; console.log("   [Patch] Absolute upload URL resolved: " + resUrl); } return resUrl;';

    if (content.includes(target)) {
      content = content.replace(target, replacement);
      fs.writeFileSync(file, content, 'utf8');
      console.log('✅ Capgo CLI successfully patched to handle relative Supabase upload URLs!');
    } else {
      console.log('ℹ️ Capgo CLI is already patched or does not contain the target pattern.');
    }
  } catch (error) {
    console.error('❌ Failed to patch Capgo CLI:', error.message || error);
  }
}

patch();
