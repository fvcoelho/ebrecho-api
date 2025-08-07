import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { promoterMiddleware, canApplyPromoterMiddleware } from '../middlewares/promoter.middleware';
import {
  promoterApplicationSchema,
  promoterUpdateSchema,
  createInvitationSchema,
  updateInvitationSchema,
  createEventSchema,
  updateEventSchema,
  eventInvitePartnersSchema,
  payoutRequestSchema,
} from '../schemas/promoter.schema';
import {
  applyForPromoter,
  getPromoterProfile,
  updatePromoterProfile,
  createInvitation,
  getInvitations,
  updateInvitation,
  cancelInvitation,
  getPromoterAnalytics,
  getCommissions,
} from '../controllers/promoter.controller';
import marketIntelligenceRoutes from './promoter/market-intelligence.routes';

const router = Router();

// All routes require authentication
router.use(authMiddleware);

// Promoter application (special middleware to check eligibility)
router.post('/apply', canApplyPromoterMiddleware, validate(promoterApplicationSchema), applyForPromoter);

// All other routes require PROMOTER role
router.use(promoterMiddleware);

// Promoter Profile Management
router.get('/profile', getPromoterProfile);
router.put('/profile', validate(promoterUpdateSchema), updatePromoterProfile);

// Invitation Management
router.post('/invitations', validate(createInvitationSchema), createInvitation);
router.get('/invitations', getInvitations);
router.put('/invitations/:id', validate(updateInvitationSchema), updateInvitation);
router.delete('/invitations/:id', cancelInvitation);

// Analytics & Reporting
router.get('/analytics', getPromoterAnalytics);
router.get('/commissions', getCommissions);

// Market Intelligence & Brechó Discovery
router.use('/market-intelligence', marketIntelligenceRoutes);

export default router;