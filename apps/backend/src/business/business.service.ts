import { Injectable, NotFoundException, ForbiddenException, ServiceUnavailableException, UnauthorizedException, ConflictException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { TASK_EVENT_QUEUE, TaskEventJobData } from '../queue/queue.constants';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { GoogleOAuthService } from '../auth/google-oauth.service';
import { LocationAssignmentService } from '../geography/location-assignment.service';
import { ResolvedPostcode } from '../geography/postcode.service';
import { BusinessAcquisitionService } from '../affiliate/business-acquisition.service';
import { generateUniqueReferralCode } from '../common/referral/referral.util';
import { MembershipLevel, MembershipTier, Role, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import axios from 'axios';

export interface CompleteOnboardingInput {
  email?: string;
  grant?: string;
  firstName?: string;
  lastName?: string;
  businessName?: string;
  businessType?: string;
  businessPhone?: string;
  googlePlaceId?: string;
  password?: string;
  address?: string;
  postcode?: string;
  website?: string;
  openingHours?: string;
  industry?: string;
  category?: string;
  subCategory?: string;
  source?: string;
  photos?: any[];
  affiliateInvite?: string;
  [key: string]: unknown;
}

export interface BusinessCaller {
  userId: string;
  businessId?: string;
  role?: Role;
}

/** Non-admin directory view: no contact PII, no user relation, no secrets. */
const businessDirectorySelect = {
  id: true,
  businessName: true,
  businessType: true,
  country: true,
  industry: true,
  category: true,
  subCategory: true,
  logoUrl: true,
  membershipLevel: true,
  membershipTier: true,
  membershipStatus: true,
  createdAt: true,
} as const;

/** Owner/admin detail view: full profile, but the linked user never exposes `password`. */
const businessDetailSelect = {
  id: true,
  userId: true,
  businessName: true,
  businessType: true,
  country: true,
  phone: true,
  email: true,
  isOnGoogle: true,
  googlePlaceId: true,
  address: true,
  postcode: true,
  industry: true,
  category: true,
  subCategory: true,
  description: true,
  website: true,
  logoUrl: true,
  openingHours: true,
  socialMedia: true,
  membershipLevel: true,
  membershipTier: true,
  membershipStatus: true,
  membershipPlanName: true,
  membershipExpiresAt: true,
  acquiredByAffiliateName: true,
  acquiredByAffiliateRole: true,
  acquisitionStatus: true,
  acquisitionAttributedAt: true,
  hasPaidVerificationFee: true,
  verificationFeePaidAt: true,
  trialAccessDays: true,
  trialAccessExpiresAt: true,
  apiKey: true,
  localMallName: true,
  localMallId: true,
  proximityTier: true,
  cityId: true,
  boroughId: true,
  highStreetId: true,
  sectorId: true,
  categoryId: true,
  subCategoryId: true,
  locationAssignedAt: true,
  city: { select: { id: true, name: true, region: true } },
  borough: { select: { id: true, name: true } },
  highStreet: { select: { id: true, name: true } },
  localMall: { select: { id: true, name: true } },
  sector: { select: { id: true, name: true } },
  categoryRef: { select: { id: true, name: true } },
  subCategoryRef: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
  user: {
    select: {
      id: true,
      email: true,
      role: true,
      firstName: true,
      lastName: true,
      createdAt: true,
    },
  },
  packages: true,
  transactions: true,
} as const;

export interface BusinessHoursItem {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  is24h?: boolean;
}

export interface UpdateProfileInput {
  businessName?: string;
  phone?: string;
  businessPhone?: string;
  address?: string;
  postcode?: string;
  website?: string;
  logoUrl?: string;
  openingHours?: string;
  socialMedia?: string;
  description?: string;
  shortDescription?: string;
  category?: string;
  categoryId?: string;
  subCategory?: string;
  subCategoryId?: string;
  industry?: string;
  sectorId?: string;
  businessType?: string;
  listingType?: string[];
  businessHours?: BusinessHoursItem[];
  location?: {
    addressLine1?: string;
    postcode?: string;
  };
  [key: string]: unknown;
}

@Injectable()
export class BusinessService {
  private readonly logger = new Logger(BusinessService.name);

  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private configService: ConfigService,
    private googleOAuth: GoogleOAuthService,
    private locationAssignment: LocationAssignmentService,
    private businessAcquisition: BusinessAcquisitionService,
    @Optional() @InjectQueue(TASK_EVENT_QUEUE) private taskEventQueue?: Queue<TaskEventJobData>,
  ) { }

  private async emitTaskEvent(
    userId: string,
    userType: 'BUSINESS' | 'CUSTOMER',
    featureKey: string,
    meta?: Record<string, unknown>,
  ) {
    if (!this.taskEventQueue) return;
    try {
      await this.taskEventQueue.add('evaluate-task', {
        userId,
        userType,
        featureKey,
        meta,
      });
      this.logger.log(`Enqueued task-event ${featureKey} for user ${userId}`);
    } catch (err) {
      this.logger.warn(`Failed to enqueue task-event for ${featureKey}:`, err as any);
    }
  }

  private async ensureBusinessProgramme(businessId: string, businessName: string, sector?: string | null) {
    try {
      const existing = await this.prisma.businessProgramme.findFirst({ where: { businessId } });
      if (!existing) {
        await this.prisma.businessProgramme.create({
          data: {
            businessId,
            businessName,
            sector: sector || '',
            currentDay: 1,
            status: 'active',
            agentName: 'MCOM Onboarding Specialist',
            accountManagerName: 'Dedicated Manager',
            consultantName: 'Business Growth Advisor',
            completedMissions: [],
          },
        });
        this.logger.log(`Auto-enrolled business ${businessName} (${businessId}) into 90-Day Programme`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to auto-enroll business in programme: ${msg}`);
    }
  }

  // ─── Postcode Address Search ──────────────────────────
  async searchAddresses(postcode: string) {
    const cleanPostcode = postcode.toUpperCase().trim();
    if (cleanPostcode.length < 3) return [];

    try {
      const url = `https://nominatim.openstreetmap.org/search?postalcode=${encodeURIComponent(cleanPostcode)}&country=United%20Kingdom&format=json&addressdetails=1`;

      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'McomSolutions/1.0 (contact@mcomsolutions.co.uk)',
        },
      });

      if (!response.data || !Array.isArray(response.data)) {
        return [];
      }

      return response.data.map((item: any, index: number) => {
        const addr = item.address;
        const street = addr.road || addr.suburb || addr.neighbourhood || '';
        const building = addr.house_number || addr.building || '';
        const city = addr.city || addr.town || addr.suburb || 'London';

        let primaryLine = building ? `${building} ${street}` : street;
        if (!primaryLine) {
          primaryLine = item.display_name.split(',')[0];
        }

        const displayName = `${primaryLine}, ${city}, ${cleanPostcode}`;

        return {
          id: `addr-${item.place_id || index}`,
          displayName,
          formattedAddress: item.display_name,
          postcode: cleanPostcode,
          latitude: item.lat,
          longitude: item.lon,
          borough: addr.suburb || addr.borough || addr.city_district || '',
        };
      });
    } catch (err) {
      this.logger.error('Error querying Nominatim API for postcode:', err);
      return [];
    }
  }

  // ─── Device Coordinates to Address ────────────────────
  async reverseGeocode(latitude: number, longitude: number) {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: { lat: latitude, lon: longitude, format: 'jsonv2', addressdetails: 1, zoom: 18 },
        headers: { 'User-Agent': 'McomSolutions/1.0 (contact@mcomsolutions.co.uk)' },
      });

      const result = response.data;
      const address = result?.address || {};
      return {
        postcode: address.postcode || '',
        address: result?.display_name || '',
        city: address.city || address.town || address.village || address.suburb || '',
        area: address.borough || address.city_district || address.county || '',
      };
    } catch (err) {
      this.logger.error('Error reverse geocoding device coordinates:', err);
      throw new ServiceUnavailableException('We could not find an address for your current location. Enter your business postcode instead.');
    }
  }

  // ─── Proximity Check ──────────────────────────────────
  async checkLocationProximity(postcode: string) {
    try {
      const resolved = await this.locationAssignment.resolvePostcode(postcode);

      // A valid UK postcode always resolves to a hierarchy. If an existing
      // local mall already covers this postcode's outward code, show that one;
      // otherwise the missing entities are created on assignment at signup.
      // Outward-code matching is what keeps a Peckham business in the curated
      // "Peckham LocalMall" (SE15) instead of a generated duplicate.
      let matchedMall = resolved.outwardCode
        ? await this.prisma.localMall.findFirst({
            where: {
              postcodes: { has: resolved.outwardCode },
              borough: { equals: resolved.borough, mode: 'insensitive' },
            },
            select: { id: true, name: true },
          })
        : null;
      if (!matchedMall && resolved.outwardCode) {
        matchedMall = await this.prisma.localMall.findFirst({
          where: { postcodes: { has: resolved.outwardCode } },
          select: { id: true, name: true },
        });
      }
      if (!matchedMall) {
        matchedMall = await this.prisma.localMall.findFirst({
          where: { name: resolved.localMall, borough: resolved.borough },
          select: { id: true, name: true },
        });
      }

      return {
        resolvedArea: resolved.borough,
        status: 'active',
        localMallName: matchedMall?.name ?? resolved.localMall,
        localMallId: matchedMall?.id ?? null,
        city: resolved.city,
        borough: resolved.borough,
        highStreet: resolved.highStreet,
        localMall: resolved.localMall,
        region: resolved.region,
        latitude: resolved.latitude,
        longitude: resolved.longitude,
        postcode: resolved.postcode,
        proximityTier: 'high_street',
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        return {
          resolvedArea: '',
          status: 'inactive',
          localMallName: null,
          localMallId: null,
          city: null,
          borough: null,
          highStreet: null,
          localMall: null,
          proximityTier: 'national',
          message: error.message,
        };
      }
      throw error;
    }
  }

  private getGoogleApiKey(): string {
    const apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Google Places API is not configured.');
    }
    return apiKey;
  }

  async getGooglePhotoStream(photoReference: string, maxWidthPx: number = 800) {
    const apiKey = this.getGoogleApiKey();
    const url = `https://places.googleapis.com/v1/${photoReference}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`;
    return axios.get(url, { responseType: 'stream' });
  }

  // ─── Google Places Lookup ─────────────────────────────
  async searchGoogleBusinesses(queryText: string, radius?: number, lat?: number, lng?: number) {
    const apiKey = this.getGoogleApiKey();

    try {
      const payload: Record<string, any> = { textQuery: queryText };

      if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
        // Convert radius: if <= 50, treat as km (from frontend slider 1-50); otherwise assume meters.
        // Google Places API circle radius must be in meters between 0.0 and 50000.0.
        let radiusInMeters = 5000;
        if (typeof radius === 'number' && !isNaN(radius) && radius > 0) {
          radiusInMeters = radius <= 50 ? radius * 1000 : radius;
        }
        radiusInMeters = Math.min(Math.max(radiusInMeters, 500), 50000);

        payload.locationBias = {
          circle: {
            center: {
              latitude: lat,
              longitude: lng,
            },
            radius: radiusInMeters,
          },
        };
      }

      const response = await axios.post(
        'https://places.googleapis.com/v1/places:searchText',
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.types,places.internationalPhoneNumber,places.userRatingCount,places.location,places.photos,places.websiteUri,places.regularOpeningHours',
          },
        },
      );

      const places = response.data?.places || [];
      return places.map((place: any) => {
        const types = place.types || [];
        const primaryType = types[0] || 'establishment';
        const photoName = place.photos?.[0]?.name;
        const heroImg = photoName ? `/api/v1/business/google/photo?photoReference=${encodeURIComponent(photoName)}&maxWidthPx=800` : '';
        const thumbImg = photoName ? `/api/v1/business/google/photo?photoReference=${encodeURIComponent(photoName)}&maxWidthPx=200` : '';
        const allPhotos = (place.photos || []).slice(0, 5).map((ph: any) => `/api/v1/business/google/photo?photoReference=${encodeURIComponent(ph.name)}&maxWidthPx=800`);

        return {
          googlePlaceId: place.id,
          placeId: place.id,
          place_id: place.id,
          name: place.displayName?.text || 'Business Name',
          formattedAddress: place.formattedAddress || '',
          formatted_address: place.formattedAddress || '',
          postcode: this.extractPostcode(place.formattedAddress || ''),
          businessPhone: place.internationalPhoneNumber || '',
          rating: place.rating || 0,
          userRatingsTotal: place.userRatingCount || 0,
          user_ratings_total: place.userRatingCount || 0,
          lat: place.location?.latitude || 0,
          lng: place.location?.longitude || 0,
          website: place.websiteUri || '',
          heroImg,
          thumbImg,
          allPhotos,
          hours: place.regularOpeningHours?.weekdayDescriptions?.[new Date().getDay()] || (place.regularOpeningHours?.openNow ? 'Open now' : 'Closed'),
          isOpenNow: place.regularOpeningHours?.openNow ?? false,
          types: types,
          googleCategoryId: `gcid:${primaryType}`,
        };
      });
    } catch (err: any) {
      this.logger.error('Error fetching from Google Places API:', err?.response?.data || err.message);
      throw new ServiceUnavailableException('Google Places API request failed.');
    }
  }

  private extractPostcode(address: string) {
    const match = address.match(/[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}/i);
    return match ? match[0] : '';
  }

  // ─── Google Place Details ─────────────────────────────
  async getGooglePlaceDetails(placeId: string) {
    const apiKey = this.getGoogleApiKey();

    try {
      const response = await axios.get(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'id,displayName,formattedAddress,rating,types,internationalPhoneNumber,websiteUri,regularOpeningHours,userRatingCount,location,photos',
          },
        },
      );

      const place = response.data;
      if (!place) {
        throw new NotFoundException(`Google place details for id '${placeId}' not found`);
      }

      const types = place.types || [];
      const primaryType = types[0] || 'establishment';
      const photoName = place.photos?.[0]?.name;
      const heroImg = photoName ? `/api/v1/business/google/photo?photoReference=${encodeURIComponent(photoName)}&maxWidthPx=800` : '';
      const thumbImg = photoName ? `/api/v1/business/google/photo?photoReference=${encodeURIComponent(photoName)}&maxWidthPx=200` : '';
      const allPhotos = (place.photos || []).slice(0, 5).map((ph: any) => `/api/v1/business/google/photo?photoReference=${encodeURIComponent(ph.name)}&maxWidthPx=800`);

      return {
        googlePlaceId: place.id,
        placeId: place.id,
        place_id: place.id,
        name: place.displayName?.text || 'Business Name',
        formattedAddress: place.formattedAddress || '',
        formatted_address: place.formattedAddress || '',
        postcode: this.extractPostcode(place.formattedAddress || ''),
        internationalPhoneNumber: place.internationalPhoneNumber || '',
        businessPhone: place.internationalPhoneNumber || '',
        website: place.websiteUri || '',
        rating: place.rating || 0,
        userRatingsTotal: place.userRatingCount || 0,
        user_ratings_total: place.userRatingCount || 0,
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
        heroImg,
        thumbImg,
        allPhotos,
        openingHours: place.regularOpeningHours ? {
          open_now: place.regularOpeningHours.openNow ?? false,
          weekday_text: place.regularOpeningHours.weekdayDescriptions || [],
        } : null,
        hours: place.regularOpeningHours?.weekdayDescriptions?.[new Date().getDay()] || (place.regularOpeningHours?.openNow ? 'Open now' : 'Closed'),
        isOpenNow: place.regularOpeningHours?.openNow ?? false,
        types: types,
        googleCategoryId: `gcid:${primaryType}`,
      };
    } catch (err: any) {
      this.logger.error('Error fetching from Google Place Details API:', err?.response?.data || err.message);
      if (err instanceof NotFoundException) throw err;
      if (err?.response?.status === 404) {
        throw new NotFoundException(`Google place details for id '${placeId}' not found`);
      }
      throw new ServiceUnavailableException('Google Places API request failed.');
    }
  }

  // ─── Claim Start & Google OAuth Redirect ───────────────
  async claimStart(placeId: string, returnUrl: string) {
    if (!this.googleOAuth.isConfigured()) {
      if (this.googleOAuth.isSimulatorEnabled()) {
        const baseUrl = this.configService.get('APP_URL') || 'http://localhost:3010';
        const authUrl = `${baseUrl}/api/v1/business/google-claim-simulator?placeId=${encodeURIComponent(
          placeId,
        )}&returnUrl=${encodeURIComponent(returnUrl)}`;
        return { authUrl };
      }
      throw new ServiceUnavailableException('Google Sign-In is not configured');
    }

    // state is HMAC-signed and short-lived so it cannot be forged or replayed
    const state = this.googleOAuth.signState({ type: 'claim', placeId, returnUrl });
    const authUrl = this.googleOAuth.getAuthUrl(state, {
      scopes: 'https://www.googleapis.com/auth/business.manage openid email profile',
      accessType: 'offline',
      prompt: 'consent',
    });

    return { authUrl };
  }

  // ─── Google OAuth Callback Handler ─────────────────────
  async handleGoogleCallback(code: string, state: string, res?: any) {
    const payload = this.googleOAuth.verifyState(state);
    if (!payload) {
      return this.claimFailureScript();
    }

    const redirectUri = this.googleOAuth.getRedirectUri();
    let email = '';
    let googleProfile: { email: string; firstName?: string; lastName?: string; picture?: string } | null = null;

    if (payload.type === 'sim-login') {
      // Development-only path — never reachable in production
      if (!this.googleOAuth.isSimulatorEnabled() || code !== 'mock-google-code') {
        return this.claimFailureScript();
      }
      email = String(payload.email || '').toLowerCase().trim();
      if (!email) {
        return this.claimFailureScript();
      }
      googleProfile = {
        email,
        firstName: payload.firstName || 'Customer',
        lastName: payload.lastName || '',
      };
    } else {
      if (code === 'mock-google-code') {
        return this.loginFailureScript('Google login is not available');
      }
      try {
        const profile = await this.googleOAuth.exchangeCodeForProfile(code, redirectUri);
        if (!profile?.email) {
          throw new Error('Google profile did not return an email');
        }
        email = profile.email;
        googleProfile = profile;
      } catch (err: any) {
        this.logger.error('Error in Google OAuth exchange:', err?.response?.data || err.message);
        const targetOrigin = this.getTargetOrigin(payload?.returnUrl);
        return payload.type === 'claim'
          ? this.claimFailureScript(targetOrigin)
          : this.loginFailureScript('Google authentication failed', targetOrigin);
      }
    }

    const targetOrigin = this.getTargetOrigin(payload?.returnUrl);

    if (payload.type === 'login' || payload.type === 'sim-login' || payload.type === 'register') {
      let user = await this.prisma.user.findUnique({
        where: { email },
        include: { businessProfile: true, customerProfile: true },
      });

      let isNewUser = false;
      if (!user) {
        const isCustomerRegister =
          payload.role?.toUpperCase() === 'CUSTOMER' ||
          payload.mode === 'register' ||
          payload.type === 'register';

        if (isCustomerRegister) {
          const firstName = googleProfile?.firstName || payload.firstName || email.split('@')[0];
          const lastName = googleProfile?.lastName || payload.lastName || '';
          const randomPassword = crypto.randomBytes(16).toString('hex');
          await this.authService.registerCustomer({
            email,
            firstName,
            lastName,
            password: randomPassword,
            confirmPassword: randomPassword,
            referredByCode: payload.ref,
          });

          user = await this.prisma.user.findUnique({
            where: { email },
            include: { businessProfile: true, customerProfile: true },
          });
          isNewUser = true;
        } else {
          // Unknown Google email → no auto-provision for default business login.
          // The frontend shows the "No account found" modal with prefilled email.
          return this.loginFailureScript(
            'No account found for this email. Please register first.',
            targetOrigin,
            { code: 'NO_ACCOUNT', email },
          );
        }
      }

      const auth = await this.authService.login(user);

      if (res) {
        res.cookie('mcom_session', auth.accessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }

      const safeAuth = JSON.stringify(auth).replace(/</g, '\\u003c');
      const safeUser = JSON.stringify(auth.user).replace(/</g, '\\u003c');
      const safeTarget = JSON.stringify(targetOrigin);
      const dashboardUrl = JSON.stringify(`${targetOrigin}/dashboard`);

      // Full HTML doc (a bare <script> leaves document.body null) with a
      // hasOpener check: cross-origin navigation via Google can drop
      // window.opener, in which case postMessage is impossible and the popup
      // must navigate itself (cookie was already set above, so /dashboard
      // resolves authenticated) instead of stranding on FRONTEND_URL root.
      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Signing you in…</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafafa; color: #111827; }
            .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center; max-width: 90%; width: 400px; border: 1px solid #f3f4f6; }
            .btn { display: inline-block; margin-top: 1.25rem; padding: 0.75rem 1.5rem; background: #1d4ed8; color: white; border-radius: 0.75rem; text-decoration: none; font-weight: 600; font-size: 0.95rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 700;">Login complete</h2>
            <p style="margin: 0; color: #6b7280; font-size: 0.9rem;">Returning you to MCOM Solutions…</p>
            <a id="continueBtn" href=${dashboardUrl} class="btn" style="display:none;">Continue</a>
          </div>
          <script>
            (function () {
              var msg = {
                type: 'GOOGLE_LOGIN_SUCCESS',
                auth: ${safeAuth},
                user: ${safeUser},
                isNewUser: ${isNewUser ? 'true' : 'false'}
              };
              var target = ${safeTarget};
              var alt = target.indexOf('www.') !== -1
                ? target.replace('www.', '')
                : target.replace('://', '://www.');
              var hasOpener = false;
              try {
                if (window.opener && !window.opener.closed) {
                  hasOpener = true;
                  var delivered = false;
                  try { window.opener.postMessage(msg, target); delivered = true; } catch (e) {}
                  if (!delivered && target.indexOf('centralhubsolution.com') !== -1) {
                    try { window.opener.postMessage(msg, alt); delivered = true; } catch (e2) {}
                  }
                  try { window.close(); } catch (e3) {}
                }
              } catch (e) { hasOpener = false; }
              if (!hasOpener) {
                var btn = document.getElementById('continueBtn');
                if (btn) btn.style.display = 'inline-block';
                window.location.replace(${dashboardUrl});
              } else {
                setTimeout(function () {
                  if (!window.closed) {
                    var btn = document.getElementById('continueBtn');
                    if (btn) btn.style.display = 'inline-block';
                  }
                }, 800);
              }
            })();
          </script>
        </body>
        </html>
      `;
    }

    if (payload.type === 'claim') {
      const { placeId, returnUrl } = payload;
      if (!placeId || !/^[a-zA-Z0-9_\-]+$/.test(placeId) || !returnUrl || !/^https?:\/\//.test(returnUrl)) {
        return this.claimFailureScript(targetOrigin, returnUrl);
      }

      // Bind the verified email to a short-lived grant the onboarding endpoint
      // will require — the frontend can never fabricate this server-side proof.
      const grant = this.googleOAuth.signEmailGrant(email, placeId);

      let mobileRedirectUrl = '';
      try {
        const u = new URL(returnUrl);
        u.searchParams.set('claim', 'success');
        u.searchParams.set('placeId', placeId);
        u.searchParams.set('email', email);
        u.searchParams.set('grant', grant);
        mobileRedirectUrl = u.toString();
      } catch {
        const sep = returnUrl.includes('?') ? '&' : '?';
        mobileRedirectUrl = `${returnUrl}${sep}claim=success&placeId=${encodeURIComponent(placeId)}&email=${encodeURIComponent(email)}&grant=${encodeURIComponent(grant)}`;
      }

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Google Verification</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafafa; color: #111827; }
            .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center; max-width: 90%; width: 400px; border: 1px solid #f3f4f6; }
            .btn { display: inline-block; margin-top: 1.25rem; padding: 0.75rem 1.5rem; background: #ea580c; color: white; border-radius: 0.75rem; text-decoration: none; font-weight: 600; font-size: 0.95rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 700;">Claim Verified!</h2>
            <p style="margin: 0; color: #6b7280; font-size: 0.9rem;">Returning you to your business setup...</p>
            <a id="redirectBtn" href="${this.escapeHtml(mobileRedirectUrl)}" class="btn" style="display:none;">Continue</a>
          </div>
          <script>
            var hasOpener = false;
            try {
              if (window.opener && !window.opener.closed) {
                hasOpener = true;
                window.opener.postMessage({
                  type: 'GOOGLE_CLAIM_RESULT',
                  success: true,
                  placeId: ${JSON.stringify(placeId)},
                  email: ${JSON.stringify(email)},
                  grant: ${JSON.stringify(grant)}
                }, '${targetOrigin}');
                window.close();
              }
            } catch(e) {
              hasOpener = false;
            }
            if (!hasOpener) {
              var targetUrl = ${JSON.stringify(mobileRedirectUrl)};
              var btn = document.getElementById('redirectBtn');
              if (btn) btn.style.display = 'inline-block';
              window.location.replace(targetUrl);
            }
          </script>
        </body>
        </html>
      `;
    }

    return this.claimFailureScript(targetOrigin, payload?.returnUrl);
  }

  private getTargetOrigin(returnUrl?: string): string {
    if (returnUrl) {
      try {
        return new URL(returnUrl).origin;
      } catch {
        // Fall back to configured frontend URL
      }
    }
    return this.configService.get<string>('FRONTEND_URL') || 'https://mcomsolutions.com';
  }

  private claimFailureScript(targetOrigin = 'https://mcomsolutions.com', returnUrl?: string) {
    let mobileRedirectUrl = '';
    if (returnUrl) {
      try {
        const u = new URL(returnUrl);
        u.searchParams.set('claim', 'failed');
        mobileRedirectUrl = u.toString();
      } catch {
        const sep = returnUrl.includes('?') ? '&' : '?';
        mobileRedirectUrl = `${returnUrl}${sep}claim=failed`;
      }
    } else {
      mobileRedirectUrl = `${targetOrigin}/getstarted/business?claim=failed`;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Google Verification</title>
      </head>
      <body>
        <script>
          var hasOpener = false;
          try {
            if (window.opener && !window.opener.closed) {
              hasOpener = true;
              window.opener.postMessage({ type: 'GOOGLE_CLAIM_RESULT', success: false }, '${targetOrigin}');
              window.close();
            }
          } catch(e) {
            hasOpener = false;
          }
          if (!hasOpener) {
            window.location.replace(${JSON.stringify(mobileRedirectUrl)});
          }
        </script>
      </body>
      </html>
    `;
  }

  private loginFailureScript(
    error: string,
    targetOrigin = 'https://mcomsolutions.com',
    extra?: { code?: string; email?: string },
  ) {
    const safeError = JSON.stringify(error);
    const safeTarget = JSON.stringify(targetOrigin);
    const safeCode = JSON.stringify(extra?.code || null);
    const safeEmail = JSON.stringify(extra?.email || null);
    let fallbackUrl: string;
    try {
      const u = new URL(`${targetOrigin}/login`);
      u.searchParams.set('googleError', error);
      if (extra?.code) u.searchParams.set('googleCode', extra.code);
      if (extra?.email) u.searchParams.set('googleEmail', extra.email);
      fallbackUrl = u.toString();
    } catch {
      fallbackUrl = `${targetOrigin}/login?googleError=${encodeURIComponent(error)}`;
    }
    const safeFallback = JSON.stringify(fallbackUrl);
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Google sign-in failed</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #fafafa; color: #111827; }
          .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); text-align: center; max-width: 90%; width: 400px; border: 1px solid #f3f4f6; }
          .btn { display: inline-block; margin-top: 1.25rem; padding: 0.75rem 1.5rem; background: #1d4ed8; color: white; border-radius: 0.75rem; text-decoration: none; font-weight: 600; font-size: 0.95rem; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2 style="margin: 0 0 0.5rem 0; font-size: 1.25rem; font-weight: 700;">Sign-in failed</h2>
          <p style="margin: 0; color: #6b7280; font-size: 0.9rem;">${this.escapeHtml(error)}</p>
          <a id="retryBtn" href=${safeFallback} class="btn" style="display:none;">Back to login</a>
        </div>
        <script>
          (function () {
            var msg = { type: 'GOOGLE_LOGIN_FAILURE', success: false, error: ${safeError}, code: ${safeCode}, email: ${safeEmail} };
            var target = ${safeTarget};
            var alt = target.indexOf('www.') !== -1
              ? target.replace('www.', '')
              : target.replace('://', '://www.');
            var hasOpener = false;
            try {
              if (window.opener && !window.opener.closed) {
                hasOpener = true;
                try { window.opener.postMessage(msg, target); } catch (e) {}
                if (target.indexOf('centralhubsolution.com') !== -1) {
                  try { window.opener.postMessage(msg, alt); } catch (e2) {}
                }
                try { window.close(); } catch (e3) {}
              }
            } catch (e) { hasOpener = false; }
            if (!hasOpener) {
              var btn = document.getElementById('retryBtn');
              if (btn) btn.style.display = 'inline-block';
              window.location.replace(${safeFallback});
            } else {
              setTimeout(function () {
                if (!window.closed) {
                  var btn = document.getElementById('retryBtn');
                  if (btn) btn.style.display = 'inline-block';
                }
              }, 800);
            }
          })();
        </script>
      </body>
      </html>
    `;
  }

  private escapeHtml(value: string): string {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Google Category Mapping ──────────────────────────
  async mapGoogleCategory(googleCategoryId: string) {
    const googleType = String(googleCategoryId || '').replace(/^gcid:/, '');

    if (googleType) {
      const mapping = await this.prisma.googleCategoryMapping.findUnique({
        where: { googleType },
        include: { category: { include: { sector: true, subCategories: true } } },
      });
      if (mapping) {
        const cat = mapping.category;
        return {
          sectorId: cat.sectorId,
          sectorName: cat.sector?.name ?? null,
          categoryId: cat.id,
          categoryName: cat.name,
          subCategoryId: cat.subCategories[0]?.id ?? null,
        };
      }
    }

    // Fallback to a generic "Other" category when no Google-type mapping exists.
    const fallback = await this.prisma.category.findFirst({
      where: { slug: 'other' },
      include: { sector: true, subCategories: true },
    });

    return {
      sectorId: fallback?.sectorId ?? null,
      sectorName: fallback?.sector?.name ?? null,
      categoryId: fallback?.id ?? null,
      categoryName: fallback?.name ?? null,
      subCategoryId: fallback?.subCategories[0]?.id ?? null,
    };
  }

  // ─── Complete Onboarding (Google Claim) ───────────────
  /**
   * Default membership for brand-new businesses is derived from the lowest-priced
   * active plan in the DB — never a hardcoded literal.
   */
  private async getDefaultMembership(): Promise<{
    membershipLevel: MembershipLevel;
    membershipTier: MembershipTier;
  }> {
    const defaultPlan = await this.prisma.membershipPlan.findFirst({
      orderBy: { price: 'asc' },
    });
    const level: MembershipLevel = (defaultPlan?.name as MembershipLevel) || MembershipLevel.Bronze;
    return {
      membershipLevel: level,
      membershipTier: MembershipTier.Free,
    };
  }

  async completeGoogleOnboarding(data: CompleteOnboardingInput) {
    const emailFromBody = data.email ? data.email.toLowerCase().trim() : '';
    // The verified email always comes from the signed grant (if present) — the
    // body field is never trusted when a grant exists.
    const grant = this.googleOAuth.verifyEmailGrant(data.grant);
    const email = grant ? grant.email : emailFromBody;
    const defaultMembership = await this.getDefaultMembership();

    // A tracked affiliate invitation links this registration to the affiliate
    // who introduced the business. It is resolved before any account is
    // created so an invalid/cancelled link never half-completes a signup.
    const affiliateInvitation = data.affiliateInvite
      ? await this.businessAcquisition.resolveInvitationForRegistration(data.affiliateInvite)
      : null;

    // A valid UK postcode is mandatory even when the business arrives through
    // the Google claim flow. Prevents location-less business records.
    const submittedPostcode = (data.postcode || '').trim();
    if (!submittedPostcode) {
      throw new BadRequestException('A UK postcode is required to complete business onboarding.');
    }
    const resolvedPostcode = await this.locationAssignment.resolvePostcode(submittedPostcode);

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      // Existing accounts may only be claimed/updated when the caller holds a
      // fresh Google-verified grant for that email. Without it, an unauthenticated
      // caller could overwrite a profile and take over the session.
      if (!grant || grant.email !== email) {
        throw new ConflictException('An account with this email already exists. Please log in.');
      }
      if (data.googlePlaceId && grant.placeId && data.googlePlaceId !== grant.placeId) {
        throw new UnauthorizedException('Google verification does not match this business listing.');
      }

      // If user exists, update their profile
      const updatedUser = await this.prisma.user.update({
        where: { email },
        data: {
          firstName: data.firstName || undefined,
          lastName: data.lastName || undefined,
          businessProfile: {
            upsert: {
              create: {
                businessName: data.businessName,
                businessType: data.businessType || 'retail',
                country: 'United Kingdom',
                phone: data.businessPhone || '',
                email: email,
                isOnGoogle: true,
                googlePlaceId: data.googlePlaceId,
                address: data.address || '',
                postcode: resolvedPostcode.postcode,
                industry: data.industry || 'Food & Beverage',
                category: data.category || 'Cafe',
                subCategory: data.subCategory || '',
                openingHours: data.openingHours || '',
                membershipLevel: defaultMembership.membershipLevel,
                membershipTier: defaultMembership.membershipTier,
              },
              update: {
                businessName: data.businessName,
                phone: data.businessPhone || '',
                email: email,
                isOnGoogle: true,
                googlePlaceId: data.googlePlaceId,
                address: data.address || '',
                postcode: resolvedPostcode.postcode,
                openingHours: data.openingHours || '',
                industry: data.industry || undefined,
                category: data.category || undefined,
                subCategory: data.subCategory || undefined,
              },
            },
          },
        },
        include: { businessProfile: true },
      });
      if (updatedUser.businessProfile) {
        await this.assignBusinessLocation(updatedUser.businessProfile.id, {
          postcode: resolvedPostcode.postcode,
          resolvedPostcode,
          sectorId: data.sectorId as string | undefined,
          categoryId: data.categoryId as string | undefined,
          subCategoryId: data.subCategoryId as string | undefined,
          industry: data.industry,
          category: data.category,
          subCategory: data.subCategory,
        });
        await this.ensureBusinessProgramme(
          updatedUser.businessProfile.id,
          updatedUser.businessProfile.businessName,
          updatedUser.businessProfile.category,
        );
        if (affiliateInvitation) {
          await this.applyInvitationIfUnattributed(affiliateInvitation.id, {
            businessId: updatedUser.businessProfile.id,
            userId: updatedUser.id,
            email,
            alreadyAttributed: Boolean(
              updatedUser.businessProfile.acquiredByAffiliateId ||
                updatedUser.businessProfile.acquiredByAffiliateExternalId,
            ),
          });
          await this.promoteAcquisitionOnboarding(updatedUser.businessProfile.id);
        }
      }
      const loginRes = await this.authService.login(updatedUser);
      return {
        ...loginRes,
        listing: updatedUser.businessProfile,
      };
    }

    // New account creation. A Google claim path must carry the verified grant;
    // the manual path (no grant) is allowed but must not impersonate a claimed
    // Google business (no googlePlaceId).
    if (!grant && data.googlePlaceId) {
      throw new UnauthorizedException('Google verification is required to claim this business.');
    }

    // Register new user & profile
    const salt = await bcrypt.genSalt(12);
    const password = data.password || crypto.randomBytes(24).toString('hex');
    const passwordHash = await bcrypt.hash(password, salt);

    // Every non-admin account owns a referral code. Generate it before the
    // create so older clients and Google-claim flows are covered too.
    const referralCode = await generateUniqueReferralCode(this.prisma);

    const newUser = await this.prisma.user.create({
      data: {
        email: email,
        password: passwordHash,
        role: Role.BUSINESS,
        referralCode,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        registrationSource: affiliateInvitation ? '247gbs-affiliate' : data.source || 'direct',
        referredById: affiliateInvitation?.affiliateUserId ?? undefined,
        businessProfile: {
          create: {
            businessName: data.businessName,
            businessType: data.businessType || 'retail',
            country: 'United Kingdom',
            phone: data.businessPhone || '',
            email: email,
            isOnGoogle: true,
            googlePlaceId: data.googlePlaceId,
            address: data.address || '',
            postcode: resolvedPostcode.postcode,
            industry: data.industry || 'Food & Beverage',
            category: data.category || 'Cafe',
            subCategory: data.subCategory || '',
            openingHours: data.openingHours || '',
            membershipLevel: defaultMembership.membershipLevel,
            membershipTier: defaultMembership.membershipTier,
          },
        },
        wallet: {
          create: { balance: 0, currency: 'MCOM', status: 'ACTIVE' },
        },
      },
      include: { businessProfile: true },
    });

    const loginRes = await this.authService.login(newUser);

    if (newUser.id) {
      this.emitTaskEvent(newUser.id, 'BUSINESS', 'business.profile_completed');
      this.emitTaskEvent(newUser.id, 'BUSINESS', 'business.google_verified');
    }

    if (newUser.businessProfile) {
      await this.assignBusinessLocation(newUser.businessProfile.id, {
        postcode: resolvedPostcode.postcode,
        resolvedPostcode,
        sectorId: data.sectorId as string | undefined,
        categoryId: data.categoryId as string | undefined,
        subCategoryId: data.subCategoryId as string | undefined,
        industry: data.industry,
        category: data.category,
        subCategory: data.subCategory,
      });
      await this.ensureBusinessProgramme(
        newUser.businessProfile.id,
        newUser.businessProfile.businessName,
        newUser.businessProfile.category,
      );
      if (affiliateInvitation) {
        await this.applyInvitationIfUnattributed(affiliateInvitation.id, {
          businessId: newUser.businessProfile.id,
          userId: newUser.id,
          email,
          alreadyAttributed: false,
        });
        await this.promoteAcquisitionOnboarding(newUser.businessProfile.id);
      }
      await this.prisma.notification.createMany({
        data: [
          {
            businessId: newUser.businessProfile.id,
            type: 'membership',
            title: 'Welcome to MCOM Ecosystem!',
            message: `You have signed up successfully. Your ${defaultMembership.membershipLevel} Membership is now active.`,
            read: false,
          },
        ],
      });
    }

    return {
      ...loginRes,
      listing: newUser.businessProfile,
    };
  }

  // ─── Profile CRUD ─────────────────────────────────────
  async getProfile(businessId: string) {
    const profile = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      // Never `include: { user: true }` — that leaks the password hash.
      select: businessDetailSelect,
    });
    if (!profile) {
      throw new NotFoundException('Business profile not found');
    }
    return profile;
  }

  async updateProfile(businessId: string, updates: UpdateProfileInput) {
    // Refuse to modify soft-deleted profiles (prevents resurrect-by-update).
    const existing = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Business profile not found');
    }
    const address = updates.location?.addressLine1 || updates.address;
    const rawPostcode = updates.location?.postcode ?? updates.postcode;
    // UK-only postcode validation. Clearing the field is allowed; anything
    // non-empty must resolve to a real UK postcode before it is persisted.
    let postcode: string | null | undefined;
    let resolvedPostcode: ResolvedPostcode | undefined;
    if (typeof rawPostcode === 'string') {
      const trimmed = rawPostcode.trim().toUpperCase();
      if (trimmed.length > 0) {
        if (!/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/.test(trimmed)) {
          throw new BadRequestException('Please enter a valid UK postcode (e.g. SW1A 1AA).');
        }
        try {
          resolvedPostcode = await this.locationAssignment.resolvePostcode(trimmed);
          postcode = resolvedPostcode.postcode;
        } catch (err) {
          // A malformed/nonexistent postcode must be rejected; a geocoder
          // outage should not block saving a format-valid UK postcode.
          if (err instanceof BadRequestException) throw err;
          this.logger.warn(
            `Postcode geocoding unavailable for ${trimmed}: ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          postcode = trimmed;
        }
      } else {
        postcode = null;
      }
    } else {
      postcode = rawPostcode;
    }
    const phone = updates.businessPhone || updates.phone;
    const description = updates.shortDescription || updates.description;
    const industry = updates.sectorId || updates.industry;
    const subCategory = updates.subCategoryId || updates.subCategory;
    const category = updates.categoryId || updates.category;

    // Serialize businessHours array if present
    let openingHours = updates.openingHours;
    if (updates.businessHours && Array.isArray(updates.businessHours)) {
      openingHours = updates.businessHours
        .map((h: BusinessHoursItem) => {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const day = dayNames[h.dayOfWeek] || `Day ${h.dayOfWeek}`;
          return `${day}: ${h.openTime} - ${h.closeTime}${h.is24h ? ' (24h)' : ''}`;
        })
        .join(', ');
    }

    const businessType = Array.isArray(updates.listingType)
      ? (updates.listingType.includes('product') && updates.listingType.includes('service') ? 'both' : (updates.listingType.includes('product') ? 'products' : 'services'))
      : (updates.businessType || undefined);

    const updated = await this.prisma.businessProfile.update({
      where: { id: businessId },
      data: {
        businessName: updates.businessName,
        phone,
        address,
        postcode,
        website: updates.website,
        logoUrl: updates.logoUrl,
        openingHours,
        socialMedia: updates.socialMedia,
        description,
        category,
        subCategory,
        industry,
        businessType,
      },
    });

    if (postcode) {
      await this.assignBusinessLocation(businessId, {
        postcode,
        resolvedPostcode,
        sectorId: updates.sectorId,
        categoryId: updates.categoryId,
        subCategoryId: updates.subCategoryId,
        industry,
        category,
        subCategory,
      });
    }

    if (updated?.userId) {
      if (updates.logoUrl && updates.logoUrl.trim().length > 0) {
        this.emitTaskEvent(updated.userId, 'BUSINESS', 'business.logo_uploaded');
      }
      if (updates.socialMedia && updates.socialMedia.trim().length > 0) {
        this.emitTaskEvent(updated.userId, 'BUSINESS', 'business.social_linked');
      }
      if (openingHours && openingHours.trim().length > 0) {
        this.emitTaskEvent(updated.userId, 'BUSINESS', 'business.opening_hours_set');
      }
      if (updated.businessName && updated.phone && (updated.address || updated.postcode)) {
        this.emitTaskEvent(updated.userId, 'BUSINESS', 'business.profile_completed');
      }
      if (updated.isOnGoogle || updated.googlePlaceId) {
        this.emitTaskEvent(updated.userId, 'BUSINESS', 'business.google_verified');
      }
    }

    // A profile edit can be the step that completes onboarding for a business
    // an affiliate introduced. Promotion is idempotent.
    void this.promoteAcquisitionOnboarding(businessId);

    return updated;
  }

  /**
   * Apply an invitation only when the business has no existing acquisition
   * source. A later affiliate must never overwrite an earlier introduction.
   */
  private async applyInvitationIfUnattributed(
    invitationId: string,
    input: {
      businessId: string;
      userId: string;
      email: string;
      alreadyAttributed: boolean;
    },
  ) {
    if (input.alreadyAttributed) {
      this.logger.warn(
        `Ignoring affiliate invitation ${invitationId}: business ${input.businessId} already has an acquisition source.`,
      );
      return;
    }
    try {
      await this.businessAcquisition.applyInvitationToBusiness(invitationId, {
        businessId: input.businessId,
        userId: input.userId,
        email: input.email,
      });
    } catch (error) {
      // The account itself has been created; never fail a successful signup
      // because attribution could not be written. Central retains enough
      // information to reconcile (invitation token + business email).
      this.logger.error(
        `Could not apply affiliate invitation ${invitationId} to business ${input.businessId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async promoteAcquisitionOnboarding(businessId: string) {
    try {
      await this.businessAcquisition.markOnboardingCompleted(businessId);
    } catch (error) {
      this.logger.warn(
        `Could not promote acquisition onboarding for business ${businessId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Postcode-driven hierarchy assignment shared by profile edits and the
   * Google claim onboarding path. Failures are logged (the profile save has
   * already committed) so a transient upstream outage never blocks the user.
   */
  private async assignBusinessLocation(
    businessId: string,
    input: {
      postcode?: string;
      sectorId?: string;
      categoryId?: string;
      subCategoryId?: string;
      industry?: string;
      category?: string;
      subCategory?: string;
      resolvedPostcode?: ResolvedPostcode;
    },
  ): Promise<void> {
    if (!input.postcode?.trim()) return;
    try {
      await this.locationAssignment.assignBusiness(businessId, input);
    } catch (error) {
      this.logger.error(
        `Business ${businessId} could not be auto-assigned to a location: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async generateApiKey(businessId: string) {    const existing = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('Business profile not found');
    }
    const apiKey = `mcom_central_${crypto.randomBytes(24).toString('hex')}`;
    return this.prisma.businessProfile.update({
      where: { id: businessId },
      data: { apiKey },
      select: { apiKey: true },
    });
  }

  // ─── Directory & Administration CRUD ──────────────────
  // Phase 1B: ownership-scoped reads, PII-minimized list for non-admins,
  // soft-delete instead of the user-cascade hard delete.
  async findAll(searchQuery?: string, page: number = 1, limit: number = 20, caller?: BusinessCaller) {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(100, Math.max(1, Number(limit) || 20));
    const skip = (pageNum - 1) * limitNum;

    const isAdmin = caller?.role === Role.ADMIN;
    const where = {
      deletedAt: null,
      ...(searchQuery
        ? {
            OR: [
              { businessName: { contains: searchQuery, mode: 'insensitive' as const } },
              // Email search is an admin-only capability — it leaks contact PII.
              ...(isAdmin
                ? [{ email: { contains: searchQuery, mode: 'insensitive' as const } }]
                : []),
            ],
          }
        : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.businessProfile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limitNum,
        // Non-admin callers get the PII-free directory projection; admins keep full rows.
        ...(isAdmin ? {} : { select: businessDirectorySelect }),
      }),
      this.prisma.businessProfile.count({ where }),
    ]);

    return {
      success: true,
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async findOne(id: string, caller?: BusinessCaller) {
    const profile = await this.prisma.businessProfile.findFirst({
      where: { id, deletedAt: null },
      select: businessDetailSelect,
    });
    if (!profile) {
      throw new NotFoundException('Business profile not found');
    }
    const isOwner =
      !!caller && (caller.businessId === id || profile.userId === caller.userId);
    if (!isOwner && caller?.role !== Role.ADMIN) {
      throw new ForbiddenException('You do not have access to this business profile');
    }
    return profile;
  }

  async deleteBusiness(id: string, caller?: BusinessCaller) {
    const profile = await this.prisma.businessProfile.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, userId: true },
    });
    if (!profile) {
      throw new NotFoundException('Business profile not found');
    }
    const isOwner =
      !!caller && (caller.businessId === id || profile.userId === caller.userId);
    if (!isOwner && caller?.role !== Role.ADMIN) {
      throw new ForbiddenException('You do not have access to this business profile');
    }
    // Soft-delete the profile. The linked User row is never cascade-deleted here —
    // hard user removal (with audit) is an explicit admin console operation.
    await this.prisma.businessProfile.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async getSupportTickets(businessId: string) {
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
    });
    if (!business) {
      throw new NotFoundException('Business profile not found');
    }
    // Phase 4: FK-scoped lookup. Legacy name-matched rows (business_id NULL)
    // stay visible until the backfill + NOT NULL follow-up completes.
    return this.prisma.supportTicket.findMany({
      where: {
        OR: [
          { businessId },
          { businessId: null, fromName: business.businessName },
          { businessId: null, fromName: businessId },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSupportTicket(
    businessId: string,
    data: { subject: string; message: string; priority?: string },
  ) {
    const business = await this.prisma.businessProfile.findFirst({
      where: { id: businessId, deletedAt: null },
    });
    if (!business) {
      throw new NotFoundException('Business profile not found');
    }
    return this.prisma.supportTicket.create({
      data: {
        businessId,
        subject: data.subject,
        message: data.message,
        fromName: business.businessName,
        fromType: 'Business',
        priority: data.priority || 'Medium',
        status: 'Open',
      },
    });
  }
}
