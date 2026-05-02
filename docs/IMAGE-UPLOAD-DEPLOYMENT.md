# Image Upload — Deployment Guide

## How It Works

1. User submits the incident form with up to 3 images.
2. API inserts the incident into SQL Server and gets an `IncidentID`.
3. Each image is converted to JPEG via `sharp`, saved to disk as `{IncidentID}-Image{1|2|3}.jpg`.
4. The `Image1`/`Image2`/`Image3` columns are updated with the public URL.
5. Transaction commits — if anything fails, files are cleaned up and DB rolls back.

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `UPLOAD_DIR` | Absolute path to the upload folder | `/home/user/httpdocs/NC_IR_Upload` |
| `BASE_URL` | Public domain (used to build image URLs) | `https://rif-ii.org` |
| `INCIDENT_UPLOAD_PUBLIC_BASE_URL` | Override full public base URL | `https://cdn.rif-ii.org/uploads` |

### Development (no env vars needed)

When `UPLOAD_DIR` is unset, images save to `<project>/uploads/NC_IR_Upload/`.
The built-in API route `/api/uploads/[filename]` serves them automatically.

### Production on a VPS (Nginx + Node.js)

```env
UPLOAD_DIR=/home/rifii/httpdocs/NC_IR_Upload
BASE_URL=https://rif-ii.org
```

Images are saved to `/home/rifii/httpdocs/NC_IR_Upload/` and the DB stores
URLs like `https://rif-ii.org/NC_IR_Upload/123-Image1.jpg`.

---

## Nginx Configuration (Production)

Add this `location` block to your Nginx site config:

```nginx
server {
    listen 443 ssl;
    server_name rif-ii.org;

    # ... existing SSL and proxy config ...

    # Serve uploaded incident images directly (bypass Node.js)
    location /NC_IR_Upload/ {
        alias /home/rifii/httpdocs/NC_IR_Upload/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;

        # Only allow image files
        location ~* \.(jpg|jpeg|png|gif|webp)$ {
            try_files $uri =404;
        }

        # Deny everything else
        return 404;
    }

    # Proxy all other requests to Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

After editing, test and reload:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## Apache Configuration (Alternative)

```apache
<VirtualHost *:443>
    ServerName rif-ii.org

    # Serve uploaded images directly
    Alias /NC_IR_Upload /home/rifii/httpdocs/NC_IR_Upload
    <Directory /home/rifii/httpdocs/NC_IR_Upload>
        Require all granted
        Options -Indexes
        <FilesMatch "\.(jpg|jpeg|png|gif|webp)$">
            Header set Cache-Control "public, max-age=31536000, immutable"
        </FilesMatch>
    </Directory>

    # Proxy everything else to Next.js
    ProxyPass /NC_IR_Upload !
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/
</VirtualHost>
```

---

## Folder Permissions (Linux)

```bash
# Create the folder
sudo mkdir -p /home/rifii/httpdocs/NC_IR_Upload

# Make it owned by the Node.js process user
sudo chown -R www-data:www-data /home/rifii/httpdocs/NC_IR_Upload
sudo chmod 755 /home/rifii/httpdocs/NC_IR_Upload
```

---

## Serverless / Vercel Deployment

The filesystem (`fs`) is **not persistent** on serverless platforms like Vercel.
If deploying there, replace file-system storage with a blob/object store:

### Option A: @vercel/blob

```bash
npm install @vercel/blob
```

Replace `saveImageFile` with:

```typescript
import { put } from "@vercel/blob";

async function saveImageFile(file: File, incidentId: number, slot: number) {
  validateImageFile(file);
  const fileName = `incidents/${incidentId}-Image${slot}.jpg`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const jpegBuffer = await sharp(bytes).rotate().jpeg({ quality: 85, mozjpeg: true }).toBuffer();

  const blob = await put(fileName, jpegBuffer, {
    access: "public",
    contentType: "image/jpeg"
  });

  return { absolutePath: "", publicUrl: blob.url };
}
```

### Option B: AWS S3

```bash
npm install @aws-sdk/client-s3
```

```typescript
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({ region: process.env.AWS_REGION });

async function saveImageFile(file: File, incidentId: number, slot: number) {
  validateImageFile(file);
  const key = `NC_IR_Upload/${incidentId}-Image${slot}.jpg`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const jpegBuffer = await sharp(bytes).rotate().jpeg({ quality: 85, mozjpeg: true }).toBuffer();

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET!,
    Key: key,
    Body: jpegBuffer,
    ContentType: "image/jpeg",
    ACL: "public-read"
  }));

  return {
    absolutePath: "",
    publicUrl: `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`
  };
}
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ENOENT` in logs | Upload directory doesn't exist | Code creates it automatically; check permissions |
| `EACCES` | Node.js can't write to directory | `chown`/`chmod` the folder |
| 404 on image URL | Web server not configured to serve from upload folder | Add Nginx/Apache config above |
| Images work locally but not in production | `BASE_URL` not set, so URLs use localhost | Set `BASE_URL=https://rif-ii.org` |
| `sharp` fails | Missing native dependencies | Run `npm rebuild sharp` on the server |

---

## Verifying the Fix (Local)

1. Start the server: `npm run start`
2. Submit an incident with an image at `http://127.0.0.1:3000/record-incident`
3. Check terminal logs for `[UPLOAD]` and `[INCIDENT]` messages
4. Try opening `http://127.0.0.1:3000/api/uploads/{IncidentID}-Image1.jpg`
5. Verify the file exists at `uploads/NC_IR_Upload/{IncidentID}-Image1.jpg`
