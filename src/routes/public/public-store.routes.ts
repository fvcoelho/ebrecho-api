import { Router } from 'express';
import {
  getPublicStoreBySlug,
  getStoreCategories,
  registerStoreView
} from '../../controllers/public/public-store.controller';

const router = Router();

// Public store routes - no authentication required
router.get('/store/:slug', getPublicStoreBySlug);
router.get('/store/:slug/categories', getStoreCategories);
router.post('/store/:slug/view', registerStoreView);

export default router;