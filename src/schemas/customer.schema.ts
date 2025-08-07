import { z } from 'zod';

export const createCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
    email: z.string().email('Email inválido'),
    phone: z.string().min(10, 'Telefone deve ter no mínimo 10 caracteres'),
    cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF deve estar no formato XXX.XXX.XXX-XX').optional(),
    partnerId: z.string().cuid('ID do parceiro inválido').optional()
  })
});

export const updateCustomerSchema = z.object({
  body: z.object({
    name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').optional(),
    email: z.string().email('Email inválido').optional(),
    phone: z.string().min(10, 'Telefone deve ter no mínimo 10 caracteres').optional(),
    cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, 'CPF deve estar no formato XXX.XXX.XXX-XX').optional(),
    isActive: z.boolean().optional()
  })
});

export const customerParamsSchema = z.object({
  params: z.object({
    id: z.string().cuid('ID do cliente inválido').optional(),
    customerId: z.string().cuid('ID do cliente inválido').optional()
  }).refine(data => data.id || data.customerId, {
    message: 'ID do cliente é obrigatório'
  })
});

export const createAddressSchema = z.object({
  body: z.object({
    street: z.string().min(5, 'Rua deve ter no mínimo 5 caracteres'),
    number: z.string().min(1, 'Número é obrigatório'),
    complement: z.string().optional(),
    neighborhood: z.string().min(2, 'Bairro deve ter no mínimo 2 caracteres'),
    city: z.string().min(2, 'Cidade deve ter no mínimo 2 caracteres'),
    state: z.string().length(2, 'Estado deve ter 2 caracteres').regex(/^[A-Z]{2}$/, 'Estado deve conter apenas letras maiúsculas'),
    zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP deve estar no formato XXXXX-XXX'),
    isDefault: z.boolean().optional()
  })
});

export const updateAddressSchema = z.object({
  body: z.object({
    street: z.string().min(5, 'Rua deve ter no mínimo 5 caracteres').optional(),
    number: z.string().min(1, 'Número é obrigatório').optional(),
    complement: z.string().optional(),
    neighborhood: z.string().min(2, 'Bairro deve ter no mínimo 2 caracteres').optional(),
    city: z.string().min(2, 'Cidade deve ter no mínimo 2 caracteres').optional(),
    state: z.string().length(2, 'Estado deve ter 2 caracteres').regex(/^[A-Z]{2}$/, 'Estado deve conter apenas letras maiúsculas').optional(),
    zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP deve estar no formato XXXXX-XXX').optional(),
    isDefault: z.boolean().optional()
  })
});

export const addressParamsSchema = z.object({
  params: z.object({
    customerId: z.string().cuid('ID do cliente inválido'),
    addressId: z.string().cuid('ID do endereço inválido')
  })
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>['body'];
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>['body'];
export type CustomerParamsInput = z.infer<typeof customerParamsSchema>['params'];
export type CreateAddressInput = z.infer<typeof createAddressSchema>['body'];
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>['body'];
export type AddressParamsInput = z.infer<typeof addressParamsSchema>['params'];