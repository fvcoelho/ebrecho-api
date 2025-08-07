import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { AuthRequest } from '../types';

const router = Router();

router.use(authMiddleware);

router.use((req, res, next) => {
  const authReq = req as AuthRequest;
  const allowedRoles = ['PARTNER_ADMIN', 'PARTNER_USER'];
  if (!authReq.user?.role || !allowedRoles.includes(authReq.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Access denied. Partner role required.'
    });
  }
  next();
});

router.get('/stats', dashboardController.getPartnerDashboardStats as any);

router.get('/sales', dashboardController.getPartnerSalesHistory as any);

router.get('/products/stats', dashboardController.getPartnerProductStats as any);

router.get('/insights/customers', dashboardController.getPartnerCustomerInsights as any);

// Partner profile management
router.get('/partner', dashboardController.getCurrentPartner as any);

router.put('/partner', dashboardController.updateCurrentPartner as any);

export default router;