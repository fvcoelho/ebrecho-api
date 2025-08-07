import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

// Middleware to check if user has PROMOTER role
export const promoterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        promoter: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.role !== 'PROMOTER' && user.role !== 'PARTNER_PROMOTER') {
      return res.status(403).json({ error: 'Access denied. PROMOTER or PARTNER_PROMOTER role required.' });
    }

    if (!user.promoter) {
      return res.status(403).json({ error: 'Promoter profile not found' });
    }

    if (!user.promoter.isActive) {
      return res.status(403).json({ error: 'Promoter account is not active' });
    }

    // Add promoter info to request for easy access
    req.promoter = {
      ...user.promoter,
      commissionRate: user.promoter.commissionRate.toNumber(),
      totalCommissionsEarned: user.promoter.totalCommissionsEarned.toNumber()
    };

    next();
  } catch (error) {
    console.error('Error in promoter middleware:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to check if user can apply for PROMOTER role
export const canApplyPromoterMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        promoter: true,
      },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Check if user already has a promoter profile
    if (user.promoter) {
      return res.status(400).json({ 
        error: 'User already has a promoter profile' 
      });
    }

    // Partners (PARTNER_USER) cannot become promoters, only PARTNER_ADMIN can
    if (user.role === 'PARTNER_USER') {
      return res.status(403).json({ 
        error: 'Only partner administrators can apply to become promoters' 
      });
    }

    // PARTNER_ADMIN can become PARTNER_PROMOTER
    // CUSTOMER can become PROMOTER
    // ADMIN doesn't need to apply (has full access)

    next();
  } catch (error) {
    console.error('Error in can apply promoter middleware:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Extend Request interface to include promoter
declare global {
  namespace Express {
    interface Request {
      promoter?: {
        id: string;
        userId: string;
        businessName: string;
        commissionRate: number;
        tier: string;
        invitationQuota: number;
        invitationsUsed: number;
        totalCommissionsEarned: number;
        totalPartnersInvited: number;
        successfulInvitations: number;
        isActive: boolean;
        approvedAt: Date | null;
        territory: string | null;
        specialization: string | null;
        createdAt: Date;
        updatedAt: Date;
      };
    }
  }
}