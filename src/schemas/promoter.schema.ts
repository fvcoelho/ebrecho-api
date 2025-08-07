import { z } from 'zod';

// Promoter profile schemas
export const promoterApplicationSchema = z.object({
  body: z.object({
    businessName: z.string().min(2, 'Business name must be at least 2 characters'),
    territory: z.string().optional(),
    specialization: z.string().optional(),
  }),
});

export const promoterUpdateSchema = z.object({
  body: z.object({
    businessName: z.string().min(2, 'Business name must be at least 2 characters').optional(),
    territory: z.string().optional(),
    specialization: z.string().optional(),
  }),
});

// Invitation schemas
export const createInvitationSchema = z.object({
  body: z.object({
    targetEmail: z.string().email('Invalid email address'),
    targetPhone: z.string().optional(),
    targetName: z.string().optional(),
    targetBusinessName: z.string().optional(),
    personalizedMessage: z.string().max(1000, 'Message too long').optional(),
    invitationType: z.enum(['DIRECT', 'BULK', 'PUBLIC', 'CAMPAIGN']).default('DIRECT'),
    expiresAt: z.string().datetime().optional(),
  }),
});

export const updateInvitationSchema = z.object({
  body: z.object({
    personalizedMessage: z.string().max(1000, 'Message too long').optional(),
    expiresAt: z.string().datetime().optional(),
  }),
});

// Event schemas
export const createEventSchema = z.object({
  name: z.string().min(3, 'Event name must be at least 3 characters'),
  description: z.string().optional(),
  bannerImage: z.string().url().optional(),
  eventType: z.enum(['FLASH_SALE', 'SHOWCASE', 'SPOTLIGHT', 'SEASONAL', 'REGIONAL']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  timezone: z.string().default('America/Sao_Paulo'),
  isPublic: z.boolean().default(true),
  targetCategories: z.array(z.string()).default([]),
  targetRegions: z.array(z.string()).default([]),
  discountPercentage: z.number().min(0).max(100).optional(),
  minDiscountPercentage: z.number().min(0).max(100).optional(),
  maxParticipants: z.number().min(1).optional(),
  participationFee: z.number().min(0).default(0),
  commissionBonus: z.number().min(0).max(1).default(0),
  participationRequirements: z.record(z.any()).optional(),
  socialHashtag: z.string().max(100).optional(),
}).refine(data => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  return end > start;
}, {
  message: 'End date must be after start date',
  path: ['endDate'],
}).refine(data => {
  if (data.discountPercentage && data.minDiscountPercentage) {
    return data.discountPercentage >= data.minDiscountPercentage;
  }
  return true;
}, {
  message: 'Discount percentage must be greater than or equal to minimum discount',
  path: ['discountPercentage'],
});

export const updateEventSchema = z.object({
  name: z.string().min(3, 'Event name must be at least 3 characters').optional(),
  description: z.string().optional(),
  bannerImage: z.string().url().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  timezone: z.string().optional(),
  isPublic: z.boolean().optional(),
  targetCategories: z.array(z.string()).optional(),
  targetRegions: z.array(z.string()).optional(),
  discountPercentage: z.number().min(0).max(100).optional(),
  minDiscountPercentage: z.number().min(0).max(100).optional(),
  maxParticipants: z.number().min(1).optional(),
  participationFee: z.number().min(0).optional(),
  commissionBonus: z.number().min(0).max(1).optional(),
  participationRequirements: z.record(z.any()).optional(),
  socialHashtag: z.string().max(100).optional(),
});

export const eventInvitePartnersSchema = z.object({
  partnerIds: z.array(z.string().cuid()).min(1, 'At least one partner must be selected'),
  personalizedMessage: z.string().max(1000, 'Message too long').optional(),
});

// Commission schemas
export const createCommissionSchema = z.object({
  partnerId: z.string().cuid(),
  commissionType: z.enum(['INVITATION_BONUS', 'ONGOING_SALES', 'EVENT_BONUS', 'TIER_BONUS']),
  referenceId: z.string().optional(),
  amount: z.number().min(0),
  percentage: z.number().min(0).max(1),
  baseAmount: z.number().min(0),
  periodStart: z.string().datetime().optional(),
  periodEnd: z.string().datetime().optional(),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const payoutRequestSchema = z.object({
  amount: z.number().min(100, 'Minimum payout amount is R$100'),
  description: z.string().optional(),
});

// Query schemas
export const promoterInvitationsQuerySchema = z.object({
  status: z.enum(['PENDING', 'SENT', 'VIEWED', 'ACCEPTED', 'DECLINED', 'EXPIRED']).optional(),
  invitationType: z.enum(['DIRECT', 'BULK', 'PUBLIC', 'CAMPAIGN']).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  sortBy: z.enum(['createdAt', 'expiresAt', 'targetEmail']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const promoterEventsQuerySchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'ENDED', 'CANCELLED']).optional(),
  eventType: z.enum(['FLASH_SALE', 'SHOWCASE', 'SPOTLIGHT', 'SEASONAL', 'REGIONAL']).optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  sortBy: z.enum(['createdAt', 'startDate', 'endDate', 'name']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const promoterCommissionsQuerySchema = z.object({
  commissionType: z.enum(['INVITATION_BONUS', 'ONGOING_SALES', 'EVENT_BONUS', 'TIER_BONUS']).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'PAID', 'DISPUTED']).optional(),
  partnerId: z.string().cuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.string().transform(Number).default('1'),
  limit: z.string().transform(Number).default('10'),
  sortBy: z.enum(['createdAt', 'amount', 'paidAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Public invitation schemas (for invitation acceptance)
export const acceptInvitationSchema = z.object({
  body: z.object({
    partnerData: z.object({
      name: z.string().min(2, 'Partner name must be at least 2 characters'),
      email: z.string().email('Invalid email address'),
      phone: z.string().min(10, 'Phone number must be at least 10 digits'),
      document: z.string().min(11, 'Document must be at least 11 characters'),
      documentType: z.enum(['CPF', 'CNPJ']),
      description: z.string().optional(),
    }),
    userData: z.object({
      name: z.string().min(2, 'User name must be at least 2 characters'),
      email: z.string().email('Invalid email address'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    }),
    address: z.object({
      street: z.string().min(5, 'Street must be at least 5 characters'),
      number: z.string().min(1, 'Number is required'),
      complement: z.string().optional(),
      neighborhood: z.string().min(2, 'Neighborhood must be at least 2 characters'),
      city: z.string().min(2, 'City must be at least 2 characters'),
      state: z.string().length(2, 'State must be 2 characters'),
      zipCode: z.string().regex(/^\d{5}-?\d{3}$/, 'Invalid ZIP code format'),
    }),
  }),
});

// Export types
export type PromoterApplicationInput = z.infer<typeof promoterApplicationSchema>;
export type PromoterUpdateInput = z.infer<typeof promoterUpdateSchema>;
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type UpdateInvitationInput = z.infer<typeof updateInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
export type PromoterInvitationsQuery = z.infer<typeof promoterInvitationsQuerySchema>;
export type PromoterEventsQuery = z.infer<typeof promoterEventsQuerySchema>;
export type PromoterCommissionsQuery = z.infer<typeof promoterCommissionsQuerySchema>;