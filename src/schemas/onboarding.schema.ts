import { z } from 'zod';

const addressSchema = z.object({
  street: z
    .string()
    .min(3, 'Rua deve ter pelo menos 3 caracteres')
    .max(100, 'Rua deve ter no máximo 100 caracteres'),
  number: z
    .string()
    .min(1, 'Número é obrigatório')
    .max(10, 'Número deve ter no máximo 10 caracteres'),
  complement: z
    .string()
    .max(50, 'Complemento deve ter no máximo 50 caracteres')
    .optional(),
  neighborhood: z
    .string()
    .min(2, 'Bairro deve ter pelo menos 2 caracteres')
    .max(50, 'Bairro deve ter no máximo 50 caracteres'),
  city: z
    .string()
    .min(2, 'Cidade deve ter pelo menos 2 caracteres')
    .max(50, 'Cidade deve ter no máximo 50 caracteres'),
  state: z
    .string()
    .length(2, 'Estado deve ter exatamente 2 caracteres')
    .regex(/^[A-Z]{2}$/, 'Estado deve conter apenas letras maiúsculas'),
  zipCode: z
    .string()
    .length(8, 'CEP deve ter exatamente 8 dígitos')
    .regex(/^\d{8}$/, 'CEP deve conter apenas números')
});

export const completePartnerRegistrationSchema = z.object({
  body: z.object({
    name: z
      .string()
      .min(2, 'Nome deve ter pelo menos 2 caracteres')
      .max(100, 'Nome deve ter no máximo 100 caracteres'),
    email: z
      .string()
      .email('Email inválido')
      .max(100, 'Email deve ter no máximo 100 caracteres'),
    phone: z
      .string()
      .min(10, 'Telefone deve ter pelo menos 10 caracteres')
      .max(15, 'Telefone deve ter no máximo 15 caracteres')
      .regex(/^\d+$/, 'Telefone deve conter apenas números'),
    document: z
      .string()
      .min(11, 'Documento deve ter pelo menos 11 caracteres')
      .max(18, 'Documento deve ter no máximo 18 caracteres'),
    documentType: z
      .enum(['CPF', 'CNPJ'], {
        errorMap: () => ({ message: 'Tipo de documento deve ser CPF ou CNPJ' })
      }),
    description: z
      .string()
      .max(500, 'Descrição deve ter no máximo 500 caracteres')
      .optional(),
    hasPhysicalStore: z.boolean(),
    address: addressSchema.nullable().optional()
  }).refine((data) => {
    // If hasPhysicalStore is true, address must be provided and valid
    if (data.hasPhysicalStore) {
      return data.address !== null && data.address !== undefined;
    }
    return true;
  }, {
    message: 'Endereço é obrigatório quando a loja possui endereço físico',
    path: ['address']
  })
});