import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import * as adminPromoterController from '../controllers/admin.promoter.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AuthRequest } from '../types';

const router = Router();

router.use(authMiddleware);

router.use((req, res, next) => {
  const authReq = req as AuthRequest;
  if (authReq.user?.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Admin role required.'
    });
  }
  next();
});

router.get('/stats', adminController.getAdminStats as any);

router.get('/users/stats', adminController.getUserStats as any);

router.get('/partners/stats', adminController.getPartnerStats as any);

router.get('/products/stats', adminController.getProductStats as any);

router.get('/sales/stats', adminController.getSalesStats as any);

// Promoter management routes
router.get('/promoters/pending', adminPromoterController.getPendingPromoterApplications as any);
router.post('/promoters/approve', adminPromoterController.approvePromoterApplication as any);
router.put('/promoters/tier', adminPromoterController.updatePromoterTier as any);

export default router;