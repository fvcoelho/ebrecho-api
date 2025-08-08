import { z } from 'zod';

/**
 * Convert Zod schema to OpenAPI schema
 * This is a simplified converter for common use cases
 */
export function zodToOpenAPI(schema: z.ZodSchema<any>): any {
  const openApiSchema: any = {};

  if (schema instanceof z.ZodObject) {
    const shape = schema.shape;
    openApiSchema.type = 'object';
    openApiSchema.properties = {};
    openApiSchema.required = [];

    for (const [key, value] of Object.entries(shape)) {
      openApiSchema.properties[key] = zodToOpenAPI(value as z.ZodSchema<any>);
      
      // Check if field is required
      if (!(value instanceof z.ZodOptional) && !(value instanceof z.ZodNullable)) {
        openApiSchema.required.push(key);
      }
    }

    if (openApiSchema.required.length === 0) {
      delete openApiSchema.required;
    }
  } else if (schema instanceof z.ZodString) {
    openApiSchema.type = 'string';
    const checks = (schema as any)._def.checks || [];
    
    for (const check of checks) {
      if (check.kind === 'email') {
        openApiSchema.format = 'email';
      } else if (check.kind === 'url') {
        openApiSchema.format = 'uri';
      } else if (check.kind === 'uuid') {
        openApiSchema.format = 'uuid';
      } else if (check.kind === 'min') {
        openApiSchema.minLength = check.value;
      } else if (check.kind === 'max') {
        openApiSchema.maxLength = check.value;
      } else if (check.kind === 'regex') {
        openApiSchema.pattern = check.regex.source;
      }
    }
  } else if (schema instanceof z.ZodNumber) {
    openApiSchema.type = 'number';
    const checks = (schema as any)._def.checks || [];
    
    for (const check of checks) {
      if (check.kind === 'int') {
        openApiSchema.type = 'integer';
      } else if (check.kind === 'min') {
        openApiSchema.minimum = check.value;
      } else if (check.kind === 'max') {
        openApiSchema.maximum = check.value;
      }
    }
  } else if (schema instanceof z.ZodBoolean) {
    openApiSchema.type = 'boolean';
  } else if (schema instanceof z.ZodArray) {
    openApiSchema.type = 'array';
    openApiSchema.items = zodToOpenAPI((schema as any)._def.type);
  } else if (schema instanceof z.ZodEnum) {
    const values = (schema as any)._def.values;
    openApiSchema.type = 'string';
    openApiSchema.enum = values;
  } else if (schema instanceof z.ZodOptional) {
    return zodToOpenAPI((schema as any)._def.innerType);
  } else if (schema instanceof z.ZodNullable) {
    const innerSchema = zodToOpenAPI((schema as any)._def.innerType);
    return { ...innerSchema, nullable: true };
  } else if (schema instanceof z.ZodDate) {
    openApiSchema.type = 'string';
    openApiSchema.format = 'date-time';
  } else if (schema instanceof z.ZodUnion) {
    openApiSchema.oneOf = (schema as any)._def.options.map((option: z.ZodSchema<any>) => 
      zodToOpenAPI(option)
    );
  }

  return openApiSchema;
}

/**
 * Create a standard success response schema
 */
export function successResponse(dataSchema?: any) {
  return {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true
      },
      data: dataSchema || {
        type: 'object'
      },
      message: {
        type: 'string',
        description: 'Success message'
      }
    }
  };
}

/**
 * Create a paginated response schema
 */
export function paginatedResponse(itemSchema: any) {
  return {
    type: 'object',
    properties: {
      success: {
        type: 'boolean',
        example: true
      },
      data: {
        type: 'array',
        items: itemSchema
      },
      meta: {
        type: 'object',
        properties: {
          total: {
            type: 'integer',
            description: 'Total number of items'
          },
          page: {
            type: 'integer',
            description: 'Current page'
          },
          limit: {
            type: 'integer',
            description: 'Items per page'
          },
          totalPages: {
            type: 'integer',
            description: 'Total pages'
          }
        }
      }
    }
  };
}

/**
 * Create common response definitions
 */
export const commonResponses = {
  200: {
    description: 'Success',
    content: {
      'application/json': {
        schema: successResponse()
      }
    }
  },
  201: {
    description: 'Created',
    content: {
      'application/json': {
        schema: successResponse()
      }
    }
  },
  204: {
    description: 'No Content'
  },
  400: {
    description: 'Bad Request',
    content: {
      'application/json': {
        schema: {
          $ref: '#/components/schemas/Error'
        }
      }
    }
  },
  401: {
    $ref: '#/components/responses/UnauthorizedError'
  },
  403: {
    $ref: '#/components/responses/ForbiddenError'
  },
  404: {
    $ref: '#/components/responses/NotFoundError'
  },
  422: {
    $ref: '#/components/responses/ValidationError'
  },
  500: {
    $ref: '#/components/responses/ServerError'
  }
};

/**
 * Helper to create security requirements
 */
export const bearerAuth = [{ bearerAuth: [] }];