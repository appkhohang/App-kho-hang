import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Add bodyParser middleware to parse JSON payloads with generous limits
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Enable CORS with support for all origins (including capacitor/mobile webviews)
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
    credentials: true
  }));

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // B2 Proxy endpoints to bypass browser CORS constraints
  app.post("/api/b2/authorize", async (req, res) => {
    const { applicationKeyId, applicationKey } = req.body;
    if (!applicationKeyId || !applicationKey) {
      return res.status(400).json({ message: "Thiếu Application Key ID hoặc Application Key." });
    }

    const authHeader = 'Basic ' + Buffer.from(`${applicationKeyId}:${applicationKey}`).toString('base64');
    
    try {
      const b2Res = await fetch('https://api.backblazeb2.com/b2api/v2/b2_authorize_account', {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });

      if (!b2Res.ok) {
        const errData = await b2Res.json().catch(() => ({}));
        return res.status(b2Res.status).json(errData);
      }

      const data = await b2Res.json();
      return res.json({
        apiUrl: data.apiUrl,
        authorizationToken: data.authorizationToken,
        downloadUrl: data.downloadUrl
      });
    } catch (err: any) {
      console.error('B2 Auth Proxy Error:', err);
      return res.status(500).json({ message: err.message || "Lỗi proxy kết nối Backblaze B2" });
    }
  });

  app.post("/api/b2/getUploadUrl", async (req, res) => {
    const { apiUrl, authorizationToken, bucketId } = req.body;
    if (!apiUrl || !authorizationToken || !bucketId) {
      return res.status(400).json({ message: "Thiếu thông tin kết nối hoặc bucketId" });
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

      if (!b2Res.ok) {
        const errData = await b2Res.json().catch(() => ({}));
        return res.status(b2Res.status).json(errData);
      }

      const data = await b2Res.json();
      return res.json(data);
    } catch (err: any) {
      console.error('B2 Get Upload URL Proxy Error:', err);
      return res.status(500).json({ message: err.message || "Lỗi lấy Upload URL qua proxy" });
    }
  });

  app.post("/api/b2/uploadFile", async (req, res) => {
    const { uploadUrl, authorizationToken, filePath, fileType, fileBase64 } = req.body;
    if (!uploadUrl || !authorizationToken || !filePath || !fileBase64) {
      return res.status(400).json({ message: "Thiếu dữ liệu tải lên." });
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

      if (!b2Res.ok) {
        const errData = await b2Res.json().catch(() => ({}));
        return res.status(b2Res.status).json(errData);
      }

      const data = await b2Res.json();
      return res.json(data);
    } catch (err: any) {
      console.error('B2 Upload File Proxy Error:', err);
      return res.status(500).json({ message: err.message || "Lỗi tải ảnh lên B2 qua proxy" });
    }
  });

  app.post("/api/b2/deleteFile", async (req, res) => {
    const { apiUrl, authorizationToken, fileId, fileName } = req.body;
    if (!apiUrl || !authorizationToken || !fileId || !fileName) {
      return res.status(400).json({ message: "Thiếu dữ liệu để xóa file." });
    }

    try {
      const b2Res = await fetch(`${apiUrl}/b2api/v2/b2_delete_file_version`, {
        method: 'POST',
        headers: {
          'Authorization': authorizationToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fileId: fileId,
          fileName: fileName
        })
      });

      if (!b2Res.ok) {
        const errData = await b2Res.json().catch(() => ({}));
        return res.status(b2Res.status).json(errData);
      }

      const data = await b2Res.json();
      return res.json(data);
    } catch (err: any) {
      console.error('B2 Delete File Proxy Error:', err);
      return res.status(500).json({ message: err.message || "Lỗi xóa file trên B2 qua proxy" });
    }
  });

  app.post("/api/b2/getBucketSize", async (req, res) => {
    const { apiUrl, authorizationToken, bucketId } = req.body;
    if (!apiUrl || !authorizationToken || !bucketId) {
      return res.status(400).json({ message: "Thiếu thông tin kết nối hoặc bucketId" });
    }

    try {
      let totalSize = 0;
      let fileCount = 0;
      let startFileName: string | null = null;
      let hasMore = true;
      let page = 0;
      const maxPages = 15; // Safeguard up to 15,000 files

      while (hasMore && page < maxPages) {
        const payload: any = { bucketId, maxFileCount: 1000 };
        if (startFileName) {
          payload.startFileName = startFileName;
        }

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
          return res.status(b2Res.status).json(errData);
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

      return res.json({ totalSize, fileCount });
    } catch (err: any) {
      console.error('B2 Get Bucket Size Proxy Error:', err);
      return res.status(500).json({ message: err.message || "Lỗi lấy dung lượng qua proxy" });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
