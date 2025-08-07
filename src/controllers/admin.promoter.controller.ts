import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';

// Schema for approving promoter applications
const approvePromoterSchema = z.object({
  body: z.object({
    promoterId: z.string().cuid(),
    approved: z.boolean(),
    notes: z.string().optional(),
  }),
});

// Admin function to approve promoter applications
export const approvePromoterApplication = async (req: Request, res: Response) => {
  try {
    const { promoterId, approved, notes } = req.body;

    // Get promoter with user info
    const promoter = await prisma.promoter.findUnique({
      where: { id: promoterId },
      include: {
        user: {
          include: {
            partner: true,
          },
        },
      },
    });

    if (!promoter) {
      return res.status(404).json({ error: 'Promoter application not found' });
    }

    if (promoter.isActive) {
      return res.status(400).json({ error: 'Promoter is already active' });
    }

    if (!approved) {
      // If not approved, just update the promoter record with notes
      await prisma.promoter.update({
        where: { id: promoterId },
        data: {
          // Store notes in a field if available, or just log for now
          // metadata: {
          //   ...(promoter as any).metadata,
          //   rejectionNotes: notes,
          //   rejectedAt: new Date(),
          // },
        },
      });

      return res.json({
        message: 'Promoter application rejected',
        promoter,
      });
    }

    // Determine new role based on current role
    let newRole = promoter.user.role;
    
    if (promoter.user.role === 'PARTNER_ADMIN') {
      // Partner admin becomes partner promoter
      newRole = 'PARTNER_PROMOTER';
    } else if (promoter.user.role === 'CUSTOMER') {
      // Customer becomes regular promoter
      newRole = 'PROMOTER';
    }

    // Start transaction to update both user role and promoter status
    const result = await prisma.$transaction(async (tx) => {
      // Update user role
      const updatedUser = await tx.user.update({
        where: { id: promoter.userId },
        data: {
          role: newRole,
        },
      });

      // Activate promoter profile
      const updatedPromoter = await tx.promoter.update({
        where: { id: promoterId },
        data: {
          isActive: true,
          approvedAt: new Date(),
        },
      });

      return { updatedUser, updatedPromoter };
    });

    res.json({
      message: 'Promoter application approved successfully',
      user: {
        id: result.updatedUser.id,
        email: result.updatedUser.email,
        role: result.updatedUser.role,
      },
      promoter: result.updatedPromoter,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error approving promoter application:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all pending promoter applications
export const getPendingPromoterApplications = async (req: Request, res: Response) => {
  try {
    const pendingApplications = await prisma.promoter.findMany({
      where: {
        isActive: false,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            partner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({
      applications: pendingApplications,
      total: pendingApplications.length,
    });
  } catch (error) {
    console.error('Error getting pending promoter applications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Update promoter tier (admin only)
export const updatePromoterTier = async (req: Request, res: Response) => {
  try {
    const { promoterId, tier } = req.body;

    if (!['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'].includes(tier)) {
      return res.status(400).json({ error: 'Invalid tier' });
    }

    const promoter = await prisma.promoter.update({
      where: { id: promoterId },
      data: {
        tier,
        commissionRate: getTierCommissionRate(tier),
        invitationQuota: getTierQuota(tier),
      },
    });

    res.json({
      message: 'Promoter tier updated successfully',
      promoter,
    });
  } catch (error) {
    console.error('Error updating promoter tier:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Helper functions
function getTierCommissionRate(tier: string): number {
  switch (tier) {
    case 'BRONZE': return 0.02;
    case 'SILVER': return 0.03;
    case 'GOLD': return 0.04;
    case 'PLATINUM': return 0.05;
    default: return 0.02;
  }
}

function getTierQuota(tier: string): number {
  switch (tier) {
    case 'BRONZE': return 10;
    case 'SILVER': return 25;
    case 'GOLD': return 50;
    case 'PLATINUM': return -1; // Unlimited
    default: return 10;
  }
}