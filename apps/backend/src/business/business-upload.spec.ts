import { ALLOWED_UPLOAD_EXTS, MAX_UPLOAD_BYTES, extToKind, sniffImageKind } from './business.controller';

describe('upload hardening (Phase 1C)', () => {
  it('caps uploads at 5 MB', () => {
    expect(MAX_UPLOAD_BYTES).toBe(5 * 1024 * 1024);
  });

  it('rejects .svg from the allowlist', () => {
    expect(ALLOWED_UPLOAD_EXTS).not.toContain('.svg');
    expect(extToKind('.svg')).toBeNull();
  });

  it('sniffs PNG magic bytes', () => {
    const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);
    expect(sniffImageKind(header)).toBe('png');
  });

  it('sniffs JPEG magic bytes', () => {
    const header = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    expect(sniffImageKind(header)).toBe('jpg');
  });

  it('sniffs GIF magic bytes', () => {
    const header = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x00, 0x00]);
    expect(sniffImageKind(header)).toBe('gif');
  });

  it('sniffs WEBP magic bytes', () => {
    const header = Buffer.concat([
      Buffer.from('RIFF', 'ascii'),
      Buffer.from([0x10, 0x00, 0x00, 0x00]),
      Buffer.from('WEBP', 'ascii'),
    ]);
    expect(sniffImageKind(header)).toBe('webp');
  });

  it('rejects HTML/SVG masquerading as an image', () => {
    const html = Buffer.from('<html><script>alert(1)</script>');
    expect(sniffImageKind(html)).toBeNull();
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/');
    expect(sniffImageKind(svg)).toBeNull();
  });

  it('rejects truncated headers', () => {
    expect(sniffImageKind(Buffer.alloc(0))).toBeNull();
    expect(sniffImageKind(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});
