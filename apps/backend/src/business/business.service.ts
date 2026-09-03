import { Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { GoogleOAuthService } from '../auth/google-oauth.service';
import { MembershipLevel, MembershipTier, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import axios from 'axios';

@Injectable()
export class BusinessService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
    private configService: ConfigService,
    private googleOAuth: GoogleOAuthService,
  ) {}

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
      console.error('Error querying Nominatim API for postcode:', err);
      return [];
    }
  }

  // ─── Proximity Check ──────────────────────────────────
  async checkLocationProximity(postcode: string) {
    const clean = postcode.toUpperCase().replace(/\s+/g, '');
    const outward = clean.slice(0, Math.max(2, clean.length - 3)); // e.g. 'NW1', 'SE15'

    let resolvedArea = '';
    try {
      const response = await axios.get(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`);
      if (response.data?.status === 200) {
        resolvedArea = response.data.result.admin_district || '';
      }
    } catch (err) {
      console.error('Error fetching postcode info from postcodes.io:', err);
    }

    // Match against LocalMall postcode areas (DB-backed — no fabricated malls).
    const malls = await this.prisma.localMall.findMany({
      where: { status: 'Active' },
      select: { id: true, name: true, borough: true, postcodes: true },
    });
    const matchedMall = malls.find((m) =>
      (m.postcodes || []).some((p) => {
        const area = p.toUpperCase().replace(/\s+/g, '');
        return outward.startsWith(area) || area.startsWith(outward);
      }),
    );

    if (matchedMall) {
      return {
        resolvedArea: resolvedArea || matchedMall.borough || 'Local Area',
        status: 'active',
        localMallName: matchedMall.name,
        localMallId: matchedMall.id,
        proximityTier: 'high_street',
      };
    }

    return {
      resolvedArea: resolvedArea || 'Remote Area',
      status: 'inactive',
      localMallName: null,
      localMallId: null,
      proximityTier: 'national',
    };
  }

  // ─── Google Places Lookup ─────────────────────────────
  async searchGoogleBusinesses(queryText: string, radius?: number) {
    const apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Google Places API is not configured.');
    }

    try {
      const response = await axios.post(
        'https://places.googleapis.com/v1/places:searchText',
        { textQuery: queryText },
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
        const heroImg = photoName ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${apiKey}` : '';
        const thumbImg = photoName ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=200&key=${apiKey}` : '';
        const allPhotos = (place.photos || []).slice(0, 5).map((ph: any) => `https://places.googleapis.com/v1/${ph.name}/media?maxWidthPx=800&key=${apiKey}`);

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
      console.error('Error fetching from Google Places API:', err?.response?.data || err.message);
      throw new ServiceUnavailableException('Google Places API request failed.');
    }
  }

  private extractPostcode(address: string) {
    const match = address.match(/[A-Z]{1,2}[0-9][A-Z0-9]? ?[0-9][A-Z]{2}/i);
    return match ? match[0] : '';
  }

  // ─── Google Place Details ─────────────────────────────
  async getGooglePlaceDetails(placeId: string) {
    const apiKey = this.configService.get<string>('GOOGLE_PLACES_API_KEY');
    if (!apiKey) {
      throw new ServiceUnavailableException('Google Places API is not configured.');
    }

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
      const heroImg = photoName ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=800&key=${apiKey}` : '';
      const thumbImg = photoName ? `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=200&key=${apiKey}` : '';
      const allPhotos = (place.photos || []).slice(0, 5).map((ph: any) => `https://places.googleapis.com/v1/${ph.name}/media?maxWidthPx=800&key=${apiKey}`);

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
      console.error('Error fetching from Google Place Details API:', err?.response?.data || err.message);
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

    if (payload.type === 'sim-login') {
      // Development-only path — never reachable in production
      if (!this.googleOAuth.isSimulatorEnabled() || code !== 'mock-google-code') {
        return this.claimFailureScript();
      }
      email = String(payload.email || '').toLowerCase().trim();
      if (!email) {
        return this.claimFailureScript();
      }
    } else {
      if (code === 'mock-google-code') {
        return this.loginFailureScript('Google login is not available');
      }
      try {
        email = await this.googleOAuth.exchangeCodeForEmail(code, redirectUri);
      } catch (err: any) {
        console.error('Error in Google OAuth exchange:', err?.response?.data || err.message);
        return payload.type === 'claim'
          ? this.claimFailureScript()
          : this.loginFailureScript('Google authentication failed');
      }
    }

    if (payload.type === 'login' || payload.type === 'sim-login') {
      const user = await this.prisma.user.findUnique({
        where: { email },
        include: { businessProfile: true },
      });

      if (!user) {
        return this.loginFailureScript('No account found for this email. Please register first.');
      }

      const auth = await this.authService.login(user);

      if (res) {
        res.cookie('mcom_session', auth.accessToken, {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }

      return `
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'GOOGLE_LOGIN_SUCCESS',
              auth: ${JSON.stringify(auth)},
              user: ${JSON.stringify(auth.user)}
            }, '*');
            window.close();
          } else {
            document.write("Login successful! Redirecting...");
          }
        </script>
      `;
    }

    if (payload.type === 'claim') {
      const { placeId, returnUrl } = payload;
      if (!placeId || !/^[a-zA-Z0-9_\-]+$/.test(placeId) || !returnUrl || !/^https?:\/\//.test(returnUrl)) {
        return this.claimFailureScript();
      }

      // Bind the verified email to a short-lived grant the onboarding endpoint
      // will require — the frontend can never fabricate this server-side proof.
      const grant = this.googleOAuth.signEmailGrant(email, placeId);

      return `
        <script>
          if (window.opener) {
            window.opener.postMessage({
              type: 'GOOGLE_CLAIM_RESULT',
              success: true,
              placeId: '${placeId}',
              email: '${this.escapeHtml(email)}',
              grant: '${this.escapeHtml(grant)}'
            }, '*');
            window.close();
          } else {
            document.write("Claim successful! You can close this window now.");
          }
        </script>
      `;
    }

    return this.claimFailureScript();
  }

  private claimFailureScript() {
    return `
      <script>
        if (window.opener) {
          window.opener.postMessage({ type: 'GOOGLE_CLAIM_RESULT', success: false }, '*');
        }
        window.close();
      </script>
    `;
  }

  private loginFailureScript(error: string) {
    return `
      <script>
        if (window.opener) {
          window.opener.postMessage({ type: 'GOOGLE_LOGIN_FAILURE', success: false, error: '${this.escapeHtml(error)}' }, '*');
        }
        window.close();
      </script>
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

  async completeGoogleOnboarding(data: any) {
    const emailFromBody = data.email ? data.email.toLowerCase().trim() : '';
    // The verified email always comes from the signed grant (if present) — the
    // body field is never trusted when a grant exists.
    const grant = this.googleOAuth.verifyEmailGrant(data.grant);
    const email = grant ? grant.email : emailFromBody;
    const defaultMembership = await this.getDefaultMembership();

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
                postcode: data.postcode || '',
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
                postcode: data.postcode || '',
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
    const salt = await bcrypt.genSalt();
    const password = data.password || crypto.randomBytes(24).toString('hex');
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await this.prisma.user.create({
      data: {
        email: email,
        password: passwordHash,
        role: Role.BUSINESS,
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        registrationSource: data.source || 'direct',
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
            postcode: data.postcode || '',
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

    if (newUser.businessProfile) {
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
    const profile = await this.prisma.businessProfile.findUnique({
      where: { id: businessId },
      include: { user: true, packages: true },
    });
    if (!profile) {
      throw new NotFoundException('Business profile not found');
    }
    return profile;
  }

  async updateProfile(businessId: string, updates: any) {
    const address = updates.location?.addressLine1 || updates.address;
    const postcode = updates.location?.postcode || updates.postcode;
    const phone = updates.businessPhone || updates.phone;
    const description = updates.shortDescription || updates.description;
    const industry = updates.sectorId || updates.industry;
    const subCategory = updates.subCategoryId || updates.subCategory;
    const category = updates.categoryId || updates.category;

    // Serialize businessHours array if present
    let openingHours = updates.openingHours;
    if (updates.businessHours && Array.isArray(updates.businessHours)) {
      openingHours = updates.businessHours
        .map((h: any) => {
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const day = dayNames[h.dayOfWeek] || `Day ${h.dayOfWeek}`;
          return `${day}: ${h.openTime} - ${h.closeTime}${h.is24h ? ' (24h)' : ''}`;
        })
        .join(', ');
    }

    const businessType = Array.isArray(updates.listingType)
      ? (updates.listingType.includes('product') && updates.listingType.includes('service') ? 'both' : (updates.listingType.includes('product') ? 'products' : 'services'))
      : (updates.businessType || undefined);

    return this.prisma.businessProfile.update({
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
  }

  async generateApiKey(businessId: string) {
    const apiKey = `mcom_central_${crypto.randomBytes(24).toString('hex')}`;
    return this.prisma.businessProfile.update({
      where: { id: businessId },
      data: { apiKey },
      select: { apiKey: true },
    });
  }

  // ─── Directory & Administration CRUD ──────────────────
  async findAll(searchQuery?: string) {
    return this.prisma.businessProfile.findMany({
      where: searchQuery ? {
        OR: [
          { businessName: { contains: searchQuery, mode: 'insensitive' } },
          { email: { contains: searchQuery, mode: 'insensitive' } },
        ]
      } : {},
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const profile = await this.prisma.businessProfile.findUnique({
      where: { id },
      include: {
        user: true,
        packages: true,
        transactions: true,
      },
    });
    if (!profile) {
      throw new NotFoundException('Business profile not found');
    }
    return profile;
  }

  async deleteBusiness(id: string) {
    const profile = await this.prisma.businessProfile.findUnique({
      where: { id },
    });
    if (!profile) {
      throw new NotFoundException('Business profile not found');
    }
    await this.prisma.user.delete({
      where: { id: profile.userId },
    });
    return { success: true };
  }
}
