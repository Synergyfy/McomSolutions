import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';

export interface ResolvedPostcode {
  postcode: string;
  outwardCode: string;
  /** The city or town the postcode belongs to (UK settlement name). */
  city: string;
  /** The local authority district / borough for the postcode. */
  borough: string;
  /** The named high street (retail street) nearest the postcode. */
  highStreet: string;
  /** A sensible default local-mall name when no existing mall matches. */
  localMall: string;
  region: string;
  latitude: number | null;
  longitude: number | null;
  adminDistrict: string;
  adminWard: string;
  country?: string;
  parish?: string;
  cityGssCode?: string | null;
  boroughGssCode?: string | null;
  highStreetGssCode?: string | null;
  highStreetSource?: 'osm' | 'ward' | 'parish' | 'borough';
  source?: 'postcodes.io' | 'nominatim';
}

interface PostcodesIoPlace {
  name_1?: string | null;
  name_1_lang?: string | null;
  name_2?: string | null;
  name_2_lang?: string | null;
  local_type?: string | null;
  district_borough?: string | null;
  county_unitary?: string | null;
  region?: string | null;
  country?: string | null;
}

interface CachedValue<T> {
  value: T;
  expiresAt: number;
}

const UK_POSTCODE_REGEX = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

/** Postcodes.io only contains UK postcodes; crown dependencies are not UK. */
const UK_COUNTRIES = new Set([
  'England',
  'Scotland',
  'Wales',
  'Northern Ireland',
  'United Kingdom',
]);

const PLACE_TYPES = new Set([
  'City',
  'Town',
  'Village',
  'Hamlet',
  'Other Settlement',
  'Suburban Area',
]);

const PLACE_RANK: Record<string, number> = {
  City: 1,
  Town: 2,
  'Other Settlement': 3,
  'Suburban Area': 4,
  Village: 5,
  Hamlet: 6,
};

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const ipv4Agent = new https.Agent({ family: 4 });

/**
 * Resolves a UK postcode to the UK geographic hierarchy we use across the
 * product:
 *
 *   City (settlement) → Borough (local authority) → High street (retail
 *   street) → Local mall (our digital local marketplace).
 *
 * - City / borough / ward / GSS codes come from postcodes.io's ONS data.
 * - The high street comes from OpenStreetMap: the named street with the
 *   densest cluster of nearby shops, cafés, banks and pubs. If OSM has no
 *   retail cluster, we fall back to the ward/local area.
 * - Local mall names are only a suggestion. `LocationAssignmentService`
 *   first checks whether an existing mall already covers the outcode.
 *
 * No database access lives here — this service only turns a postcode into a
 * trusted set of place names.
 */
@Injectable()
export class PostcodeService {
  private readonly logger = new Logger(PostcodeService.name);

  private readonly postcodeCache = new Map<string, CachedValue<ResolvedPostcode>>();
  private readonly placeCache = new Map<string, CachedValue<PostcodesIoPlace[]>>();
  private readonly highStreetCache = new Map<
    string,
    CachedValue<{ name: string; lat: number | null; lng: number | null } | null>
  >();
  private readonly reverseStreetCache = new Map<string, CachedValue<string | null>>();

  private readonly POSTCODE_TTL_MS = 15 * 60 * 1000;
  private readonly PLACE_TTL_MS = 24 * 60 * 60 * 1000;
  private readonly HIGH_STREET_TTL_MS = 24 * 60 * 60 * 1000;
  private readonly HIGH_STREET_MISS_TTL_MS = 15 * 60 * 1000;

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
      throw new BadRequestException(
        'Please enter a valid UK postcode (e.g. SW1A 1AA).',
      );
    }

    const cached = this.postcodeCache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    let resolved: ResolvedPostcode;
    try {
      resolved = await this.resolveWithPostcodesIo(normalized);
    } catch (error) {
      // 404 / non-UK postcode is a final answer — never mask it with a retry.
      if (error instanceof BadRequestException) throw error;
      this.logger.warn(
        `postcodes.io lookup failed for ${normalized}; falling back to Nominatim: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      resolved = await this.resolveWithNominatim(normalized);
    }

    this.postcodeCache.set(normalized, {
      value: resolved,
      expiresAt: Date.now() + this.POSTCODE_TTL_MS,
    });
    return resolved;
  }

  private async resolveWithPostcodesIo(
    postcode: string,
  ): Promise<ResolvedPostcode> {
    const clean = postcode.replace(/\s+/g, '');
    let response;
    try {
      response = await axios.get(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`,
        { timeout: 6000 },
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const terminated = await this.lookupTerminatedPostcode(clean);
        if (terminated) {
          throw new BadRequestException(
            `That postcode was terminated in ${terminated}. Please use your current postcode.`,
          );
        }
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

    const country = String(result.country || '');
    this.assertUkCountry(country);

    const adminDistrict = String(result.admin_district || '');
    const adminWard = String(result.admin_ward || '');
    const parish = String(result.parish || '');
    const region = String(result.region || '');
    const codes = result.codes || {};
    const latitude =
      typeof result.latitude === 'number' ? result.latitude : null;
    const longitude =
      typeof result.longitude === 'number' ? result.longitude : null;

    const city = await this.resolveCity({
      region,
      country,
      adminDistrict,
      adminWard,
      parish,
    });

    const highStreet = await this.resolveHighStreet({
      latitude,
      longitude,
      adminWard,
      parish,
      borough: adminDistrict || city.name,
    });

    const localMallBase =
      highStreet.name || adminWard || parish || city.name || 'Local';

    return {
      postcode: String(result.postcode || postcode),
      outwardCode: String(
        result.outcode || clean.slice(0, clean.length - 3),
      ).toUpperCase(),
      city: city.name,
      borough: this.cleanName(adminDistrict || city.name),
      highStreet: highStreet.name,
      localMall: `${this.cleanName(localMallBase)} Local Mall`,
      region: this.cleanName(region),
      country: this.cleanName(country),
      latitude,
      longitude,
      adminDistrict: this.cleanName(adminDistrict),
      adminWard: this.cleanName(adminWard),
      parish: this.cleanName(parish),
      cityGssCode: city.gssCode,
      boroughGssCode: codes.admin_district ?? null,
      highStreetGssCode:
        highStreet.source === 'ward' || highStreet.source === 'parish'
          ? codes.admin_ward ?? null
          : null,
      highStreetSource: highStreet.source,
      source: 'postcodes.io',
    };
  }

  private async lookupTerminatedPostcode(
    clean: string,
  ): Promise<string | null> {
    try {
      const response = await axios.get(
        `https://api.postcodes.io/terminated_postcodes/${encodeURIComponent(clean)}`,
        { timeout: 3000 },
      );
      const result = response.data?.result;
      if (!result) return null;
      return String(result.year_terminated || result.date_terminated || '');
    } catch {
      return null;
    }
  }

  private assertUkCountry(country: string): void {
    if (country && !UK_COUNTRIES.has(country)) {
      throw new BadRequestException(
        'We only support UK postcodes (England, Scotland, Wales and Northern Ireland).',
      );
    }
  }

  /**
   * Resolves the settlement name people identify with. London is a special
   * case because all London boroughs sit under the city of London. Everywhere
   * else we ask OS Open Names (via postcodes.io places) for a City/Town that
   * sits inside the postcode's local authority district.
   */
  private async resolveCity(args: {
    region: string;
    country: string;
    adminDistrict: string;
    adminWard: string;
    parish: string;
  }): Promise<{ name: string; gssCode: string | null }> {
    if (args.region === 'London') {
      return { name: 'London', gssCode: null };
    }

    const candidates = [args.adminDistrict, args.parish, args.adminWard]
      .map((value) => this.cleanName(value))
      .filter(Boolean);

    for (const candidate of candidates) {
      const place = await this.findBestPlace(
        candidate,
        args.adminDistrict,
        args.country,
      );
      if (place) {
        return {
          name: this.displayPlaceName(place, candidate),
          gssCode: null,
        };
      }
    }

    const fallback = this.cleanName(
      args.adminDistrict ||
        args.parish ||
        args.adminWard ||
        args.region ||
        args.country,
    );
    return { name: fallback, gssCode: null };
  }

  private async findBestPlace(
    query: string,
    district: string,
    country: string,
  ): Promise<PostcodesIoPlace | null> {
    for (const variant of this.placeQueryVariants(query)) {
      const results = await this.searchPlaces(variant);
      const best = this.pickPlace(results, variant, district, country);
      if (best) return best;
    }
    return null;
  }

  private async searchPlaces(query: string): Promise<PostcodesIoPlace[]> {
    const key = query.toLowerCase().trim();
    const cached = this.placeCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      const response = await axios.get('https://api.postcodes.io/places', {
        params: { query, limit: 20 },
        timeout: 4000,
      });
      const results = Array.isArray(response.data?.result)
        ? (response.data.result as PostcodesIoPlace[])
        : [];
      this.placeCache.set(key, {
        value: results,
        expiresAt: Date.now() + this.PLACE_TTL_MS,
      });
      return results;
    } catch (error) {
      this.logger.warn(
        `places lookup failed for "${query}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }

  private pickPlace(
    results: PostcodesIoPlace[],
    query: string,
    district: string,
    country: string,
  ): PostcodesIoPlace | null {
    const allowed = results.filter((place) =>
      PLACE_TYPES.has(String(place.local_type || '')),
    );
    if (allowed.length === 0) return null;

    const countryMatches = country
      ? allowed.filter(
          (place) =>
            String(place.country || '').toLowerCase() === country.toLowerCase(),
        )
      : allowed;
    const pool = countryMatches.length > 0 ? countryMatches : allowed;

    const normalizedQuery = this.normalizeName(query);
    const normalizedDistrict = this.normalizeName(district);

    const scored = pool
      .map((place) => {
        const name1 = this.normalizeName(place.name_1 || '');
        const name2 = this.normalizeName(place.name_2 || '');
        const placeDistrict = this.normalizeName(
          place.district_borough || place.county_unitary || '',
        );

        let score = PLACE_RANK[String(place.local_type || '')] ?? 50;

        if (
          normalizedDistrict &&
          placeDistrict &&
          (placeDistrict === normalizedDistrict ||
            placeDistrict.includes(normalizedDistrict) ||
            normalizedDistrict.includes(placeDistrict))
        ) {
          score -= 50;
        }

        if (
          normalizedQuery &&
          (name1 === normalizedQuery || name2 === normalizedQuery)
        ) {
          score -= 30;
        }

        return { place, score };
      })
      .sort((a, b) => a.score - b.score);

    return scored[0]?.place ?? null;
  }

  private placeQueryVariants(query: string): string[] {
    const cleaned = this.cleanName(query);
    if (!cleaned) return [];
    const stripped = this.stripAdminSuffix(cleaned);
    return [...new Set([cleaned, stripped].filter(Boolean))];
  }

  private stripAdminSuffix(value: string): string {
    return value
      .replace(
        /^(City of|London Borough of|Royal Borough of|Borough of|County of|County|District of)\s+/i,
        '',
      )
      .replace(
        /(,\s*City of|\s+City|\s+Borough|\s+District|\s+County|\s+Council)$/i,
        '',
      )
      .trim();
  }

  private displayPlaceName(place: PostcodesIoPlace, query: string): string {
    const normalizedQuery = this.normalizeName(query);
    const name1 = this.cleanName(place.name_1 || '');
    const name2 = this.cleanName(place.name_2 || '');
    if (name2 && this.normalizeName(name2) === normalizedQuery) return name2;
    if (name1) return name1;
    return name2 || this.cleanName(query);
  }

  /**
   * Finds the named high street nearest the postcode using OpenStreetMap.
   * Mirrors the ONS/OS definition: a named street with a cluster of retail
   * and service addresses. Falls back to the ward/local area when OSM has no
   * usable retail cluster.
   */
  private async resolveHighStreet(args: {
    latitude: number | null;
    longitude: number | null;
    adminWard: string;
    parish: string;
    borough: string;
  }): Promise<{
    name: string;
    lat: number | null;
    lng: number | null;
    source: 'osm' | 'ward' | 'parish' | 'borough';
  }> {
    if (args.latitude !== null && args.longitude !== null) {
      const street = await this.lookupHighStreetFromOsm(
        args.latitude,
        args.longitude,
      );
      if (street) {
        return {
          name: street.name,
          lat: street.lat,
          lng: street.lng,
          source: 'osm',
        };
      }

      // Overpass is occasionally unavailable (or the area has thin OSM
      // retail coverage). Nominatim still gives us the named street the
      // postcode sits on, which is a much better UK "high street" label than
      // the electoral ward.
      const reverseStreet = await this.lookupStreetFromNominatim(
        args.latitude,
        args.longitude,
      );
      if (reverseStreet) {
        return {
          name: reverseStreet,
          lat: args.latitude,
          lng: args.longitude,
          source: 'osm',
        };
      }
    }

    if (args.adminWard) {
      return {
        name: this.cleanName(args.adminWard),
        lat: args.latitude,
        lng: args.longitude,
        source: 'ward',
      };
    }
    if (args.parish) {
      return {
        name: this.cleanName(args.parish),
        lat: args.latitude,
        lng: args.longitude,
        source: 'parish',
      };
    }
    return {
      name: this.cleanName(args.borough),
      lat: args.latitude,
      lng: args.longitude,
      source: 'borough',
    };
  }

  private async lookupHighStreetFromOsm(
    latitude: number,
    longitude: number,
  ): Promise<{ name: string; lat: number | null; lng: number | null } | null> {
    const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    const cached = this.highStreetCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const query =
      `[out:json][timeout:2];` +
      `(` +
      `nwr(around:250,${latitude},${longitude})[shop];` +
      `nwr(around:250,${latitude},${longitude})` +
      `[amenity~"^(restaurant|cafe|bank|fast_food|pub|bar)$"];` +
      `);out tags center;`;

    let data: any;
    try {
      const requests = OVERPASS_ENDPOINTS.map((endpoint) =>
        axios.post(
          endpoint,
          new URLSearchParams({ data: query }),
          {
            headers: {
              'User-Agent': 'McomSolutions/1.0 (contact@mcomsolutions.co.uk)',
              'Content-Type': 'application/x-www-form-urlencoded',
              Accept: 'application/json',
            },
            timeout: 2500,
            httpsAgent: ipv4Agent,
          },
        ),
      );
      data = (await Promise.any(requests)).data;
    } catch (error) {
      this.logger.warn(
        `High-street OSM lookup failed near ${latitude},${longitude}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.highStreetCache.set(cacheKey, {
        value: null,
        expiresAt: Date.now() + this.HIGH_STREET_MISS_TTL_MS,
      });
      return null;
    }

    const elements = Array.isArray(data?.elements) ? data.elements : [];
    const grouped = new Map<
      string,
      { count: number; latSum: number; lngSum: number; points: number }
    >();

    for (const element of elements) {
      const street = this.cleanName(element?.tags?.['addr:street'] || '');
      if (!street) continue;
      const center = this.elementCenter(element);
      const current = grouped.get(street) ?? {
        count: 0,
        latSum: 0,
        lngSum: 0,
        points: 0,
      };
      current.count += 1;
      if (center) {
        current.latSum += center.lat;
        current.lngSum += center.lng;
        current.points += 1;
      }
      grouped.set(street, current);
    }

    const ranked = [...grouped.entries()].sort(
      (a, b) => b[1].count - a[1].count,
    );
    const top = ranked[0];
    // A couple of isolated shops is not a high street. The ONS uses 15+
    // retail addresses within 150m; we use a deliberately lower bar because
    // OSM coverage is thinner, then keep the ward fallback for rural areas.
    if (!top || top[1].count < 3) {
      this.highStreetCache.set(cacheKey, {
        value: null,
        expiresAt: Date.now() + this.HIGH_STREET_MISS_TTL_MS,
      });
      return null;
    }

    const [name, stats] = top;
    const result = {
      name,
      lat: stats.points > 0 ? stats.latSum / stats.points : null,
      lng: stats.points > 0 ? stats.lngSum / stats.points : null,
    };
    this.highStreetCache.set(cacheKey, {
      value: result,
      expiresAt: Date.now() + this.HIGH_STREET_TTL_MS,
    });
    return result;
  }

  private async lookupStreetFromNominatim(
    latitude: number,
    longitude: number,
  ): Promise<string | null> {
    const cacheKey = `${latitude.toFixed(3)},${longitude.toFixed(3)}`;
    const cached = this.reverseStreetCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    try {
      const response = await axios.get(
        'https://nominatim.openstreetmap.org/reverse',
        {
          params: {
            lat: latitude,
            lon: longitude,
            format: 'jsonv2',
            addressdetails: 1,
            zoom: 18,
          },
          headers: {
            'User-Agent': 'McomSolutions/1.0 (contact@mcomsolutions.co.uk)',
          },
          timeout: 3500,
        },
      );
      const address = response.data?.address || {};
      const road = this.cleanName(
        address.road ||
          address.pedestrian ||
          address.footway ||
          address.square ||
          '',
      );
      const value = road || null;
      this.reverseStreetCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + this.HIGH_STREET_TTL_MS,
      });
      return value;
    } catch (error) {
      this.logger.warn(
        `Nominatim reverse street lookup failed near ${latitude},${longitude}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      this.reverseStreetCache.set(cacheKey, {
        value: null,
        expiresAt: Date.now() + this.HIGH_STREET_MISS_TTL_MS,
      });
      return null;
    }
  }

  private elementCenter(
    element: any,
  ): { lat: number; lng: number } | null {
    if (
      typeof element?.lat === 'number' &&
      typeof element?.lon === 'number'
    ) {
      return { lat: element.lat, lng: element.lon };
    }
    if (
      typeof element?.center?.lat === 'number' &&
      typeof element?.center?.lon === 'number'
    ) {
      return { lat: element.center.lat, lng: element.center.lon };
    }
    return null;
  }

  private async resolveWithNominatim(
    postcode: string,
  ): Promise<ResolvedPostcode> {
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
        headers: {
          'User-Agent': 'McomSolutions/1.0 (contact@mcomsolutions.co.uk)',
        },
        timeout: 6000,
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
    const countryCode = String(address.country_code || '').toLowerCase();
    if (countryCode && countryCode !== 'gb') {
      throw new BadRequestException(
        'We only support UK postcodes (England, Scotland, Wales and Northern Ireland).',
      );
    }

    const country = String(address.country || 'United Kingdom');
    const city = String(
      address.city ||
        address.town ||
        address.village ||
        address.county ||
        address.state ||
        '',
    );
    const borough = String(
      address.borough ||
        address.city_district ||
        address.county ||
        city,
    );
    const highStreet = String(
      address.road ||
        address.suburb ||
        address.neighbourhood ||
        address.quarter ||
        borough,
    );

    return {
      postcode,
      outwardCode: postcode.split(' ')[0],
      city: this.cleanName(city || borough),
      borough: this.cleanName(borough),
      highStreet: this.cleanName(highStreet),
      localMall: `${this.cleanName(highStreet || borough)} Local Mall`,
      region: String(address.state || address.region || ''),
      country: this.cleanName(country),
      latitude: item.lat ? Number(item.lat) : null,
      longitude: item.lon ? Number(item.lon) : null,
      adminDistrict: borough,
      adminWard: String(address.suburb || ''),
      parish: String(address.suburb || ''),
      cityGssCode: null,
      boroughGssCode: null,
      highStreetGssCode: null,
      highStreetSource: address.road ? 'osm' : 'ward',
      source: 'nominatim',
    };
  }

  private normalizeName(value: string): string {
    return (value || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private cleanName(value: string): string {
    return (value || '').trim().replace(/\s+/g, ' ');
  }
}
