import { Router } from 'express';
import { AIEnhancementController } from '../controllers/ai-enhancement.controller';
import { uploadSingleImage, uploadProductImages } from '../middlewares/upload.middleware';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validatePartnerAccess } from '../middlewares/partner.middleware';

const router = Router();
const aiEnhancementController = new AIEnhancementController();

// Debug endpoints
router.get('/debug/:requestId', 
  authenticateToken, 
  aiEnhancementController.getDebugInfo.bind(aiEnhancementController)
);

router.get('/debug', 
  authenticateToken, 
  aiEnhancementController.getAllDebugInfo.bind(aiEnhancementController)
);

// Enhancement endpoints
router.post('/enhance/single', 
  authenticateToken,
  validatePartnerAccess,
  uploadSingleImage,
  aiEnhancementController.enhanceSingleImage.bind(aiEnhancementController)
);

router.post('/enhance/batch', 
  authenticateToken,
  validatePartnerAccess,
  uploadProductImages,
  aiEnhancementController.enhanceBatchImages.bind(aiEnhancementController)
);

router.post('/products/:productId/enhance', 
  authenticateToken,
  validatePartnerAccess,
  aiEnhancementController.enhanceProductImages.bind(aiEnhancementController)
);

// Usage tracking endpoints
router.get('/usage', 
  authenticateToken,
  validatePartnerAccess,
  aiEnhancementController.getUsageStats.bind(aiEnhancementController)
);

router.get('/usage/detailed', 
  authenticateToken,
  validatePartnerAccess,
  aiEnhancementController.getDetailedUsage.bind(aiEnhancementController)
);

export { router as aiEnhancementRoutes };