import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  getAddressByPartnerId,
  createAddress,
  updateAddress,
  updateAddressByPartnerId,
  deleteAddress
} from '../controllers/address.controller';
import {
  createAddressSchema,
  updateAddressSchema,
  addressParamsSchema,
  partnerAddressParamsSchema
} from '../schemas/address.schema';

const router = Router();

// All address routes require authentication
router.use(authenticate);

// GET /api/addresses/partner/:partnerId - Get address by partner ID
router.get('/partner/:partnerId', validate(partnerAddressParamsSchema), getAddressByPartnerId);

// POST /api/addresses - Create new address
router.post('/', validate(createAddressSchema), createAddress);

// PUT /api/addresses/:id - Update address by ID
router.put('/:id', validate(addressParamsSchema), validate(updateAddressSchema), updateAddress);

// PUT /api/addresses/partner/:partnerId - Update address by partner ID
router.put('/partner/:partnerId', validate(partnerAddressParamsSchema), validate(updateAddressSchema), updateAddressByPartnerId);

// DELETE /api/addresses/:id - Delete address
router.delete('/:id', validate(addressParamsSchema), deleteAddress);

export default router;