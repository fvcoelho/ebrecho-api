import swaggerJsdoc from 'swagger-jsdoc';
import { version } from '../../package.json';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'eBrecho API',
      version,
      description: 'API for eBrecho - Second-hand fashion marketplace platform',
      contact: {
        name: 'eBrecho Support',
        email: 'support@ebrecho.com.br',
        url: 'https://ebrecho.com.br'
      },
      license: {
        name: 'Proprietary',
        url: 'https://ebrecho.com.br/terms'
      }
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      },
      {
        url: 'https://api.ebrecho.com.br',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT authentication token'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false
            },
            error: {
              type: 'string',
              description: 'Error message'
            },
            details: {
              type: 'object',
              description: 'Additional error details'
            }
          }
        },
        Success: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true
            },
            data: {
              type: 'object',
              description: 'Response data'
            },
            message: {
              type: 'string',
              description: 'Success message'
            }
          }
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            total: {
              type: 'integer',
              description: 'Total number of items'
            },
            page: {
              type: 'integer',
              description: 'Current page number'
            },
            limit: {
              type: 'integer',
              description: 'Items per page'
            },
            totalPages: {
              type: 'integer',
              description: 'Total number of pages'
            }
          }
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'User ID'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email'
            },
            name: {
              type: 'string',
              description: 'User name'
            },
            role: {
              type: 'string',
              enum: ['ADMIN', 'CUSTOMER', 'PARTNER_ADMIN', 'PARTNER_USER', 'PROMOTER', 'SUPER_ADMIN'],
              description: 'User role'
            },
            isActive: {
              type: 'boolean',
              description: 'User account status'
            },
            emailVerified: {
              type: 'boolean',
              description: 'Email verification status'
            },
            partnerId: {
              type: 'string',
              nullable: true,
              description: 'Associated partner ID'
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation date'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Last update date'
            }
          }
        },
        Product: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            name: {
              type: 'string'
            },
            description: {
              type: 'string'
            },
            price: {
              type: 'number'
            },
            originalPrice: {
              type: 'number',
              nullable: true
            },
            category: {
              type: 'string'
            },
            subcategory: {
              type: 'string',
              nullable: true
            },
            condition: {
              type: 'string',
              enum: ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']
            },
            size: {
              type: 'string',
              nullable: true
            },
            color: {
              type: 'string',
              nullable: true
            },
            brand: {
              type: 'string',
              nullable: true
            },
            stock: {
              type: 'integer'
            },
            status: {
              type: 'string',
              enum: ['DRAFT', 'ACTIVE', 'SOLD', 'RESERVED', 'INACTIVE']
            },
            images: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: {
                    type: 'string'
                  },
                  url: {
                    type: 'string'
                  },
                  isPrimary: {
                    type: 'boolean'
                  }
                }
              }
            },
            partnerId: {
              type: 'string'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        },
        Partner: {
          type: 'object',
          properties: {
            id: {
              type: 'string'
            },
            name: {
              type: 'string'
            },
            slug: {
              type: 'string'
            },
            description: {
              type: 'string',
              nullable: true
            },
            logo: {
              type: 'string',
              nullable: true
            },
            banner: {
              type: 'string',
              nullable: true
            },
            email: {
              type: 'string',
              format: 'email'
            },
            phone: {
              type: 'string',
              nullable: true
            },
            website: {
              type: 'string',
              nullable: true
            },
            instagram: {
              type: 'string',
              nullable: true
            },
            isActive: {
              type: 'boolean'
            },
            settings: {
              type: 'object'
            },
            createdAt: {
              type: 'string',
              format: 'date-time'
            },
            updatedAt: {
              type: 'string',
              format: 'date-time'
            }
          }
        }
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Authentication required'
              }
            }
          }
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Insufficient permissions'
              }
            }
          }
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Resource not found'
              }
            }
          }
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Validation error',
                details: {
                  field: 'error message'
                }
              }
            }
          }
        },
        ServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/Error'
              },
              example: {
                success: false,
                error: 'Internal server error'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'User authentication and registration'
      },
      {
        name: 'Users',
        description: 'User management'
      },
      {
        name: 'Partners',
        description: 'Partner store management'
      },
      {
        name: 'Products',
        description: 'Product catalog management'
      },
      {
        name: 'Orders',
        description: 'Order processing'
      },
      {
        name: 'Customers',
        description: 'Customer management'
      },
      {
        name: 'Dashboard',
        description: 'Dashboard and analytics'
      },
      {
        name: 'Admin',
        description: 'Administrative functions'
      },
      {
        name: 'Public',
        description: 'Public endpoints (no auth required)'
      },
      {
        name: 'Images',
        description: 'Image upload and processing'
      },
      {
        name: 'AI',
        description: 'AI-powered features'
      },
      {
        name: 'Promoter',
        description: 'Promoter system'
      },
      {
        name: 'System',
        description: 'System administration and testing endpoints'
      }
    ]
  },
  apis: process.env.VERCEL ? [
    // In Vercel, try both possible locations
    './src/routes/*.js',
    './src/routes/**/*.js', 
    './src/controllers/*.js',
    './src/schemas/*.js',
    './dist/src/routes/*.js',
    './dist/src/routes/**/*.js',
    './dist/src/controllers/*.js',
    './dist/src/schemas/*.js'
  ] : [
    './src/routes/*.ts',
    './src/routes/**/*.ts',
    './src/controllers/*.ts',
    './src/schemas/*.ts'
  ]
};

// Generate swagger spec - handle both dev and production
let swaggerSpecGenerated;

if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
  // In production/Vercel: Load pre-generated swagger spec
  try {
    const fs = require('fs');
    const path = require('path');
    const preGeneratedPath = path.join(__dirname, '../../dist/swagger-spec.json');
    
    if (fs.existsSync(preGeneratedPath)) {
      console.log('📋 Loading pre-generated swagger spec from:', preGeneratedPath);
      swaggerSpecGenerated = JSON.parse(fs.readFileSync(preGeneratedPath, 'utf8'));
      console.log(`✅ Loaded ${Object.keys(swaggerSpecGenerated.paths || {}).length} documented endpoints`);
    } else {
      console.warn('⚠️  Pre-generated swagger spec not found, falling back to runtime generation');
      throw new Error('Pre-generated spec not found');
    }
  } catch (error) {
    console.warn('⚠️  Failed to load pre-generated spec, using runtime generation:', error.message);
    swaggerSpecGenerated = swaggerJsdoc(options);
  }
} else {
  // In development: Use runtime file scanning
  console.log('🔧 Development mode: scanning TypeScript files for @swagger documentation');
  swaggerSpecGenerated = swaggerJsdoc(options);
  const pathCount = Object.keys(swaggerSpecGenerated.paths || {}).length;
  console.log(`📋 Found ${pathCount} documented API endpoints in development`);
}

export const swaggerSpec = swaggerSpecGenerated;