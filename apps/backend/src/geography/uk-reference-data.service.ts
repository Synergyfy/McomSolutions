import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as https from 'https';
import * as fs from 'fs';
import { join } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { PostcodeService, ResolvedPostcode } from './postcode.service';

const ipv4Agent = new https.Agent({ family: 4 });

const ONS_LOOKUP_URL =
  'https://services1.arcgis.com/ESMARspQHYMw9BZ9/arcgis/rest/services/' +
  'WD25_LAD25_CTYUA25_RGN25_CTRY25_UK_LU/FeatureServer/0/query';

const OSM_QUERY =
  '[out:json][timeout:90];' +
  'area["ISO3166-1"="GB"][admin_level=2]->.uk;' +
  'nwr["shop"="mall"]["name"]["addr:postcode"](area.uk);' +
  'out center tags;';

const OSM_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

interface OnsRow {
  wardCode: string;
  wardName: string;
  ladCode: string;
  ladName: string;
  ctyuaName: string;
  regionCode: string;
  regionName: string;
  countryCode: string;
  countryName: string;
}

export interface ImportAdministrativeSummary {
  fetched: number;
  regions: number;
  boroughs: number;
  highStreets: number;
  citiesCreated: number;
  citiesUpdated: number;
  boroughsCreated: number;
  boroughsUpdated: number;
  highStreetsCreated: number;
  highStreetsUpdated: number;
  skipped: number;
  errors: string[];
}

export interface ImportMallsSummary {
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  sourceErrors: string[];
  errors: Array<{ name: string; postcode: string; message: string }>;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function slugify(value: string): string {
  return (
    (value || '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || `location-${Date.now()}`
  );
}

@Injectable()
export class UkReferenceDataService {
  private readonly logger = new Logger(UkReferenceDataService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly postcodeService: PostcodeService,
  ) {}

  /** Pulls the ONS ward → LAD → region → country lookup. */
  private async fetchOnsRows(): Promise<OnsRow[]> {
    const rows: OnsRow[] = [];
    const pageSize = 1000;
    let offset = 0;

    while (offset < 50000) {
      let response;
      let lastError: unknown;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          response = await axios.get(ONS_LOOKUP_URL, {
            params: {
              where: '1=1',
              outFields:
                'WD25CD,WD25NM,LAD25CD,LAD25NM,CTYUA25NM,RGN25CD,RGN25NM,CTRY25CD,CTRY25NM',
              returnGeometry: 'false',
              f: 'json',
              resultRecordCount: pageSize,
              resultOffset: offset,
              orderByFields: 'WD25CD ASC',
            },
            timeout: 60000,
            httpsAgent: ipv4Agent,
          });
          break;
        } catch (error) {
          lastError = error;
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
        }
      }
      if (!response) {
        throw lastError instanceof Error
          ? lastError
          : new Error(`ONS lookup failed at offset ${offset}`);
      }

      const features = response.data?.features;
      if (!Array.isArray(features) || features.length === 0) break;

      for (const feature of features) {
        const attributes = feature.attributes || {};
        if (!attributes.WD25CD || !attributes.WD25NM) continue;
        rows.push({
          wardCode: String(attributes.WD25CD),
          wardName: String(attributes.WD25NM),
          ladCode: String(attributes.LAD25CD || ''),
          ladName: String(attributes.LAD25NM || ''),
          ctyuaName: String(attributes.CTYUA25NM || ''),
          regionCode: String(attributes.RGN25CD || ''),
          regionName: String(attributes.RGN25NM || ''),
          countryCode: String(attributes.CTRY25CD || ''),
          countryName: String(attributes.CTRY25NM || 'United Kingdom'),
        });
      }

      offset += features.length;
      if (!response.data?.exceededTransferLimit) break;
    }

    return rows;
  }

  /**
   * Imports ONS regions as Cities, Local Authority Districts as Boroughs, and
   * wards as High Streets. Existing records are matched by GSS code first, then
   * by name, so manually-created and previously assigned locations are reused.
   */
  async importAdministrativeAreas(): Promise<ImportAdministrativeSummary> {
    const summary: ImportAdministrativeSummary = {
      fetched: 0,
      regions: 0,
      boroughs: 0,
      highStreets: 0,
      citiesCreated: 0,
      citiesUpdated: 0,
      boroughsCreated: 0,
      boroughsUpdated: 0,
      highStreetsCreated: 0,
      highStreetsUpdated: 0,
      skipped: 0,
      errors: [],
    };

    const rows = await this.fetchOnsRows();
    summary.fetched = rows.length;
    if (rows.length === 0) {
      summary.errors.push('ONS lookup returned no rows.');
      return summary;
    }

    const regionMap = new Map<
      string,
      { name: string; country: string; region: string }
    >();
    const ladMap = new Map<
      string,
      { name: string; regionCode: string; regionName: string; country: string }
    >();
    const wardMap = new Map<
      string,
      { name: string; ladCode: string; ladName: string }
    >();

    for (const row of rows) {
      const regionKey = row.regionCode || row.countryCode || row.regionName || row.countryName;
      const regionName = row.regionName || row.countryName;
      if (regionName && !regionMap.has(regionKey)) {
        regionMap.set(regionKey, {
          name: regionName,
          country: row.countryName || 'United Kingdom',
          region: regionName,
        });
      }

      if (row.ladCode && !ladMap.has(row.ladCode)) {
        ladMap.set(row.ladCode, {
          name: row.ladName || row.ctyuaName,
          regionCode: regionKey,
          regionName,
          country: row.countryName || 'United Kingdom',
        });
      }

      if (row.wardCode && !wardMap.has(row.wardCode)) {
        wardMap.set(row.wardCode, {
          name: row.wardName,
          ladCode: row.ladCode,
          ladName: row.ladName,
        });
      }
    }

    summary.regions = regionMap.size;
    summary.boroughs = ladMap.size;
    summary.highStreets = wardMap.size;

    // ── Cities (regions) ─────────────────────────────────────
    const existingCities = await this.prisma.city.findMany({
      select: { id: true, name: true, gssCode: true },
    });
    const cityByGss = new Map(
      existingCities.filter((city) => city.gssCode).map((city) => [city.gssCode as string, city]),
    );
    const cityByName = new Map(
      existingCities.map((city) => [city.name.toLowerCase(), city]),
    );
    const regionCityId = new Map<string, string>();

    for (const [regionCode, region] of regionMap) {
      let city = cityByGss.get(regionCode) || cityByName.get(region.name.toLowerCase());
      if (city) {
        if (city.gssCode !== regionCode) {
          await this.prisma.city.update({
            where: { id: city.id },
            data: { gssCode: regionCode, region: region.region, country: region.country },
          });
          summary.citiesUpdated += 1;
        }
        cityByGss.set(regionCode, city);
        cityByName.set(region.name.toLowerCase(), city);
        regionCityId.set(regionCode, city.id);
      } else {
        const created = await this.prisma.city.create({
          data: {
            name: region.name,
            gssCode: regionCode,
            region: region.region,
            country: region.country,
          },
          select: { id: true, name: true, gssCode: true },
        });
        cityByGss.set(regionCode, created);
        cityByName.set(region.name.toLowerCase(), created);
        regionCityId.set(regionCode, created.id);
        summary.citiesCreated += 1;
      }
    }

    // ── Boroughs (LADs) ──────────────────────────────────────
    const existingBoroughs = await this.prisma.borough.findMany({
      select: { id: true, name: true, gssCode: true, cityId: true },
    });
    const boroughByGss = new Map(
      existingBoroughs
        .filter((borough) => borough.gssCode)
        .map((borough) => [borough.gssCode as string, borough]),
    );
    const boroughByName = new Map(
      existingBoroughs.map((borough) => [borough.name.toLowerCase(), borough]),
    );
    const ladBoroughId = new Map<string, string>();
    const boroughsToCreate: any[] = [];

    for (const [ladCode, lad] of ladMap) {
      if (!lad.name) {
        summary.skipped += 1;
        continue;
      }
      const cityId = regionCityId.get(lad.regionCode);
      if (!cityId) {
        summary.errors.push(`No city resolved for ${lad.name} (${ladCode}).`);
        summary.skipped += 1;
        continue;
      }

      const existing = boroughByGss.get(ladCode) || boroughByName.get(lad.name.toLowerCase());
      if (existing) {
        await this.prisma.borough.update({
          where: { id: existing.id },
          // Do not undo a settlement-city link created by postcode signups.
          // Only fill a missing city.
          data: { gssCode: ladCode, ...(existing.cityId ? {} : { cityId }) },
        });
        boroughByGss.set(ladCode, existing);
        boroughByName.set(lad.name.toLowerCase(), existing);
        ladBoroughId.set(ladCode, existing.id);
        summary.boroughsUpdated += 1;
      } else {
        boroughsToCreate.push({
          name: lad.name,
          gssCode: ladCode,
          cityId,
          populationActivity: 'Moderate',
          rewardsParticipation: '0%',
          healthScore: 0,
          manager: 'Unassigned',
          area: regionMap.get(lad.regionCode)?.name || lad.regionName,
          region: lad.regionName,
          engagement: 'Unknown',
          health: 'Unknown',
          activity: 'Inactive',
        });
      }
    }

    if (boroughsToCreate.length) {
      const created = await this.prisma.borough.createMany({
        data: boroughsToCreate,
        skipDuplicates: true,
      });
      summary.boroughsCreated = created.count;
      const refreshed = await this.prisma.borough.findMany({
        select: { id: true, name: true, gssCode: true, cityId: true },
      });
      for (const borough of refreshed) {
        if (borough.gssCode) boroughByGss.set(borough.gssCode, borough);
        boroughByName.set(borough.name.toLowerCase(), borough);
      }
      for (const [ladCode, lad] of ladMap) {
        const borough = boroughByName.get(lad.name.toLowerCase());
        if (borough) ladBoroughId.set(ladCode, borough.id);
      }
    }

    // ── High Streets (wards) ─────────────────────────────────
    const existingHighStreets = await this.prisma.highStreet.findMany({
      select: { id: true, name: true, borough: true, gssCode: true },
    });
    const highStreetByGss = new Map(
      existingHighStreets
        .filter((street) => street.gssCode)
        .map((street) => [street.gssCode as string, street]),
    );
    const highStreetByNameBorough = new Map(
      existingHighStreets.map((street) => [
        `${street.name.toLowerCase()}::${street.borough.toLowerCase()}`,
        street,
      ]),
    );
    const highStreetsToCreate: any[] = [];

    for (const [wardCode, ward] of wardMap) {
      const lad = ladMap.get(ward.ladCode);
      if (!lad || !ward.ladName) {
        summary.skipped += 1;
        continue;
      }
      const cityId = regionCityId.get(lad.regionCode);
      const boroughId = ladBoroughId.get(ward.ladCode);
      if (!cityId || !boroughId) {
        summary.errors.push(`No borough resolved for ward ${ward.name} (${wardCode}).`);
        summary.skipped += 1;
        continue;
      }

      const key = `${ward.name.toLowerCase()}::${ward.ladName.toLowerCase()}`;
      const existing = highStreetByGss.get(wardCode) || highStreetByNameBorough.get(key);
      if (existing) {
        if (existing.gssCode !== wardCode) {
          await this.prisma.highStreet.update({
            where: { id: existing.id },
            data: { gssCode: wardCode, cityId, boroughId },
          });
          summary.highStreetsUpdated += 1;
        }
        highStreetByGss.set(wardCode, existing);
        highStreetByNameBorough.set(key, existing);
      } else {
        highStreetsToCreate.push({
          name: ward.name,
          gssCode: wardCode,
          borough: ward.ladName,
          cityId,
          boroughId,
          status: 'Active',
        });
      }
    }

    for (const batch of chunk(highStreetsToCreate, 1000)) {
      const created = await this.prisma.highStreet.createMany({
        data: batch,
        skipDuplicates: true,
      });
      summary.highStreetsCreated += created.count;
    }

    this.logger.log(
      `ONS import complete: ${summary.regions} regions, ${summary.boroughs} boroughs, ` +
        `${summary.highStreets} wards`,
    );
    return summary;
  }

  /** Best-effort import of named UK shopping malls from OpenStreetMap. */
  async importMalls(limit?: number): Promise<ImportMallsSummary> {
    const summary: ImportMallsSummary = {
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      sourceErrors: [],
      errors: [],
    };

    const elements = await this.fetchOsmMalls(summary);
    summary.fetched = elements.length;
    if (elements.length === 0) {
      summary.sourceErrors.push('OSM unavailable; using bundled mall fixture.');
      await this.importMallsFromFixture(summary);
      return summary;
    }
    const selected = limit ? elements.slice(0, limit) : elements;
    const resolvedCache = new Map<string, ResolvedPostcode | { error: string }>();

    const resolveOnce = async (postcode: string) => {
      const key = postcode.toUpperCase().replace(/\s+/g, ' ').trim();
      const cached = resolvedCache.get(key);
      if (cached) return cached;
      try {
        const resolved = await this.postcodeService.resolve(postcode);
        resolvedCache.set(key, resolved);
        return resolved;
      } catch (error) {
        const recorded = { error: error instanceof Error ? error.message : String(error) };
        resolvedCache.set(key, recorded);
        return recorded;
      }
    };

    for (const element of selected) {
      const tags = element.tags || {};
      const name = (tags.name || '').trim();
      const postcode = (tags['addr:postcode'] || '').trim();
      if (!name || !postcode) {
        summary.skipped += 1;
        continue;
      }

      const resolved = await resolveOnce(postcode);
      if ('error' in resolved) {
        summary.failed += 1;
        summary.errors.push({ name, postcode, message: resolved.error });
        continue;
      }

      try {
        const hierarchy = await this.resolveMallHierarchy(resolved);
        if (!hierarchy) {
          summary.failed += 1;
          summary.errors.push({
            name,
            postcode,
            message: 'Could not resolve city/borough/high street for postcode.',
          });
          continue;
        }

        const osmId = `${element.type}/${element.id}`;
        const existing = await this.prisma.localMall.findFirst({
          where: {
            OR: [
              { osmId },
              { name, borough: hierarchy.boroughName },
            ],
          },
          select: { id: true, postcodes: true },
        });

        if (existing) {
          await this.prisma.localMall.update({
            where: { id: existing.id },
            data: {
              osmId,
              source: 'osm',
              cityId: hierarchy.cityId,
              boroughId: hierarchy.boroughId,
              highStreetId: hierarchy.highStreetId,
              primaryHighStreet: hierarchy.highStreetName,
              postcodes: existing.postcodes.includes(resolved.outwardCode)
                ? existing.postcodes
                : [...existing.postcodes, resolved.outwardCode],
            },
          });
          summary.updated += 1;
        } else {
          const slug = await this.uniqueMallSlug(`${name}-${resolved.outwardCode}`);
          await this.prisma.localMall.create({
            data: {
              name,
              osmId,
              source: 'osm',
              postcodes: [resolved.outwardCode],
              borough: hierarchy.boroughName,
              cityId: hierarchy.cityId,
              boroughId: hierarchy.boroughId,
              highStreetId: hierarchy.highStreetId,
              primaryHighStreet: hierarchy.highStreetName,
              additionalHighStreets: [],
              status: 'Active',
              description: `${name} — imported from OpenStreetMap.`,
              longDescription: `${name} connects local businesses to the MCOM ecosystem.`,
              slug,
              primaryColour: '#1D4ED8',
              secondaryColour: '#F97316',
              welcomeMessage: `Welcome to ${name}.`,
              tagline: 'Shop local, earn rewards.',
              radiusCoverage: '5 miles',
            },
          });
          summary.created += 1;
        }
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({
          name,
          postcode,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    this.logger.log(
      `OSM mall import complete: ${summary.created} created, ${summary.updated} updated, ` +
        `${summary.failed} failed`,
    );
    return summary;
  }

  private async importMallsFromFixture(summary: ImportMallsSummary): Promise<void> {
    const fixturePath = join(process.cwd(), 'prisma', 'reference-data', 'uk-malls.json');
    if (!fs.existsSync(fixturePath)) {
      summary.sourceErrors.push(`Mall fixture not found at ${fixturePath}`);
      return;
    }

    const records = JSON.parse(fs.readFileSync(fixturePath, 'utf8')) as Array<{
      name: string;
      osmId: string;
      postcodes: string[];
      city: string;
      borough: string;
      highStreet: string;
      primaryHighStreet: string;
    }>;

    summary.fetched = records.length;

    for (const record of records) {
      try {
        const city = await this.prisma.city.findFirst({ where: { name: record.city } });
        const borough = await this.prisma.borough.findFirst({ where: { name: record.borough } });
        const highStreet = await this.prisma.highStreet.findFirst({
          where: { name: record.highStreet, borough: record.borough },
        });
        if (!city || !borough) {
          summary.failed += 1;
          summary.errors.push({
            name: record.name,
            postcode: record.postcodes?.[0] || '',
            message: 'City or borough not found for fixture mall.',
          });
          continue;
        }

        const existing = await this.prisma.localMall.findFirst({
          where: {
            OR: [{ osmId: record.osmId }, { name: record.name, borough: record.borough }],
          },
          select: { id: true, postcodes: true },
        });

        if (existing) {
          await this.prisma.localMall.update({
            where: { id: existing.id },
            data: {
              osmId: record.osmId,
              source: 'osm',
              cityId: city.id,
              boroughId: borough.id,
              highStreetId: highStreet?.id,
              primaryHighStreet: record.primaryHighStreet || highStreet?.name || borough.name,
              postcodes: [...new Set([...(existing.postcodes || []), ...(record.postcodes || [])])],
            },
          });
          summary.updated += 1;
        } else {
          const slug = await this.uniqueMallSlug(
            `${record.name}-${record.postcodes?.[0] || borough.name}`,
          );
          await this.prisma.localMall.create({
            data: {
              name: record.name,
              osmId: record.osmId,
              source: 'osm',
              postcodes: record.postcodes || [],
              borough: record.borough,
              cityId: city.id,
              boroughId: borough.id,
              highStreetId: highStreet?.id,
              primaryHighStreet: record.primaryHighStreet || highStreet?.name || borough.name,
              additionalHighStreets: [],
              status: 'Active',
              description: `${record.name} — imported from OpenStreetMap.`,
              longDescription: `${record.name} connects local businesses to the MCOM ecosystem.`,
              slug,
              primaryColour: '#1D4ED8',
              secondaryColour: '#F97316',
              welcomeMessage: `Welcome to ${record.name}.`,
              tagline: 'Shop local, earn rewards.',
              radiusCoverage: '5 miles',
            },
          });
          summary.created += 1;
        }
      } catch (error) {
        summary.failed += 1;
        summary.errors.push({
          name: record.name,
          postcode: record.postcodes?.[0] || '',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async fetchOsmMalls(summary: ImportMallsSummary): Promise<any[]> {
    for (const endpoint of OSM_ENDPOINTS) {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await axios.post(endpoint, new URLSearchParams({ data: OSM_QUERY }), {
            headers: {
              'User-Agent': 'McomSolutions/1.0 (contact@mcomsolutions.co.uk)',
              'Content-Type': 'application/x-www-form-urlencoded',
              Accept: 'application/json',
            },
            timeout: 120000,
            httpsAgent: ipv4Agent,
          });
          const elements = response.data?.elements;
          if (Array.isArray(elements)) {
            summary.sourceErrors.push(`${endpoint}: ${elements.length} elements`);
            return elements;
          }
          summary.sourceErrors.push(`${endpoint}: unexpected response`);
        } catch (error) {
          summary.sourceErrors.push(
            `${endpoint}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    }
    return [];
  }

  private async resolveMallHierarchy(resolved: ResolvedPostcode) {
    let city = await this.prisma.city.findFirst({
      where: { OR: [{ name: resolved.city }, { name: resolved.region }, { name: resolved.borough }] },
    });
    if (!city) {
      city = await this.prisma.city.create({
        data: { name: resolved.city, region: resolved.region || resolved.city },
      });
    }

    let borough = await this.prisma.borough.findFirst({
      where: { name: resolved.borough },
    });
    if (!borough) {
      borough = await this.prisma.borough.create({
        data: {
          name: resolved.borough,
          cityId: city.id,
          populationActivity: 'Moderate',
          rewardsParticipation: '0%',
          healthScore: 0,
          manager: 'Unassigned',
          area: city.name,
          region: resolved.region || city.name,
          engagement: 'Unknown',
          health: 'Unknown',
          activity: 'Inactive',
        },
      });
    }

    let highStreet = await this.prisma.highStreet.findFirst({
      where: { name: resolved.highStreet, borough: borough.name },
    });
    if (!highStreet) {
      highStreet = await this.prisma.highStreet.create({
        data: {
          name: resolved.highStreet,
          borough: borough.name,
          cityId: city.id,
          boroughId: borough.id,
          status: 'Active',
          lat: resolved.latitude,
          lng: resolved.longitude,
        },
      });
    }

    return {
      cityId: city.id,
      cityName: city.name,
      boroughId: borough.id,
      boroughName: borough.name,
      highStreetId: highStreet.id,
      highStreetName: highStreet.name,
    };
  }

  private async uniqueMallSlug(base: string): Promise<string> {
    const baseSlug = slugify(base);
    let candidate = baseSlug;
    let suffix = 1;
    while (
      await this.prisma.localMall.findUnique({ where: { slug: candidate }, select: { id: true } })
    ) {
      suffix += 1;
      candidate = `${baseSlug}-${suffix}`;
    }
    return candidate;
  }
}
