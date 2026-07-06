import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const server = express();

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://mcommall.vercel.app',
  'https://mcomloyalty.vercel.app',
  'https://mcom-solutions-backend.vercel.app',
];

server.use((req: any, res: any, next: any) => {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, Origin, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

let app: any;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create(AppModule, new ExpressAdapter(server));
    
    // Enable CORS
    app.enableCors({
      origin: [
        'http://localhost:5173',
        'http://localhost:3000',
        'https://mcommall.vercel.app',
        'https://mcomloyalty.vercel.app',
        'https://mcom-solutions-backend.vercel.app',
      ],
      credentials: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
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

    // Swagger
    const config = new DocumentBuilder()
      .setTitle('MCOM Central API')
      .setDescription('Central Hub Identity, Subscription and Platform management')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);

    await app.init();
  }
  return server;
}

export default async (req: any, res: any) => {
  const expressInstance = await bootstrap();
  
  // Restore original URL from Vercel headers to prevent routing 404s
  const originalUrl = req.headers['x-forwarded-url'] || req.headers['x-original-url'];
  if (originalUrl) {
    req.url = originalUrl as string;
  } else if (req.url) {
    // Fallback normalization
    if (req.url.startsWith('/v1/')) {
      req.url = '/api' + req.url;
    } else if (!req.url.startsWith('/api/')) {
      req.url = '/api/v1' + req.url;
    }
  }

  return expressInstance(req, res);
};
