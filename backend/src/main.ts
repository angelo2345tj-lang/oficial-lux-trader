import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_ORIGINS = [
  'https://oficial-lux-trader.vercel.app',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:4173',
] as const;

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'] as const;

const ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'Origin',
  'X-Requested-With',
  'Cache-Control',
  'Pragma',
] as const;

function buildAllowedOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ORIGINS, ...fromEnv])];
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const allowedOrigins = buildAllowedOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      // curl, health probes, server-to-server — sem header Origin
      if (!origin) {
        callback(null, true);
        return;
      }
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: [...ALLOWED_METHODS],
    allowedHeaders: [...ALLOWED_HEADERS],
    exposedHeaders: ['Content-Length', 'Content-Type'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86_400,
  });

  app.enableShutdownHooks();
  const port = Number(process.env.PORT) || 3001;
  await app.listen(port, '0.0.0.0');

  const { attachInstitutionalStream } = await import('./core/institutional/InstitutionalStreamServer');
  attachInstitutionalStream(app.getHttpServer());

  console.log(`Lux Trader API listening on :${port}`);
  console.log(`CORS origins: ${allowedOrigins.join(', ')}`);
  console.log(`Institutional WS: ws://0.0.0.0:${port}/institutional/stream`);
}

bootstrap();
