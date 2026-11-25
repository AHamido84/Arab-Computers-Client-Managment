import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { del, get, put } from "@vercel/blob";

/**
 * File storage abstraction.
 *  - Production: Vercel Blob, PRIVATE access (files are only served through
 *    /api/files/[id] after a permission check).
 *  - Local dev without a Blob store: files are written to ./.uploads.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // Vercel request body limit is 4.5 MB
export const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "application/zip",
];

const LOCAL_DIR = path.join(process.cwd(), ".uploads");
const LOCAL_PREFIX = "local:";

export const blobConfigured = () => !!(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);

function safeName(name: string) {
  return name.replace(/[^\p{L}\p{N}._-]+/gu, "_").slice(-120) || "file";
}

export async function saveFile(folder: string, filename: string, body: Buffer, contentType: string) {
  const pathname = `${folder}/${safeName(filename)}`;
  if (blobConfigured()) {
    const res = await put(pathname, body, { access: "private", addRandomSuffix: true, contentType });
    return { url: res.url, pathname: res.pathname };
  }
  const rel = `${folder}/${randomUUID()}-${safeName(filename)}`;
  await fs.mkdir(path.join(LOCAL_DIR, folder), { recursive: true });
  await fs.writeFile(path.join(LOCAL_DIR, rel), body);
  return { url: LOCAL_PREFIX + rel, pathname: rel };
}

export async function readFile(url: string): Promise<{ body: ReadableStream | Buffer } | null> {
  if (url.startsWith(LOCAL_PREFIX)) {
    const p = path.join(LOCAL_DIR, url.slice(LOCAL_PREFIX.length));
    if (!p.startsWith(LOCAL_DIR)) return null;
    try {
      return { body: await fs.readFile(p) };
    } catch {
      return null;
    }
  }
  const res = await get(url, { access: "private" });
  return res?.stream ? { body: res.stream } : null;
}

export async function readFileBuffer(url: string): Promise<Buffer | null> {
  const f = await readFile(url);
  if (!f) return null;
  if (Buffer.isBuffer(f.body)) return f.body;
  return Buffer.from(await new Response(f.body).arrayBuffer());
}

export async function deleteFile(url: string) {
  if (url.startsWith(LOCAL_PREFIX)) {
    await fs.rm(path.join(LOCAL_DIR, url.slice(LOCAL_PREFIX.length)), { force: true });
    return;
  }
  await del(url);
}
