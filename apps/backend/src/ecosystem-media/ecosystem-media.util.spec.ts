import { contentTypeFor, sanitiseUploadPath } from './ecosystem-media.util';

describe('ecosystem-media util', () => {
  describe('sanitiseUploadPath', () => {
    it('accepts generated filenames and one nested folder', () => {
      expect(
        sanitiseUploadPath('b60ee38a-d6ed-419a-ab4a-3a28c8ec4209.png'),
      ).toBe('b60ee38a-d6ed-419a-ab4a-3a28c8ec4209.png');
      expect(sanitiseUploadPath('catalog/abc.def.webp')).toBe(
        'catalog/abc.def.webp',
      );
      expect(sanitiseUploadPath('/catalog/abc.webp')).toBe('catalog/abc.webp');
    });

    it('rejects traversal and absolute escapes', () => {
      expect(sanitiseUploadPath('../etc/passwd')).toBeNull();
      expect(sanitiseUploadPath('catalog/../../secret.png')).toBeNull();
      expect(sanitiseUploadPath('..%2fetc%2fpasswd')).toBeNull();
      expect(sanitiseUploadPath('catalog/..')).toBeNull();
      expect(sanitiseUploadPath('')).toBeNull();
    });

    it('rejects unexpected characters', () => {
      expect(sanitiseUploadPath('file with spaces.png')).toBeNull();
      expect(sanitiseUploadPath('shell;rm.png')).toBeNull();
      expect(sanitiseUploadPath('.hidden.png')).toBeNull();
    });

    it('caps nesting depth', () => {
      expect(sanitiseUploadPath('a/b/c/d/e/f/g.png')).toBeNull();
    });
  });

  describe('contentTypeFor', () => {
    it('maps raster image extensions', () => {
      expect(contentTypeFor('x.PNG')).toBe('image/png');
      expect(contentTypeFor('x.jpeg')).toBe('image/jpeg');
      expect(contentTypeFor('x.webp')).toBe('image/webp');
    });

    it('falls back to octet-stream', () => {
      expect(contentTypeFor('x.bin')).toBe('application/octet-stream');
    });
  });
});
