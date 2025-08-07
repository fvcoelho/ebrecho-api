import { Router } from 'express';
import {
  getPublicProducts,
  getPublicProductBySlug,
  registerProductView
} from '../../controllers/public/public-product.controller';

const router = Router();

// Public product routes - no authentication required
router.get('/store/:slug/products', getPublicProducts);
router.get('/store/:slug/product/:productSlug', getPublicProductBySlug);
router.post('/store/:slug/product/:productId/view', registerProductView);

export default router;