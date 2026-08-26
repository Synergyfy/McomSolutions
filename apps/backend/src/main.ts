import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import express from 'express';
import { join } from 'path';
import { SsoService } from './auth/sso.service';

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

  app.use(cookieParser());
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // ─── Dynamic CORS ──────────────────────────────────────────────────────────
  // Static + env origins are seeded at boot; DB-registered app origins are
  // merged in at boot and refreshed every 60 seconds via getAllCorsOrigins().
  const ssoService = app.get(SsoService);
  await refreshCorsOrigins(ssoService);
  setInterval(() => refreshCorsOrigins(ssoService), 60_000);

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
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'X-Mcom-Client-ID', 'ngrok-skip-browser-warning'],
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Swagger docs
  const config = new DocumentBuilder()
    .setTitle('MCOM Central API')
    .setDescription('Central Hub Identity, Subscription and Platform management')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT || 3010;
  await app.listen(port);
  console.log(`MCOM Central Backend running on: http://localhost:${port}/api/v1`);
}
bootstrap();
