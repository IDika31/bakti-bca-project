import { Hono } from "hono";
import { success, error } from "../../lib/response.js";
import { getSupabase, STORAGE_BUCKET } from "../../lib/supabase.js";
import { createHash } from "node:crypto";
import { extname } from "node:path";
import { requireRole } from "../../lib/auth.js";

const uploadRoutes = new Hono();
uploadRoutes.use("*", requireRole("OWNER", "ADMIN"));

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const ALLOWED_FOLDERS = new Set(["menu", "logo", "banner", "misc"]);

// Check whether an object already exists at a given path in the bucket.
// Supabase storage has no HEAD-by-path call, so we list the parent folder and
// match the exact filename. Returns the matching object name or null.
async function findExisting(supabase: ReturnType<typeof getSupabase>, folder: string, fileName: string): Promise<string | null> {
  // search= narrows results server-side; fall back to scanning the page.
  const { data, error: listErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .list(folder, { search: fileName, limit: 100 });
  if (listErr || !data) return null;
  const hit = data.find((o) => o.name === fileName);
  return hit ? `${folder}/${hit.name}` : null;
}

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

  const buffer = new Uint8Array(await file.arrayBuffer());

  // Content-addressed path: same bytes ⇒ same path. First 16 bytes of the
  // SHA-256 hex keeps paths short while remaining collision-resistant for a
  // media bucket. Dedup happens below by checking this path before uploading.
  const hashHex = createHash("sha256").update(buffer).digest("hex").slice(0, 32);
  const fileName = `${hashHex}${ext}`;
  const objectPath = `${folder}/${fileName}`;

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

  // Dedup: if an identical file already exists at this content-addressed path,
  // reuse it instead of uploading again.
  const existing = await findExisting(supabase, folder, fileName);
  if (existing) {
    const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(existing);
    return success(c, { url: pub.publicUrl, path: existing, reused: true });
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

  return success(c, { url: pub.publicUrl, path: objectPath, reused: false }, 201);
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
