import { Router } from 'express';
import * as onboardingController from '../controllers/onboarding.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import { completePartnerRegistrationSchema } from '../schemas/onboarding.schema';

const router = Router();

// Todas as rotas requerem autenticação
router.use(authMiddleware);

// Verificar status do onboarding
router.get('/status', onboardingController.getOnboardingStatus as any);

// Completar cadastro do parceiro
router.post(
  '/complete-partner',
  validate(completePartnerRegistrationSchema),
  onboardingController.completePartnerRegistration as any
);

export default router;