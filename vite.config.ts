import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import {defineConfig} from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  // Use VITE_BASE_URL if explicitly defined, otherwise default to relative paths './'
  // to guarantee robust asset loading across both root environments (like Cloud Run) 
  // and nested subfolders/subdirectories (such as GitHub Pages 'appkhohang.github.io/App-kho-hang/' or mobile APKs).
  const base = process.env.VITE_BASE_URL || './';

  return {
    base: base,
    plugins: [
      react(), 
      tailwindcss(),
      {
        name: 'b2-api-proxy',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            const url = req.url ? req.url.split('?')[0] : '';
            if (url.startsWith('/api/b2/')) {
              let bodyStr = '';
              req.on('data', chunk => {
                bodyStr += chunk;
              });
              req.on('end', async () => {
                let body: any = {};
                try {
                  if (bodyStr) body = JSON.parse(bodyStr);
                } catch (e) {}

                res.setHeader('Content-Type', 'application/json');

                if (url === '/api/b2/authorize') {
                  const { applicationKeyId, applicationKey } = body;
                  if (!applicationKeyId || !applicationKey) {
                    res.statusCode = 400;
                    return res.end(JSON.stringify({ message: "Thiếu Application Key ID hoặc Application Key." }));
                  }
                  const authHeader = 'Basic ' + Buffer.from(`${applicationKeyId}:${applicationKey}`).toString('base64');
                  try {
                    const b2Res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
                      method: 'GET',
                      headers: { 'Authorization': authHeader, 'Accept': 'application/json' }
                    });
                    const data = await b2Res.json();
                    res.statusCode = b2Res.status;
                    return res.end(JSON.stringify({
                      apiUrl: data.apiUrl,
                      authorizationToken: data.authorizationToken,
                      downloadUrl: data.downloadUrl
                    }));
                  } catch (err: any) {
                    res.statusCode = 500;
                    return res.end(JSON.stringify({ message: err.message || "Lỗi proxy kết nối Backblaze B2" }));
                  }
                }

                if (url === '/api/b2/getUploadUrl') {
                  const { apiUrl, authorizationToken, bucketId } = body;
                  if (!apiUrl || !authorizationToken || !bucketId) {
                    res.statusCode = 400;
                    return res.end(JSON.stringify({ message: "Thiếu thông tin kết nối hoặc bucketId" }));
                  }
                  try {
                    const b2Res = await fetch(`${apiUrl}/b2api/v2/b2_get_upload_url`, {
                      method: 'POST',
                      headers: {
                        'Authorization': authorizationToken,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ bucketId })
                    });
                    const data = await b2Res.json();
                    res.statusCode = b2Res.status;
                    return res.end(JSON.stringify(data));
                  } catch (err: any) {
                    res.statusCode = 500;
                    return res.end(JSON.stringify({ message: err.message || "Lỗi lấy Upload URL" }));
                  }
                }

                if (url === '/api/b2/uploadFile') {
                  const { uploadUrl, authorizationToken, filePath, fileType, fileBase64 } = body;
                  if (!uploadUrl || !authorizationToken || !filePath || !fileBase64) {
                    res.statusCode = 400;
                    return res.end(JSON.stringify({ message: "Thiếu dữ liệu tải lên." }));
                  }
                  try {
                    const buffer = Buffer.from(fileBase64, 'base64');
                    const b2Res = await fetch(uploadUrl, {
                      method: 'POST',
                      headers: {
                        'Authorization': authorizationToken,
                        'X-Bz-File-Name': encodeURIComponent(filePath),
                        'Content-Type': fileType || 'image/jpeg',
                        'X-Bz-Content-Sha1': 'do_not_verify'
                      },
                      body: buffer
                    });
                    const data = await b2Res.json();
                    res.statusCode = b2Res.status;
                    return res.end(JSON.stringify(data));
                  } catch (err: any) {
                    res.statusCode = 500;
                    return res.end(JSON.stringify({ message: err.message || "Lỗi tải ảnh lên B2" }));
                  }
                }

                if (url === '/api/b2/deleteFile') {
                  const { apiUrl, authorizationToken, fileId, fileName } = body;
                  if (!apiUrl || !authorizationToken || !fileId || !fileName) {
                    res.statusCode = 400;
                    return res.end(JSON.stringify({ message: "Thiếu dữ liệu để xóa file." }));
                  }
                  try {
                    const b2Res = await fetch(`${apiUrl}/b2api/v2/b2_delete_file_version`, {
                      method: 'POST',
                      headers: {
                        'Authorization': authorizationToken,
                        'Content-Type': 'application/json'
                      },
                      body: JSON.stringify({ fileId, fileName })
                    });
                    const data = await b2Res.json();
                    res.statusCode = b2Res.status;
                    return res.end(JSON.stringify(data));
                  } catch (err: any) {
                    res.statusCode = 500;
                    return res.end(JSON.stringify({ message: err.message || "Lỗi xóa file" }));
                  }
                }

                if (url === '/api/b2/getBucketSize') {
                  const { apiUrl, authorizationToken, bucketId } = body;
                  if (!apiUrl || !authorizationToken || !bucketId) {
                    res.statusCode = 400;
                    return res.end(JSON.stringify({ message: "Thiếu thông tin kết nối hoặc bucketId" }));
                  }
                  try {
                    let totalSize = 0;
                    let fileCount = 0;
                    let startFileName: string | null = null;
                    let hasMore = true;
                    let page = 0;
                    const maxPages = 15;
                    while (hasMore && page < maxPages) {
                      const payload: any = { bucketId, maxFileCount: 1000 };
                      if (startFileName) payload.startFileName = startFileName;
                      const b2Res = await fetch(`${apiUrl}/b2api/v2/b2_list_file_names`, {
                        method: 'POST',
                        headers: {
                          'Authorization': authorizationToken,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                      });
                      if (!b2Res.ok) {
                        const errData = await b2Res.json().catch(() => ({}));
                        res.statusCode = b2Res.status;
                        return res.end(JSON.stringify(errData));
                      }
                      const data = await b2Res.json();
                      const files = data.files || [];
                      fileCount += files.length;
                      for (const file of files) {
                        totalSize += file.contentLength || 0;
                      }
                      startFileName = data.nextFileName || null;
                      hasMore = !!startFileName;
                      page++;
                    }
                    res.statusCode = 200;
                    return res.end(JSON.stringify({ totalSize, fileCount }));
                  } catch (err: any) {
                    res.statusCode = 500;
                    return res.end(JSON.stringify({ message: err.message || "Lỗi lấy dung lượng" }));
                  }
                }

                res.statusCode = 404;
                return res.end(JSON.stringify({ message: "Endpoint không tồn tại" }));
              });
            } else {
              next();
            }
          });
        }
      }
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
