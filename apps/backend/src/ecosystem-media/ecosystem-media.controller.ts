import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { ServiceAuthGuard } from '../mesh-inbound/service-auth.guard';
import { ServiceScopesGuard } from '../mesh-inbound/service-scopes.guard';
import { RequireServiceScopes } from '../mesh-inbound/require-service-scopes.decorator';
import { SERVICE_SCOPE_CENTRAL_READ } from '../mesh-inbound/service-mesh.constants';
import { contentTypeFor, resolveUploadFile } from './ecosystem-media.util';

/**
 * Authenticated media reads for ecosystem app backends.
 *
 * `/uploads` is deliberately closed to anonymous browsers (Phase 1C). A partner
 * app that needs to render a Central-hosted logo, banner or gallery image can
 * proxy the bytes through this endpoint using the same RS256 service token it
 * already mints for `central:read` — no shared JWT secret, no public exposure.
 *
 *   GET /api/v1/ecosystem/media/:filename
 *   GET /api/v1/ecosystem/media/:folder/:filename
 */
@ApiTags('Ecosystem — Media (B2B)')
@ApiBearerAuth()
@UseGuards(ServiceAuthGuard, ServiceScopesGuard)
@RequireServiceScopes(SERVICE_SCOPE_CENTRAL_READ)
@Throttle({ default: { limit: 600, ttl: 60_000 } })
@Controller('ecosystem/media')
export class EcosystemMediaController {
  @Get(':filename')
  @ApiOperation({ summary: 'Stream an uploaded media file to a mesh caller' })
  @ApiParam({ name: 'filename', example: 'b60ee38a-d6ed-419a-ab4a-3a28c8ec4209.png' })
  @ApiOkResponse({ description: 'Raw image bytes' })
  @ApiNotFoundResponse({ description: 'Media not found' })
  @ApiForbiddenResponse({ description: 'Caller may not read media' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid service token' })
  getRootFile(@Param('filename') filename: string, @Res() res: Response) {
    return this.stream(filename, res);
  }

  @Get(':folder/:filename')
  @ApiOperation({ summary: 'Stream a nested uploaded media file to a mesh caller' })
  @ApiParam({ name: 'folder', example: 'catalog' })
  @ApiParam({ name: 'filename', example: 'b60ee38a-d6ed-419a-ab4a-3a28c8ec4209.png' })
  @ApiOkResponse({ description: 'Raw image bytes' })
  @ApiNotFoundResponse({ description: 'Media not found' })
  getNestedFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    return this.stream(`${folder}/${filename}`, res);
  }

  private stream(relativePath: string, res: Response): void {
    const filePath = resolveUploadFile(relativePath);
    if (!filePath) {
      throw new NotFoundException('Media not found');
    }

    res.setHeader('Content-Type', contentTypeFor(filePath));
    // Bytes are immutable (uuid filenames); partners may cache aggressively.
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const stream = createReadStream(filePath);
    stream.on('error', () => {
      if (!res.headersSent) {
        res.status(404).json({ message: 'Media not found' });
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  }
}
