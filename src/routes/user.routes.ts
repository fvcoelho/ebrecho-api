import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/roles.middleware';

const router = Router();

// All user routes require authentication
router.use(authenticate);

// Admin only routes
router.get('/', authorize(['ADMIN']), userController.getUsers);
router.post('/', authorize(['ADMIN']), userController.createUser);
router.get('/:id', userController.getUserById);
router.put('/:id', userController.updateUser);
router.delete('/:id', authorize(['ADMIN']), userController.deleteUser);
router.patch('/:id/toggle-status', authorize(['ADMIN']), userController.toggleUserStatus);

export default router;