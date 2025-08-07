import { z } from 'zod';

export const createAddressSchema = z.object({
  body: z.object({
    street: z.string().min(5, 'Rua deve ter no mínimo 5 caracteres'),
    number: z.string().min(1, 'Número é obrigatório'),
    complement: z.string().optional(),
    neighborhood: z.string().min(2, 'Bairro deve ter no mínimo 2 caracteres'),
    city: z.string().min(2, 'Cidade deve ter no mínimo 2 caracteres'),
    state: z.string().length(2, 'Estado deve ter 2 caracteres').regex(/^[A-Z]{2}$/, 'Estado deve conter apenas letras maiúsculas'),
    zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP deve estar no formato XXXXX-XXX'),
    partnerId: z.string().cuid('ID do parceiro inválido')
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
    zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP deve estar no formato XXXXX-XXX').optional()
  })
});

export const addressParamsSchema = z.object({
  params: z.object({
    id: z.string().cuid('ID do endereço inválido')
  })
});

export const partnerAddressParamsSchema = z.object({
  params: z.object({
    partnerId: z.string().cuid('ID do parceiro inválido')
  })
});

export type CreateAddressInput = z.infer<typeof createAddressSchema>['body'];
export type UpdateAddressInput = z.infer<typeof updateAddressSchema>['body'];
export type AddressParamsInput = z.infer<typeof addressParamsSchema>['params'];
export type PartnerAddressParamsInput = z.infer<typeof partnerAddressParamsSchema>['params'];