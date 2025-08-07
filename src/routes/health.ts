import { Request, Response, Router } from 'express';
import { APP_VERSION } from '../version';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    version: APP_VERSION.version,
    fullVersion: APP_VERSION.fullVersion,
    environment: APP_VERSION.environment,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

router.get('/version', (req: Request, res: Response) => {
  res.json(APP_VERSION);
});

export default router;