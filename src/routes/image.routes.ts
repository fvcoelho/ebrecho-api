import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { uploadProductImages } from '../middlewares/upload.middleware';
import {
  uploadProductImages as uploadController,
  deleteProductImage,
  reorderProductImages,
  cropProductImage
} from '../controllers/image.controller';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Upload multiple images to a product
router.post(
  '/products/:productId/images', 
  uploadProductImages, 
  uploadController
);

// Delete a specific image
router.delete('/products/:productId/images/:imageId', deleteProductImage);

// Reorder images for a product
router.put('/products/:productId/images/reorder', reorderProductImages);

// Crop/edit an existing image
router.put('/products/:productId/images/:imageId/crop', cropProductImage);

export default router;