import { getSupabase, STORAGE_BUCKET } from "./supabase.js";
import { prisma } from "./prisma.js";

/**
 * Extract the storage object path from a public Supabase URL.
 * Public URLs look like:
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/menu/abc.jpg
 *   https://<project>.supabase.co/storage/v1/object/public/<bucket>/menu/abc.jpg?token=...
 * Returns e.g. "menu/abc.jpg", or null if the URL is not a bucket public URL.
 */
export function pathFromPublicUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const prefix = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const idx = u.pathname.indexOf(prefix);
    if (idx === -1) return null;
    return decodeURIComponent(u.pathname.slice(idx + prefix.length));
  } catch {
    return null;
  }
}

/**
 * Count how many menu items + the restaurant profile still reference a given
 * image URL. Content-addressed uploads can be shared across menus, so we only
 * delete a file when nothing references it anymore.
 */
async function countReferences(url: string): Promise<number> {
  const [menuCount, profileCount] = await Promise.all([
    prisma.menuItem.count({ where: { imageUrl: url } }),
    prisma.restaurantProfile.count({ where: { OR: [{ logoUrl: url }, { bannerUrl: url }] } }),
  ]);
  return menuCount + profileCount;
}

/**
 * Best-effort delete of a storage object referenced by its public URL.
 * - Skips URLs that are not bucket public URLs (e.g. external https images).
 * - Only deletes when no menu item or profile still references the URL.
 * - Never throws — image cleanup is best-effort and must not fail the parent
 *   operation (the row is already updated/deleted by the time we call this).
 */
export async function deleteImageIfUnused(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const path = pathFromPublicUrl(url);
  if (!path) return; // external URL or not a bucket file — nothing to delete here
  try {
    const refs = await countReferences(url);
    if (refs > 0) return; // still referenced somewhere — keep the file
    const supabase = getSupabase();
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  } catch {
    // Swallow: cleanup must not break the parent request.
  }
}
