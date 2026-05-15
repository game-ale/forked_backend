import express from 'express';

import { env } from './config/env';
import { prisma } from './lib/prisma';
import { errorHandler } from './middleware/error-handler';
import { notFoundHandler } from './middleware/not-found';
import { apiRouter } from './routes/index';

export const app = express();

app.disable('x-powered-by');
app.use(express.json());

app.use('/api', apiRouter);

export const healthHandler = async (_request: express.Request, response: express.Response) => {
  let clientReady = false;
  if (prisma) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      clientReady = true;
    } catch {
      clientReady = false;
    }
  }
  response.json({
    status: 'ok',
    appName: env.appName,
    environment: env.appEnv,
    prismaConfigured: env.prismaConfigured,
    clientReady,
  });
};

app.get('/health', healthHandler);

app.use(notFoundHandler);
app.use(errorHandler);
