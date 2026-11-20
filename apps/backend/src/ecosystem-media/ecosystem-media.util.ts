import { statSync } from 'fs';
import * as path from 'path';

/** All user uploads live under `<cwd>/uploads` (see `main.ts`). */
export const UPLOAD_ROOT = path.resolve(process.cwd(), 'uploads');

const MAX_SEGMENTS = 6;

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.svg': 'image/svg+xml',
};

/**
 * Normalise a caller-supplied media path to a safe relative path.
 *
 * Returns `null` for anything containing traversal segments, hidden path
 * tricks, or characters that are not part of a generated upload filename
 * (`<uuid>.<ext>` / `catalog/<uuid>.<ext>`).
 */
export function sanitiseUploadPath(relativePath: string): string | null {
  if (typeof relativePath !== 'string') return null;

  const segments = relativePath.split('/').filter(Boolean);
  if (!segments.length || segments.length > MAX_SEGMENTS) return null;

  for (const segment of segments) {
    if (segment === '.' || segment === '..') return null;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(segment)) return null;
  }

  return segments.join('/');
}

/**
 * Resolve a media path to an existing file inside the uploads root.
 * Returns `null` when the path is unsafe or the file does not exist.
 */
export function resolveUploadFile(relativePath: string): string | null {
  const clean = sanitiseUploadPath(relativePath);
  if (!clean) return null;

  const resolved = path.resolve(UPLOAD_ROOT, clean);
  if (!resolved.startsWith(`${UPLOAD_ROOT}${path.sep}`)) return null;

  try {
    if (!statSync(resolved).isFile()) return null;
  } catch {
    return null;
  }

  return resolved;
}

export function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return CONTENT_TYPES[ext] ?? 'application/octet-stream';
}
