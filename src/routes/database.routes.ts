import { Router } from 'express';
import * as databaseController from '../controllers/database.controller';

const router = Router();

// Public routes - database stats are now publicly accessible
router.get('/stats', databaseController.getStats);
router.get('/health', databaseController.checkHealth);

export default router;