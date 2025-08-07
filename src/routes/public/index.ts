import { Router } from 'express';
import publicStoreRoutes from './public-store.routes';
import publicProductRoutes from './public-product.routes';
import publicInvitationRoutes from './public-invitation.routes';

const router = Router();

// Mount public routes
router.use(publicStoreRoutes);
router.use(publicProductRoutes);
router.use('/invitations', publicInvitationRoutes);

export default router;