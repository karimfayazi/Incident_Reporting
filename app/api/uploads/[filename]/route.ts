import { existsSync } from "fs";
import { readFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);

function resolveUploadDirectory(): string {
  if (process.env.UPLOAD_DIR) {
    return path.resolve(process.env.UPLOAD_DIR);
  }
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), "uploads", "NC_IR_Upload");
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  if (!filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const uploadDir = resolveUploadDirectory();
  const filePath = path.join(uploadDir, filename);

  if (!filePath.startsWith(uploadDir)) {
    return new NextResponse("Not found", { status: 404 });
  }

  if (!existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const buffer = await readFile(filePath);

  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp"
  };

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": mimeMap[ext] || "application/octet-stream",
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "public, max-age=31536000, immutable"
    }
  });
}
