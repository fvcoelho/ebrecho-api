import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Email inválido'),
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  }),
});

export const registerSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Email inválido'),
    password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').regex(/^[a-zA-ZÀ-ÿ\s0-9]+$/, 'Nome deve conter apenas letras, números e espaços'),
    role: z.enum(['CUSTOMER', 'PARTNER_ADMIN', 'PARTNER_USER', 'PROMOTER']).optional(),
    partnerId: z.string().optional(),
  }),
});

export const updateProfileSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').regex(/^[a-zA-ZÀ-ÿ\s0-9]+$/, 'Nome deve conter apenas letras, números e espaços').optional(),
    currentPassword: z.string().optional(),
    newPassword: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres').optional(),
  }).refine(
    (data) => {
      if (data.newPassword) {
        return !!data.currentPassword;
      }
      return true;
    },
    {
      message: 'Senha atual é obrigatória para alterar a senha',
      path: ['currentPassword'],
    }
  ),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token é obrigatório'),
  }),
});

export const resendVerificationSchema = z.object({
  body: z.object({
    email: z.string().trim().email('Email inválido'),
  }),
});

export type LoginInput = z.infer<typeof loginSchema>['body'];
export type RegisterInput = z.infer<typeof registerSchema>['body'];
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>['body'];
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>['body'];
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>['body'];