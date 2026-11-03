import { BadRequestException } from '@nestjs/common';
import { PostcodeService } from './postcode.service';

describe('PostcodeService', () => {
  let service: PostcodeService;

  beforeEach(() => {
    service = new PostcodeService();
  });

  it('normalizes whitespace and casing', () => {
    expect(service.normalize('  sw1a   1aa ')).toBe('SW1A 1AA');
  });

  it.each(['SW1A 1AA', 'M1 1AE', 'B33 8TH', 'CR2 6XH', 'DN55 1PT'])(
    'accepts valid UK postcode %s',
    (postcode) => {
      expect(service.isValid(postcode)).toBe(true);
    },
  );

  it.each(['12345', 'NOT A POSTCODE', 'A1', ''])(
    'rejects invalid postcode %s',
    (postcode) => {
      expect(service.isValid(postcode)).toBe(false);
    },
  );

  it('rejects an empty postcode before any network lookup', async () => {
    await expect(service.resolve('')).rejects.toThrow(BadRequestException);
  });

  it('rejects a malformed postcode before any network lookup', async () => {
    await expect(service.resolve('NOT-A-POSTCODE')).rejects.toThrow(BadRequestException);
  });
});
