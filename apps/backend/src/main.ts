import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import express from 'express';
import { join } from 'path';
import type { NextFunction, Request, Response } from 'express';
import { SsoService } from './auth/sso.service';
import { UploadsAuthMiddleware } from './common/middleware/uploads-auth.middleware';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

// Static origins remain the hard fallback — never removed, only added to.
const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://mcommall.vercel.app',
  'https://mcomloyalty.vercel.app',
  'https://mcom-solutions-backend.vercel.app',
  'https://centralhubsolution.com',
  'https://www.centralhubsolution.com'
];

const corsOriginSet = new Set<string>();

async function refreshCorsOrigins(ssoService: SsoService) {
  try {
    const dbOrigins = await ssoService.getAllCorsOrigins();
    const envOrigins = [
      process.env.FRONTEND_URL,
      process.env.MCOM_MALL_API_URL,
      process.env.MCOM_REWARDS_API_URL,
    ].filter((o): o is string => Boolean(o && o.trim()));

    corsOriginSet.clear();
    [...defaultOrigins, ...envOrigins, ...dbOrigins].forEach((o) => corsOriginSet.add(o));
  } catch (err: any) {
    console.warn('[CORS] Failed to refresh DB origins — falling back to static set:', err?.message);
    corsOriginSet.clear();
    [...defaultOrigins].forEach((o) => corsOriginSet.add(o));
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    rawBody: true,
  });

  // Phase 6: secure HTTP headers (first, before CORS/static).
  // Exception: the Google OAuth HTML handoffs (callback + claim simulator)
  // render server-generated inline <script> postMessage pages. No bundler and
  // no nonce channel exists for them, so a script-src CSP blocks the popup
  // handoff and strands users on a blank page (seen live 2026-10-04).
  // Additionally those responses must NOT carry Cross-Origin-Opener-Policy
  // or Origin-Agent-Cluster: either header drops window.opener when the popup
  // returns from Google, silently converting the token handoff into an
  // unauthenticated redirect (seen live 2026-10-04: popup landed on
  // {returnUrl}/dashboard signed out). All other helmet headers still apply.
  const googleHtmlRoutes = new Set([
    '/api/v1/business/google/callback',
    '/api/v1/business/google-claim-simulator',
    // Popup entry points: these navigate the popup cross-origin to Google and
    // back. Any COOP/OAC document here severs window.opener, stranding the
    // popup on FRONTEND_URL with no postMessage to the parent.
    '/api/v1/auth/google',
    '/api/v1/auth/google/simulator',
  ]);
  const helmetDefault = helmet();
  const helmetGoogleHtml = helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    originAgentCluster: false,
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (googleHtmlRoutes.has(req.path)) {
      return helmetGoogleHtml(req, res, next);
    }
    return helmetDefault(req, res, next);
  });
  // Phase 6: uniform error envelope for all unhandled exceptions.
  // Route-level filters (e.g. MulterExceptionFilter) still run first.
  app.useGlobalFilters(new AllExceptionsFilter());
  app.use(cookieParser());
  // Phase 1C: user uploads require a valid Bearer token and are served with
  // sandboxing headers — never open express.static.
  const uploadsGuard = new UploadsAuthMiddleware(app.get(ConfigService));
  app.use('/uploads', uploadsGuard.use.bind(uploadsGuard), express.static(join(process.cwd(), 'uploads')));

  // ─── Dynamic CORS ──────────────────────────────────────────────────────────
  // Static + env origins are seeded at boot; DB-registered app origins are
  // merged in at boot and refreshed every 60 seconds via getAllCorsOrigins().
  const ssoService = app.get(SsoService);
  await refreshCorsOrigins(ssoService);
  const corsInterval = setInterval(() => refreshCorsOrigins(ssoService), 60_000);
  app.enableShutdownHooks();
  const cleanupCors = () => clearInterval(corsInterval);
  process.once('SIGTERM', cleanupCors);
  process.once('SIGINT', cleanupCors);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || corsOriginSet.has(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-Mcom-Client-ID', 'X-Mcom-Signature', 'X-Idempotency-Key', 'ngrok-skip-browser-warning'],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation pipe (dto-validation.md: whitelist + forbid unknown +
  // explicit @Type() conversions only — no implicit coercion).
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: false,
      },
      exceptionFactory: (errors) => {
        const messages = errors.flatMap((e) =>
          e.constraints ? Object.values(e.constraints) : [e.toString()],
        );
        return new BadRequestException(messages);
      },
    }),
  );

  // Swagger docs (swagger-docs.md: served at api/docs).
  const config = new DocumentBuilder()
    .setTitle('MCOM Central API')
    .setDescription('Central Hub Identity, Subscription and Platform management')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3010;
  await app.listen(port);
  console.log(`MCOM Central Backend running on: http://localhost:${port}/api/v1`);
}
bootstrap();
