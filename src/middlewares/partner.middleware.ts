import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

// Middleware to validate that user has access to partner resources
export const validatePartnerAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!userId) {
      return res.status(401).json({ 
        success: false,
        error: 'User not authenticated' 
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        partner: {
          include: {
            address: true
          }
        }
      }
    });

    if (!user) {
      return res.status(401).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    // Check if user has partner access
    if (userRole !== 'PARTNER_ADMIN' && userRole !== 'PARTNER_USER' && userRole !== 'ADMIN') {
      return res.status(403).json({ 
        success: false,
        error: 'Access denied. Partner role required.' 
      });
    }

    // For PARTNER_ADMIN and PARTNER_USER, ensure they have a partner associated
    if ((userRole === 'PARTNER_ADMIN' || userRole === 'PARTNER_USER') && !user.partnerId) {
      return res.status(403).json({ 
        success: false,
        error: 'Partner profile not found' 
      });
    }

    // Check if partner exists and is active
    if (user.partner && !user.partner.isActive) {
      return res.status(403).json({ 
        success: false,
        error: 'Partner account is not active' 
      });
    }

    // Add partner info to request for easy access
    if (user.partner) {
      req.partner = user.partner;
    }

    next();
  } catch (error) {
    console.error('Error in partner middleware:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error' 
    });
  }
};

// Extend Request interface to include partner
declare global {
  namespace Express {
    interface Request {
      partner?: {
        id: string;
        name: string;
        email: string;
        phone: string;
        document: string;
        documentType: string;
        description: string | null;
        logo: string | null;
        isActive: boolean;
        hasPhysicalStore: boolean;
        slug: string | null;
        publicDescription: string | null;
        isPublicActive: boolean;
        publicBanner: string | null;
        publicLogo: string | null;
        whatsappNumber: string | null;
        publicEmail: string | null;
        businessHours: any;
        socialLinks: any;
        createdAt: Date;
        updatedAt: Date;
        address?: {
          id: string;
          street: string;
          number: string;
          complement: string | null;
          neighborhood: string;
          city: string;
          state: string;
          zipCode: string;
          partnerId: string;
          createdAt: Date;
          updatedAt: Date;
        } | null;
      };
    }
  }
}