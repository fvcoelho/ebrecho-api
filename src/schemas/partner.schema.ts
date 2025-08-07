import { z } from 'zod';

export const createPartnerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').regex(/^[a-zA-ZÀ-ÿ\s0-9&\-'.]+$/, 'Nome deve conter apenas letras, números, espaços e caracteres especiais comuns'),
    email: z.string().trim().email('Email inválido'),
    phone: z.string().regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone deve estar no formato (XX) XXXXX-XXXX'),
    document: z.string().min(11, 'Documento deve ter no mínimo 11 caracteres').max(18, 'Documento deve ter no máximo 18 caracteres'),
    documentType: z.enum(['CPF', 'CNPJ'], { required_error: 'Tipo de documento é obrigatório' }),
    description: z.string().max(500, 'Descrição deve ter no máximo 500 caracteres').optional(),
    logo: z.string().url('Logo deve ser uma URL válida').optional(),
    address: z.object({
      street: z.string().min(5, 'Rua deve ter no mínimo 5 caracteres'),
      number: z.string().min(1, 'Número é obrigatório'),
      complement: z.string().optional(),
      neighborhood: z.string().min(2, 'Bairro deve ter no mínimo 2 caracteres'),
      city: z.string().min(2, 'Cidade deve ter no mínimo 2 caracteres'),
      state: z.string().length(2, 'Estado deve ter 2 caracteres'),
      zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'CEP deve estar no formato XXXXX-XXX')
    })
  })
});

export const updatePartnerSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').regex(/^[a-zA-ZÀ-ÿ\s0-9&\-'.]+$/, 'Nome deve conter apenas letras, números, espaços e caracteres especiais comuns').optional(),
    email: z.string().trim().email('Email inválido').optional(),
    phone: z.string().regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/, 'Telefone deve estar no formato (XX) XXXXX-XXXX').optional(),
    document: z.string().min(11, 'Documento deve ter no mínimo 11 caracteres').max(18, 'Documento deve ter no máximo 18 caracteres').optional(),
    documentType: z.enum(['CPF', 'CNPJ']).optional(),
    description: z.string().max(500, 'Descrição deve ter no máximo 500 caracteres').optional(),
    logo: z.string().url('Logo deve ser uma URL válida').optional(),
    isActive: z.boolean().optional()
  }).refine(
    (data) => {
      // If document is provided, documentType must also be provided
      if (data.document && !data.documentType) {
        return false;
      }
      return true;
    },
    {
      message: 'Tipo de documento é obrigatório quando documento é fornecido',
      path: ['documentType'],
    }
  )
});

export const partnerParamsSchema = z.object({
  params: z.object({
    id: z.string().cuid('ID do parceiro inválido')
  })
});

export type CreatePartnerInput = z.infer<typeof createPartnerSchema>['body'];
export type UpdatePartnerInput = z.infer<typeof updatePartnerSchema>['body'];
export type PartnerParamsInput = z.infer<typeof partnerParamsSchema>['params'];