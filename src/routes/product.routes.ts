import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getProductCategories,
  updateProductStatus
} from '../controllers/product.controller';
import {
  createProductSchema,
  updateProductSchema,
  getProductsSchema,
  getProductByIdSchema,
  deleteProductSchema,
  updateProductStatusSchema
} from '../schemas/product.schema';

const router = Router();

// All routes require authentication and partner role
router.use(authenticate);
router.use(authorize(['PARTNER_ADMIN', 'PARTNER_USER']));

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create a new product
 *     description: Create a new product for the partner store
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - description
 *               - price
 *               - category
 *               - condition
 *               - stock
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 3
 *                 example: "Vintage Leather Jacket"
 *               description:
 *                 type: string
 *                 example: "Classic brown leather jacket in excellent condition"
 *               price:
 *                 type: number
 *                 minimum: 0
 *                 example: 150.00
 *               originalPrice:
 *                 type: number
 *                 example: 250.00
 *               category:
 *                 type: string
 *                 example: "CLOTHING"
 *               subcategory:
 *                 type: string
 *                 example: "Jackets"
 *               condition:
 *                 type: string
 *                 enum: [NEW, LIKE_NEW, GOOD, FAIR]
 *                 example: "LIKE_NEW"
 *               size:
 *                 type: string
 *                 example: "M"
 *               color:
 *                 type: string
 *                 example: "Brown"
 *               brand:
 *                 type: string
 *                 example: "Wilson Leather"
 *               stock:
 *                 type: integer
 *                 minimum: 0
 *                 example: 1
 *               status:
 *                 type: string
 *                 enum: [DRAFT, ACTIVE]
 *                 default: "DRAFT"
 *     responses:
 *       201:
 *         description: Product created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.post(
  '/',
  validate(createProductSchema),
  createProduct
);

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products
 *     description: Get all products for the authenticated partner with pagination
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, ACTIVE, SOLD, RESERVED, INACTIVE]
 *         description: Filter by status
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, price, name]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 meta:
 *                   $ref: '#/components/schemas/PaginationMeta'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 */
router.get(
  '/',
  validate(getProductsSchema),
  getProducts
);

/**
 * @swagger
 * /api/products/categories:
 *   get:
 *     summary: Get product categories
 *     description: Get list of available product categories
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       value:
 *                         type: string
 *                       label:
 *                         type: string
 *                       subcategories:
 *                         type: array
 *                         items:
 *                           type: string
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
router.get(
  '/categories',
  getProductCategories
);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     description: Get a specific product by its ID
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.get(
  '/:id',
  validate(getProductByIdSchema),
  getProductById
);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product
 *     description: Update an existing product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               price:
 *                 type: number
 *               originalPrice:
 *                 type: number
 *               category:
 *                 type: string
 *               subcategory:
 *                 type: string
 *               condition:
 *                 type: string
 *                 enum: [NEW, LIKE_NEW, GOOD, FAIR]
 *               size:
 *                 type: string
 *               color:
 *                 type: string
 *               brand:
 *                 type: string
 *               stock:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [DRAFT, ACTIVE, SOLD, RESERVED, INACTIVE]
 *     responses:
 *       200:
 *         description: Product updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 *       422:
 *         $ref: '#/components/responses/ValidationError'
 */
router.put(
  '/:id',
  validate(updateProductSchema),
  updateProduct
);

/**
 * @swagger
 * /api/products/{id}/status:
 *   patch:
 *     summary: Update product status
 *     description: Update only the status of a product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [DRAFT, ACTIVE, SOLD, RESERVED, INACTIVE]
 *                 example: "ACTIVE"
 *     responses:
 *       200:
 *         description: Product status updated successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.patch(
  '/:id/status',
  validate(updateProductStatusSchema),
  updateProductStatus
);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete product
 *     description: Delete a product (soft delete)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
router.delete(
  '/:id',
  validate(deleteProductSchema),
  deleteProduct
);

export default router;