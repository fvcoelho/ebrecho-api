import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductCategories,
  updateProductStatus
} from '../controllers/product.controller';
import {
  createProductSchema,
  updateProductSchema,
  getProductsSchema,
  getProductByIdSchema,
  deleteProductSchema,
  updateProductStatusSchema
} from '../schemas/product.schema';

const router = Router();

// All routes require authentication and partner role
router.use(authenticate);
router.use(authorize(['PARTNER_ADMIN', 'PARTNER_USER']));

// Product CRUD routes
router.post(
  '/',
  validate(createProductSchema),
  createProduct
);

router.get(
  '/',
  validate(getProductsSchema),
  getProducts
);

router.get(
  '/categories',
  getProductCategories
);

router.get(
  '/:id',
  validate(getProductByIdSchema),
  getProductById
);

router.put(
  '/:id',
  validate(updateProductSchema),
  updateProduct
);

router.patch(
  '/:id/status',
  validate(updateProductStatusSchema),
  updateProductStatus
);

router.delete(
  '/:id',
  validate(deleteProductSchema),
  deleteProduct
);

export default router;