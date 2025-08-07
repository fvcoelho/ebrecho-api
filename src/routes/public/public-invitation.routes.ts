import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware';
import { acceptInvitationSchema } from '../../schemas/promoter.schema';
import {
  getInvitationDetails,
  acceptInvitation,
  declineInvitation,
} from '../../controllers/public/public-invitation.controller';

const router = Router();

// Get invitation details (public)
router.get('/:code', getInvitationDetails);

// Accept invitation and register as partner
router.post('/:code/accept', validate(acceptInvitationSchema), acceptInvitation);

// Decline invitation
router.post('/:code/decline', declineInvitation);

export default router;