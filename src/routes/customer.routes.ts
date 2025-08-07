import { Router } from 'express';
import * as customerController from '../controllers/customer.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { authorize } from '../middlewares/roles.middleware';
import { validate } from '../middlewares/validate.middleware';
import { 
  createCustomerSchema, 
  updateCustomerSchema, 
  customerParamsSchema,
  createAddressSchema,
  updateAddressSchema,
  addressParamsSchema
} from '../schemas/customer.schema';

const router = Router();

// Public endpoint for customer registration
router.post('/', validate(createCustomerSchema), customerController.createCustomer);

// Customer address management (public)
router.post('/:customerId/addresses', 
  validate(customerParamsSchema), 
  validate(createAddressSchema), 
  customerController.createCustomerAddress
);
router.put('/:customerId/addresses/:addressId', 
  validate(addressParamsSchema), 
  validate(updateAddressSchema), 
  customerController.updateCustomerAddress
);
router.delete('/:customerId/addresses/:addressId', 
  validate(addressParamsSchema), 
  customerController.deleteCustomerAddress
);

// Authenticated routes
router.use(authenticate);

// Get customers (filtered by partner for non-admins)
router.get('/', customerController.getCustomers);
router.get('/stats', customerController.getCustomerStats);
router.get('/:id', validate(customerParamsSchema), customerController.getCustomerById);

// Admin only routes
router.put('/:id', 
  validate(customerParamsSchema), 
  validate(updateCustomerSchema), 
  authorize(['ADMIN']), 
  customerController.updateCustomer
);

export default router;