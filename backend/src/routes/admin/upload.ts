import { Hono } from "hono";
import { success, error } from "../../lib/response.js";
import { getSupabase, STORAGE_BUCKET } from "../../lib/supabase.js";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";

const uploadRoutes = new Hono();

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_FOLDERS = new Set(["menu", "logo", "banner", "misc"]);

// POST /admin/upload/:folder  (folder ∈ menu|logo|banner|misc)
uploadRoutes.post("/:folder", async (c) => {
  const folderParam = c.req.param("folder");
  const folder = ALLOWED_FOLDERS.has(folderParam) ? folderParam : "misc";

  const body = await c.req.parseBody();
  const file = body["file"];

  if (!(file instanceof File)) {
    return error(c, "File tidak ditemukan (field: 'file')", 400);
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return error(c, "Format gambar harus JPG, PNG, WEBP, atau GIF", 400);
  }
  if (file.size > MAX_SIZE) {
    return error(c, "Ukuran gambar maksimal 5MB", 400);
  }

  const ext =
    extname(file.name).toLowerCase() ||
    (file.type === "image/png"
      ? ".png"
      : file.type === "image/webp"
      ? ".webp"
      : file.type === "image/gif"
      ? ".gif"
      : ".jpg");
  const objectPath = `${folder}/${randomUUID()}${ext}`;

  const buffer = new Uint8Array(await file.arrayBuffer());

  const supabase = getSupabase();

  // Ensure bucket exists
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === STORAGE_BUCKET);
  if (!bucketExists) {
    const { error: createErr } = await supabase.storage.createBucket(STORAGE_BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE,
      allowedMimeTypes: [...ALLOWED_MIME],
    });
    if (createErr) {
      return error(c, `Bucket tidak bisa dibuat: ${createErr.message}`, 500);
    }
  }

  const { error: uploadErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(objectPath, buffer, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadErr) {
    return error(c, `Upload gagal: ${uploadErr.message} (bucket: ${STORAGE_BUCKET}, path: ${objectPath})`, 500);
  }

  const { data: pub } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(objectPath);

  return success(c, { url: pub.publicUrl, path: objectPath }, 201);
});

// DELETE /admin/upload  body: { path: "menu/uuid.jpg" }
uploadRoutes.delete("/", async (c) => {
  const { path } = await c.req.json<{ path?: string }>();
  if (!path) return error(c, "path wajib diisi", 400);

  const supabase = getSupabase();
  const { error: delErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([path]);

  if (delErr) return error(c, delErr.message, 500);
  return success(c, { deleted: true });
});

export default uploadRoutes;
