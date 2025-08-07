import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createPartner,
  getPartners,
  getPartnerById,
  updatePartner,
  deletePartner
} from '../controllers/partner.controller';
import {
  createPartnerSchema,
  updatePartnerSchema,
  partnerParamsSchema
} from '../schemas/partner.schema';

const router = Router();

// All partner routes require authentication
router.use(authenticate);

// GET /api/partners - Get all partners (ADMIN only)
router.get('/', authorize(['ADMIN']), getPartners);

// GET /api/partners/:id - Get partner by ID (ADMIN or PARTNER_ADMIN for own partner)
router.get('/:id', validate(partnerParamsSchema), authorize(['ADMIN', 'PARTNER_ADMIN']), getPartnerById);

// POST /api/partners - Create new partner (ADMIN only)
router.post('/', validate(createPartnerSchema), authorize(['ADMIN']), createPartner);

// PUT /api/partners/:id - Update partner (ADMIN or PARTNER_ADMIN)
router.put('/:id', validate(partnerParamsSchema), validate(updatePartnerSchema), authorize(['ADMIN', 'PARTNER_ADMIN']), updatePartner);

// DELETE /api/partners/:id - Delete partner (ADMIN only)
router.delete('/:id', validate(partnerParamsSchema), authorize(['ADMIN']), deletePartner);

export default router;