import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import axios from 'axios';

@Injectable()
export class BusinessService {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
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
      // Fallback — must include postcode so the proximity check can run
      return [
        { id: 'addr-fallback-1', displayName: `12 Camden High Street, London, ${cleanPostcode}`, formattedAddress: `12 Camden High Street, London, ${cleanPostcode}`, postcode: cleanPostcode },
      ];
    }
  }

  // ─── Proximity Check ──────────────────────────────────
  async checkLocationProximity(postcode: string) {
    const clean = postcode.toUpperCase().replace(/\s+/g, '');
    try {
      const response = await axios.get(`https://api.postcodes.io/postcodes/${encodeURIComponent(clean)}`);
      if (response.data?.status === 200) {
        const result = response.data.result;
        const district = result.admin_district || '';
        const isCamden = district.toLowerCase().includes('camden');

        if (isCamden) {
          return {
            resolvedArea: district,
            status: 'active',
            localMallName: 'Camden High Street Mall',
            localMallId: 'mall-camden',
            proximityTier: 'high_street',
          };
        } else {
          return {
            resolvedArea: district || 'Remote Area',
            status: 'inactive',
            localMallName: null,
            localMallId: null,
            proximityTier: 'national',
          };
        }
      }
    } catch (err) {
      console.error('Error fetching postcode info from postcodes.io:', err);
    }
    
    // Fallback if postcodes.io fails
    const isHighStreet = /^(NW1|EC1|W1|N1|N7|NW5|WC1|WC2|EC2)/i.test(clean);
    return {
      resolvedArea: isHighStreet ? 'Camden Borough' : 'Remote Area',
      status: isHighStreet ? 'active' : 'inactive',
      localMallName: isHighStreet ? 'Camden High Street Mall' : null,
      localMallId: isHighStreet ? 'mall-camden' : null,
      proximityTier: isHighStreet ? 'high_street' : 'national',
    };
  }

  // ─── Google Places Lookup ─────────────────────────────
  async searchGoogleBusinesses(queryText: string, radius?: number) {
    // Return mock search results matching query
    const allMocks = [
      {
        googlePlaceId: 'mock-place-001',
        name: 'The Coffee Lounge',
        formattedAddress: '14 Camden High Street, London, NW1 0JH',
        postcode: 'NW1 0JH',
        businessPhone: '020 7946 0001',
        rating: 4.5,
        userRatingsTotal: 312,
        types: ['coffee_shop', 'establishment'],
        googleCategoryId: 'gcid:coffee_shop',
      },
      {
        googlePlaceId: 'mock-place-002',
        name: 'Artisan Bakehouse',
        formattedAddress: '8 Chalk Farm Road, London, NW1 8AG',
        postcode: 'NW1 8AG',
        businessPhone: '020 7946 0022',
        rating: 4.8,
        userRatingsTotal: 189,
        types: ['bakery', 'establishment'],
        googleCategoryId: 'gcid:bakery',
      },
      {
        googlePlaceId: 'mock-place-003',
        name: 'Urban Style Boutique',
        formattedAddress: '52 Parkway, Camden, London, NW1 7AH',
        postcode: 'NW1 7AH',
        businessPhone: '020 7946 0033',
        rating: 4.3,
        userRatingsTotal: 97,
        types: ['clothing_store', 'establishment'],
        googleCategoryId: 'gcid:clothing_store',
      },
    ];

    if (!queryText) return allMocks;

    return allMocks.filter(
      (m) =>
        m.name.toLowerCase().includes(queryText.toLowerCase()) ||
        m.formattedAddress.toLowerCase().includes(queryText.toLowerCase()),
    );
  }

  // ─── Google Place Details ─────────────────────────────
  async getGooglePlaceDetails(placeId: string) {
    const detailsMap: Record<string, any> = {
      'mock-place-001': {
        name: 'The Coffee Lounge',
        formattedAddress: '14 Camden High Street, London, NW1 0JH',
        postcode: 'NW1 0JH',
        internationalPhoneNumber: '+44 20 7946 0001',
        website: 'https://thecoffeelounge.co.uk',
        rating: 4.5,
        userRatingsTotal: 312,
        openingHours: { open_now: true, weekday_text: ['Monday: 7:00 AM – 8:00 PM'] },
        types: ['coffee_shop', 'establishment'],
        googleCategoryId: 'gcid:coffee_shop',
      },
      'mock-place-002': {
        name: 'Artisan Bakehouse',
        formattedAddress: '8 Chalk Farm Road, London, NW1 8AG',
        postcode: 'NW1 8AG',
        internationalPhoneNumber: '+44 20 7946 0022',
        website: 'https://artisanbakehouse.co.uk',
        rating: 4.8,
        userRatingsTotal: 189,
        openingHours: { open_now: true, weekday_text: ['Monday: 8:00 AM – 6:00 PM'] },
        types: ['bakery', 'establishment'],
        googleCategoryId: 'gcid:bakery',
      },
      'mock-place-003': {
        name: 'Urban Style Boutique',
        formattedAddress: '52 Parkway, Camden, London, NW1 7AH',
        postcode: 'NW1 7AH',
        internationalPhoneNumber: '+44 20 7946 0033',
        website: 'https://urbanstyle.co.uk',
        rating: 4.3,
        userRatingsTotal: 97,
        openingHours: { open_now: false, weekday_text: ['Monday: 10:00 AM – 7:00 PM'] },
        types: ['clothing_store', 'establishment'],
        googleCategoryId: 'gcid:clothing_store',
      },
    };

    const details = detailsMap[placeId];
    if (!details) {
      throw new NotFoundException(`Google place details for id '${placeId}' not found`);
    }
    return details;
  }

  // ─── Claim Start & Simulator Redirect ─────────────────
  async claimStart(placeId: string, returnUrl: string) {
    // Generate simulator URL
    const baseUrl = process.env.APP_URL || 'http://localhost:3010';
    const authUrl = `${baseUrl}/api/v1/business/google-claim-simulator?placeId=${placeId}&returnUrl=${encodeURIComponent(
      returnUrl,
    )}`;
    return { authUrl };
  }

  // ─── Google Category Mapping ──────────────────────────
  async mapGoogleCategory(googleCategoryId: string) {
    const categories: Record<string, any> = {
      'gcid:coffee_shop': { sectorId: 'sector-2', categoryId: 'cat-4', subCategoryId: 'sub-4' },
      'gcid:bakery': { sectorId: 'sector-2', categoryId: 'cat-4', subCategoryId: 'sub-5' },
      'gcid:clothing_store': { sectorId: 'sector-1', categoryId: 'cat-1', subCategoryId: 'sub-2' },
    };

    return categories[googleCategoryId] || { sectorId: 'sector-1', categoryId: 'cat-1', subCategoryId: 'sub-1' };
  }

  // ─── Complete Onboarding (Google Claim) ───────────────
  async completeGoogleOnboarding(data: any) {
    const email = data.email ? data.email.toLowerCase().trim() : '';
    const existing = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
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
                membershipLevel: 'Bronze',
                membershipTier: 'Free',
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
      return this.authService.login(updatedUser);
    }

    // Register new user & profile
    const salt = await bcrypt.genSalt();
    const password = data.password || 'googleAuthTempPass123!';
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
            membershipLevel: 'Bronze',
            membershipTier: 'Free',
          },
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
            message: 'You have signed up successfully. Your Bronze Membership is now active.',
            read: false,
          },
          {
            businessId: newUser.businessProfile.id,
            type: 'announcement',
            title: 'MCOM Spin templates added',
            message: 'We have preloaded 5 default spin wheel templates into your account.',
            read: false,
          },
          {
            businessId: newUser.businessProfile.id,
            type: 'payment',
            title: 'Welcome Credit Added',
            message: 'We have applied £10.00 credit to your billing profile for new activations.',
            read: false,
          }
        ]
      });
    }

    return loginRes;
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
    return this.prisma.businessProfile.update({
      where: { id: businessId },
      data: {
        businessName: updates.businessName,
        phone: updates.phone,
        address: updates.address,
        postcode: updates.postcode,
        website: updates.website,
        logoUrl: updates.logoUrl,
        openingHours: updates.openingHours,
        socialMedia: updates.socialMedia,
        description: updates.description,
        category: updates.category,
        industry: updates.industry,
      },
    });
  }

  async generateApiKey(businessId: string) {
    const apiKey = `mcom_central_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
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
