import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    name: z.string()
      .min(3, 'Nome deve ter pelo menos 3 caracteres')
      .max(100, 'Nome deve ter no máximo 100 caracteres'),
    description: z.string()
      .max(1000, 'Descrição deve ter no máximo 1000 caracteres')
      .optional(),
    price: z.string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Preço inválido')
      .transform(val => parseFloat(val)),
    sku: z.string()
      .max(50, 'SKU deve ter no máximo 50 caracteres')
      .optional(),
    category: z.string()
      .min(1, 'Categoria é obrigatória'),
    brand: z.string()
      .max(50, 'Marca deve ter no máximo 50 caracteres')
      .optional(),
    size: z.string()
      .max(20, 'Tamanho deve ter no máximo 20 caracteres')
      .optional(),
    color: z.string()
      .max(30, 'Cor deve ter no máximo 30 caracteres')
      .optional(),
    condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'], {
      errorMap: () => ({ message: 'Condição inválida' })
    }),
    status: z.enum(['AVAILABLE', 'SOLD', 'RESERVED', 'INACTIVE'], {
      errorMap: () => ({ message: 'Status inválido' })
    }).optional()
  })
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID do produto é obrigatório')
  }),
  body: z.object({
    name: z.string()
      .min(3, 'Nome deve ter pelo menos 3 caracteres')
      .max(100, 'Nome deve ter no máximo 100 caracteres')
      .optional(),
    description: z.string()
      .max(1000, 'Descrição deve ter no máximo 1000 caracteres')
      .optional(),
    price: z.string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Preço inválido')
      .transform(val => parseFloat(val))
      .optional(),
    sku: z.string()
      .max(50, 'SKU deve ter no máximo 50 caracteres')
      .optional(),
    category: z.string()
      .min(1, 'Categoria é obrigatória')
      .optional(),
    brand: z.string()
      .max(50, 'Marca deve ter no máximo 50 caracteres')
      .optional(),
    size: z.string()
      .max(20, 'Tamanho deve ter no máximo 20 caracteres')
      .optional(),
    color: z.string()
      .max(30, 'Cor deve ter no máximo 30 caracteres')
      .optional(),
    condition: z.enum(['NEW', 'LIKE_NEW', 'GOOD', 'FAIR'], {
      errorMap: () => ({ message: 'Condição inválida' })
    }).optional(),
    status: z.enum(['AVAILABLE', 'SOLD', 'RESERVED', 'INACTIVE'], {
      errorMap: () => ({ message: 'Status inválido' })
    }).optional()
  })
});

export const getProductsSchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, 'Página deve ser um número').optional(),
    limit: z.string().regex(/^\d+$/, 'Limite deve ser um número').optional(),
    status: z.enum(['AVAILABLE', 'SOLD', 'RESERVED', 'INACTIVE']).optional(),
    category: z.string().optional(),
    search: z.string().optional(),
    sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'price']).optional(),
    sortOrder: z.enum(['asc', 'desc']).optional()
  })
});

export const getProductByIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID do produto é obrigatório')
  })
});

export const deleteProductSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID do produto é obrigatório')
  })
});

export const updateProductStatusSchema = z.object({
  params: z.object({
    id: z.string().min(1, 'ID do produto é obrigatório')
  }),
  body: z.object({
    status: z.enum(['AVAILABLE', 'SOLD', 'RESERVED', 'INACTIVE'], {
      errorMap: () => ({ message: 'Status inválido' })
    })
  })
});