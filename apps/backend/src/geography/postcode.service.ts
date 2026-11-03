import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';

export interface ResolvedPostcode {
  postcode: string;
  outwardCode: string;
  city: string;
  borough: string;
  highStreet: string;
  localMall: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  adminDistrict: string;
  adminWard: string;
}

const UK_POSTCODE_REGEX =
  /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

/**
 * Resolves a UK postcode to geographic + regional metadata using
 * postcodes.io (primary) and OpenStreetMap Nominatim (fallback).
 *
 * No database access lives here — this service is only responsible for turning
 * a postcode string into a trusted set of place names.
 */
@Injectable()
export class PostcodeService {
  private readonly logger = new Logger(PostcodeService.name);

  normalize(postcode: string): string {
    return (postcode || '').toUpperCase().replace(/\s+/g, ' ').trim();
  }

  isValid(postcode: string): boolean {
    return UK_POSTCODE_REGEX.test((postcode || '').trim());
  }

  async resolve(postcode: string): Promise<ResolvedPostcode> {
    const normalized = this.normalize(postcode);
    if (!normalized) {
      throw new BadRequestException('A UK postcode is required.');
    }
    if (!this.isValid(normalized)) {
      throw new BadRequestException('Please enter a valid UK postcode (e.g. SW1A 1AA).');
    }

    try {
      return await this.resolveWithPostcodesIo(normalized);
    } catch (error) {
      // 404 is a valid "not a real postcode" answer — never mask it with the
      // Nominatim retry. Everything else (network/5xx) can fall back.
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(
        `postcodes.io lookup failed for ${normalized}; falling back to Nominatim: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return this.resolveWithNominatim(normalized);
    }
  }

  private async resolveWithPostcodesIo(postcode: string): Promise<ResolvedPostcode> {
    const clean = postcode.replace(/\s+/g, '');
    let response;
    try {
      response = await axios.get(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`,
        { timeout: 8000 },
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new BadRequestException(
          'We could not find that UK postcode. Check it and try again.',
        );
      }
      throw error;
    }

    const result = response.data?.result;
    if (!result) {
      throw new BadRequestException(
        'We could not find that UK postcode. Check it and try again.',
      );
    }

    const district: string = result.admin_district || '';
    const ward: string = result.admin_ward || '';
    const county: string = result.admin_county || '';
    const region: string = result.region || '';
    const postTown: string = result.post_town || '';
    const parish: string = result.parish || '';
    const country: string = result.country || '';

    const devolvedCountry = ['Wales', 'Scotland', 'Northern Ireland'].includes(country)
      ? country
      : '';
    const city = devolvedCountry || region || county || district || postTown;
    const borough = district || region || city;
    const highStreet = ward || parish || borough;
    const localMall = postTown ? `${postTown} Local Mall` : `${highStreet} Local Mall`;

    return {
      postcode,
      outwardCode: (result.outcode || clean.slice(0, clean.length - 3)).toUpperCase(),
      city: this.cleanName(city),
      borough: this.cleanName(borough),
      highStreet: this.cleanName(highStreet),
      localMall: this.cleanName(localMall),
      region,
      latitude: result.latitude ?? null,
      longitude: result.longitude ?? null,
      adminDistrict: district,
      adminWard: ward,
    };
  }

  private async resolveWithNominatim(postcode: string): Promise<ResolvedPostcode> {
    let response;
    try {
      response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          postalcode: postcode,
          country: 'United Kingdom',
          format: 'jsonv2',
          addressdetails: 1,
          limit: 1,
        },
        headers: { 'User-Agent': 'McomSolutions/1.0 (contact@mcomsolutions.co.uk)' },
        timeout: 8000,
      });
    } catch (error) {
      this.logger.error(
        `Nominatim postcode lookup failed for ${postcode}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw new ServiceUnavailableException(
        'We could not verify this postcode right now. Please try again.',
      );
    }

    const item = Array.isArray(response.data) ? response.data[0] : null;
    if (!item) {
      throw new BadRequestException(
        'We could not find that UK postcode. Check it and try again.',
      );
    }

    const address = item.address || {};
    const country = address.country || '';
    const devolvedCountry = ['Wales', 'Scotland', 'Northern Ireland'].includes(country)
      ? country
      : '';
    const city = devolvedCountry || address.city || address.town || address.village || address.county || '';
    const borough = address.borough || address.city_district || address.county || city;
    const highStreet =
      address.suburb || address.neighbourhood || address.quarter || borough;
    const localMall = address.postcode
      ? `${String(address.postcode).split(' ')[0]} Local Mall`
      : `${highStreet} Local Mall`;

    return {
      postcode,
      outwardCode: postcode.split(' ')[0],
      city: this.cleanName(city || borough),
      borough: this.cleanName(borough),
      highStreet: this.cleanName(highStreet),
      localMall: this.cleanName(localMall),
      region: address.state || address.region || '',
      latitude: item.lat ? Number(item.lat) : null,
      longitude: item.lon ? Number(item.lon) : null,
      adminDistrict: borough,
      adminWard: address.suburb || '',
    };
  }

  private cleanName(value: string): string {
    return (value || '').trim().replace(/\s+/g, ' ');
  }
}
