import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { SsoClient } from '@prisma/client';
import { SsoClientGuard } from '../auth/guards/sso-client.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatSessionDto } from './dto/chat.dto';
import { ChatSessionService } from './services/chat-session.service';

/**
 * Server-to-server bridge for ecosystem apps that need real-time chat on
 * behalf of a user they have already authenticated over SSO.
 *
 * This controller is deliberately separate from `ChatController` because that
 * one is guarded by `JwtAuthGuard` (browser access tokens) while the session
 * endpoint authenticates the *application* with HTTP Basic client credentials.
 */
@ApiTags('Chat & Messaging')
@Controller('chat')
export class ChatSessionController {
  constructor(private readonly chatSessionService: ChatSessionService) {}

  @UseGuards(SsoClientGuard)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Post('session')
  @ApiOperation({
    summary: 'Exchange a user SSO token for scoped chat credentials (app-to-app)',
    description:
      'Authenticate with HTTP Basic (client_id:client_secret) and send the user\'s Central SSO access token as `subject_token`. ' +
      'Returns a short-lived REST access token (kept server-side) and a single-use socket token (safe to hand to the browser).',
  })
  @ApiBody({ type: ChatSessionDto })
  @ApiCreatedResponse({ description: 'Chat session issued' })
  @ApiBadRequestResponse({ description: 'Invalid request body' })
  @ApiUnauthorizedResponse({ description: 'Invalid app credentials or SSO subject token' })
  @ApiForbiddenResponse({ description: 'No active SSO session for this user/app pair' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  issueSession(@Req() req: Request, @Body() dto: ChatSessionDto) {
    const client = (req as any).ssoClient as SsoClient;
    return this.chatSessionService.issueForClient(client, dto.subject_token);
  }

  /**
   * Lightweight reconnect path: the partner backend already holds a valid
   * `chat` access token, so it only needs a fresh single-use socket token.
   * Avoids re-running client-credential verification on every reconnect.
   */
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Post('socket-token')
  @ApiOperation({
    summary: 'Mint a fresh single-use socket token for an authenticated chat user',
    description:
      'Use the chat access token from `POST /chat/session` as a Bearer token. Returns only a short-lived socket token.',
  })
  @ApiCreatedResponse({ description: 'Socket token issued' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid chat access token' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  issueSocketToken(@Req() req: Request) {
    const user = (req as any).user;
    return this.chatSessionService.issueSocketToken({
      id: user.userId,
      email: user.email,
      role: user.role,
      tokenVersion: user.tokenVersion,
    });
  }
}
