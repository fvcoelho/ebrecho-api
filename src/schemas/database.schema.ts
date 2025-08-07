import { z } from 'zod';

// For now, these endpoints don't require request body validation
// They are GET endpoints that return statistics

export const databaseStatsResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    database: z.object({
      provider: z.string(),
      isConnected: z.boolean(),
      connectionTime: z.string()
    }),
    totals: z.object({
      users: z.number(),
      partners: z.number(),
      products: z.number(),
      addresses: z.number()
    }),
    active: z.object({
      users: z.number(),
      verifiedUsers: z.number(),
      partners: z.number(),
      availableProducts: z.number(),
      soldProducts: z.number()
    }),
    productStatus: z.record(z.string(), z.number()),
    productCondition: z.record(z.string(), z.number()),
    userRoles: z.record(z.string(), z.number()),
    recentActivity: z.object({
      newUsers: z.number(),
      newProducts: z.number(),
      newPartners: z.number()
    }),
    timestamp: z.string()
  })
});

export const databaseHealthResponseSchema = z.object({
  success: z.boolean(),
  status: z.enum(['healthy', 'unhealthy']),
  database: z.enum(['connected', 'disconnected']),
  timestamp: z.string(),
  error: z.string().optional()
});

export type DatabaseStatsResponse = z.infer<typeof databaseStatsResponseSchema>;
export type DatabaseHealthResponse = z.infer<typeof databaseHealthResponseSchema>;