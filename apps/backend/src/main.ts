import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import express from 'express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));

  // Enable CORS
  const defaultOrigins = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://mcommall.vercel.app',
    'https://mcomloyalty.vercel.app',
    'https://mcom-solutions-backend.vercel.app',
  ];
  const envOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  const allowedOrigins = [...new Set([...defaultOrigins, ...envOrigins])];

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'ngrok-skip-browser-warning'],
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
