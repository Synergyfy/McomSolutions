import { Controller, Get, Post, Put, Delete, Body, Query, Param, UseGuards, Request, Response, NotFoundException, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { BusinessService } from './business.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

@Controller()
export class BusinessController {
  constructor(private businessService: BusinessService) {}

  // ─── Postcode Address Search ──────────────────────────
  @Get('business/search-address')
  async searchAddresses(@Query('postcode') postcode: string) {
    return this.businessService.searchAddresses(postcode || '');
  }

  // ─── File Uploads ─────────────────────────────────────
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(process.cwd(), 'uploads');
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const cleanExt = extname(file.originalname).replace(/[^a-zA-Z0-9.]/g, '').toLowerCase();
          cb(null, `${uniqueSuffix}${cleanExt}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'];
        if (!allowedExts.includes(ext)) {
          return cb(new BadRequestException('Only image files are allowed'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(@UploadedFile() file: any, @Request() req: any) {
    if (!file) {
      throw new NotFoundException('No file uploaded');
    }
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrl = `${protocol}://${host}/uploads/${file.filename}`;
    return { secure_url: fileUrl };
  }

  // ─── Proximity Check ──────────────────────────────────
  @Post('localmall/onboarding/check-location')
  async checkLocation(@Body('postcode') postcode: string) {
    return this.businessService.checkLocationProximity(postcode || '');
  }

  // ─── Google Places Lookup ─────────────────────────────
  @Get('google/google-business')
  async searchGoogleBusinesses(
    @Query('queryText') queryText: string,
    @Query('radius') radius?: string,
  ) {
    const rad = radius ? parseFloat(radius) : undefined;
    return this.businessService.searchGoogleBusinesses(queryText || '', rad);
  }

  @Get('google/google-business/:placeId')
  async getGooglePlaceDetails(@Param('placeId') placeId: string) {
    return this.businessService.getGooglePlaceDetails(placeId);
  }

  // ─── Claim Start ──────────────────────────────────────
  @Post('claim/start')
  async claimStart(
    @Body('placeId') placeId: string,
    @Body('returnUrl') returnUrl: string,
  ) {
    return this.businessService.claimStart(placeId, returnUrl);
  }

  // ─── Google Category Mapping ──────────────────────────
  @Get('google-business/map-category')
  async mapGoogleCategory(@Query('googleCategoryId') googleCategoryId: string) {
    return this.businessService.mapGoogleCategory(googleCategoryId || '');
  }

  // ─── Complete Google Onboarding ───────────────────────
  @Post('google-business/complete-onboarding')
  async completeGoogleOnboarding(@Body() body: any) {
    return this.businessService.completeGoogleOnboarding(body);
  }

  // ─── Google OAuth Callback ───────────────────────────
  @Get('business/google/callback')
  async handleGoogleCallback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Response() res: any,
  ) {
    const html = await this.businessService.handleGoogleCallback(code, state);
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  }

  // ─── Google OAuth Consent Simulator ──────────────────
  @Get('business/google-claim-simulator')
  getGoogleClaimSimulator(@Query('placeId') placeId: string, @Response() res: any) {
    res.setHeader('Content-Type', 'text/html');
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Google Sign In - Confirm Store Ownership</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
          body { font-family: 'Outfit', sans-serif; }
        </style>
      </head>
      <body class="bg-gray-50 flex flex-col justify-between min-h-screen p-6 text-gray-900">
        <div class="flex-1 flex flex-col justify-center items-center max-w-md mx-auto w-full">
          <div class="w-12 h-12 flex items-center justify-center bg-blue-100 text-blue-600 rounded-full mb-6">
            <svg class="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.24 10.285V13.4h6.887C18.2 15.614 15.645 18 12.24 18c-3.86 0-7-3.14-7-7s3.14-7 7-7c1.7 0 3.24.61 4.48 1.64l2.42-2.42C17.3 1.5 14.93 0 12.24 0c-6.07 0-11 4.93-11 11s4.93 11 11 11c5.83 0 11.23-4.14 11.23-11 0-.7-.08-1.37-.23-1.715h-11z"/></svg>
          </div>
          
          <h1 class="text-2xl font-bold text-center mb-2">Claim Store Ownership</h1>
          <p class="text-gray-500 text-sm text-center mb-8">Google wants to verify your ownership of the business and grant MCOM Solutions API permissions.</p>

          <div class="w-full bg-white border border-gray-200 rounded-2xl p-5 shadow-sm mb-8 text-sm">
            <div class="flex items-center justify-between font-semibold border-b border-gray-100 pb-3 mb-3">
              <span>Service Request</span>
              <span class="text-blue-600">Verification</span>
            </div>
            <div class="space-y-2 text-gray-600">
              <div class="flex justify-between"><span>Google Business ID:</span> <span class="font-mono text-xs text-gray-900">${placeId}</span></div>
              <div class="flex justify-between"><span>Ecosystem Access:</span> <span class="text-gray-900">Write Storefront Profile</span></div>
            </div>
          </div>

          <button onclick="confirmClaim()" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl transition shadow-lg shadow-blue-500/10 mb-4">
            Verify & Grant Access
          </button>
          
          <button onclick="window.close()" class="text-sm font-semibold text-gray-500 hover:text-gray-800 transition">
            Cancel
          </button>
        </div>

        <footer class="text-[10px] text-gray-400 text-center">
          Secure connection powered by Google Consent Services
        </footer>

        <script>
          function confirmClaim() {
            if (window.opener) {
              window.opener.postMessage({
                type: 'GOOGLE_CLAIM_RESULT',
                success: true
              }, '*');
              window.close();
            } else {
              alert('Claim successful! You can close this window now.');
            }
          }
        </script>
      </body>
      </html>
    `);
  }

  // ─── Profile CRUD (Secured) ───────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('business/profile')
  async getProfile(@Request() req: any) {
    if (!req.user.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.businessService.getProfile(req.user.businessId);
  }

  @UseGuards(JwtAuthGuard)
  @Put('business/profile')
  async updateProfile(@Request() req: any, @Body() updates: any) {
    if (!req.user.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.businessService.updateProfile(req.user.businessId, updates);
  }

  @UseGuards(JwtAuthGuard)
  @Post('business/api-key')
  async generateApiKey(@Request() req: any) {
    if (!req.user.businessId) {
      throw new NotFoundException('User does not have an active business profile');
    }
    return this.businessService.generateApiKey(req.user.businessId);
  }

  // ─── Directory Management (Secured) ───────────────────
  @UseGuards(JwtAuthGuard)
  @Get('business')
  async getAllBusinesses(@Query('search') search?: string) {
    return this.businessService.findAll(search);
  }

  @UseGuards(JwtAuthGuard)
  @Get('business/:id')
  async getBusinessById(@Param('id') id: string) {
    return this.businessService.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('business/:id')
  async deleteBusiness(@Param('id') id: string) {
    return this.businessService.deleteBusiness(id);
  }
}
