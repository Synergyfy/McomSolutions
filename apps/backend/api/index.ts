import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

let app: any;

async function bootstrap() {
  if (!app) {
    app = await NestFactory.create(AppModule);
    
    // Enable CORS
    app.enableCors({
      origin: true,
      credentials: true,
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
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
  return app.getHttpAdapter().getInstance();
}

export default async (req: any, res: any) => {
  // Manually intercept CORS preflight requests at the edge
  res.setHeader('Access-Control-Allow-Origin', 'https://mcomsolutions.vercel.app');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const expressInstance = await bootstrap();
  
  console.log(`[Vercel Serverless] Method: ${req.method} | Original req.url: ${req.url}`);
  console.log(`[Vercel Serverless] x-forwarded-url header: ${req.headers['x-forwarded-url']}`);
  console.log(`[Vercel Serverless] x-original-url header: ${req.headers['x-original-url']}`);
  console.log(`[Vercel Serverless] originalUrl query param: ${req.query?.originalUrl}`);
  
  // Restore original URL from Vercel query or headers to prevent routing 404s
  const originalUrl = req.query?.originalUrl || req.headers['x-forwarded-url'] || req.headers['x-original-url'];
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

  console.log(`[Vercel Serverless] Normalized req.url passed to NestJS: ${req.url}`);

  return expressInstance(req, res);
};
