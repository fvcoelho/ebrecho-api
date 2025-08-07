import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        name: string;
        partnerId?: string;
        promoter?: {
          id: string;
          tier: string;
          isActive: boolean;
        };
      };
    }
  }
}

export const requirePromoterRole = (req: Request, res: Response, next: NextFunction) => {
  console.log('🔐 Checking promoter role:', {
    userId: req.user?.id,
    userRole: req.user?.role,
    hasPromoter: !!req.user?.promoter
  });

  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  // Check if user has PROMOTER role or PARTNER_PROMOTER role
  const allowedRoles: UserRole[] = ['PROMOTER', 'PARTNER_PROMOTER', 'ADMIN'];
  
  if (!allowedRoles.includes(req.user.role)) {
    console.warn('❌ Access denied - insufficient role:', {
      userId: req.user.id,
      userRole: req.user.role,
      requiredRoles: allowedRoles
    });
    
    return res.status(403).json({
      success: false,
      error: 'Promoter access required. This feature is only available to promoters.'
    });
  }

  // Additional check for active promoter status
  if (req.user.role === 'PROMOTER' && req.user.promoter) {
    if (!req.user.promoter.isActive) {
      console.warn('❌ Access denied - inactive promoter:', {
        userId: req.user.id,
        promoterId: req.user.promoter.id
      });
      
      return res.status(403).json({
        success: false,
        error: 'Promoter account is inactive. Please contact support.'
      });
    }
  }

  console.log('✅ Promoter access granted:', {
    userId: req.user.id,
    userRole: req.user.role
  });

  next();
};

export const requireAdminRole = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      success: false,
      error: 'Admin access required'
    });
  }

  next();
};

export const requirePartnerRole = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  const allowedRoles: UserRole[] = ['PARTNER_ADMIN', 'PARTNER_USER', 'ADMIN'];
  
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'Partner access required'
    });
  }

  next();
};

export const requireOwnershipOrAdmin = (
  getResourceOwnerId: (req: Request) => string | undefined
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Admin can access everything
    if (req.user.role === 'ADMIN') {
      return next();
    }

    const resourceOwnerId = getResourceOwnerId(req);
    
    if (!resourceOwnerId) {
      return res.status(400).json({
        success: false,
        error: 'Resource owner cannot be determined'
      });
    }

    // Check if user owns the resource
    if (req.user.id !== resourceOwnerId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You can only access your own resources.'
      });
    }

    next();
  };
};

export const authorize = (roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};