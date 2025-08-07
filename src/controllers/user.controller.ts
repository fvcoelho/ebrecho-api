import { Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../types';
import bcrypt from 'bcryptjs';

export const getUsers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role } = req.user!;
    
    // Only admins can list all users
    if (role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const {
      page = '1',
      limit = '20',
      search,
      userRole,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNumber = parseInt(page as string);
    const pageLimit = parseInt(limit as string);
    const skip = (pageNumber - 1) * pageLimit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (userRole) {
      where.role = userRole;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const [users, totalCount] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: pageLimit,
        orderBy: {
          [sortBy as string]: sortOrder as 'asc' | 'desc'
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          emailVerified: true,
          partnerId: true,
          partner: {
            select: {
              id: true,
              name: true
            }
          },
          promoter: {
            select: {
              id: true,
              businessName: true,
              tier: true
            }
          },
          createdAt: true,
          updatedAt: true
        }
      }),
      prisma.user.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / pageLimit);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: pageNumber,
          limit: pageLimit,
          total: totalCount,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    next(error);
  }
};

export const getUserById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { role, id: currentUserId } = req.user!;
    
    // Users can view their own profile, admins can view any
    if (role !== 'ADMIN' && id !== currentUserId) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
        partnerId: true,
        partner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        promoter: {
          include: {
            _count: {
              select: {
                invitations: true,
                commissions: true
              }
            }
          }
        },
        createdAt: true,
        updatedAt: true
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    next(error);
  }
};

export const createUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role } = req.user!;
    
    // Only admins can create users
    if (role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const {
      email,
      password,
      name,
      userRole = 'CUSTOMER',
      partnerId,
      isActive = true
    } = req.body;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: userRole,
        partnerId,
        isActive,
        emailVerified: true // Admin-created users are pre-verified
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
        partnerId: true,
        createdAt: true
      }
    });

    res.status(201).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error creating user:', error);
    next(error);
  }
};

export const updateUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { role, id: currentUserId } = req.user!;
    
    // Users can update their own profile, admins can update any
    if (role !== 'ADMIN' && id !== currentUserId) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const {
      name,
      password,
      userRole,
      partnerId,
      isActive
    } = req.body;

    const updateData: any = {};

    if (name) updateData.name = name;
    if (password) updateData.password = await bcrypt.hash(password, 10);
    
    // Only admins can change these fields
    if (role === 'ADMIN') {
      if (userRole) updateData.role = userRole;
      if (partnerId !== undefined) updateData.partnerId = partnerId;
      if (isActive !== undefined) updateData.isActive = isActive;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        emailVerified: true,
        partnerId: true,
        partner: {
          select: {
            id: true,
            name: true
          }
        },
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Error updating user:', error);
    next(error);
  }
};

export const deleteUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { role } = req.user!;
    
    // Only admins can delete users
    if (role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Don't allow deleting the last admin
    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN' }
      });

      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          error: 'Cannot delete the last admin user'
        });
      }
    }

    await prisma.user.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    next(error);
  }
};

export const toggleUserStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { role } = req.user!;
    
    // Only admins can toggle user status
    if (role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        updatedAt: true
      }
    });

    res.json({
      success: true,
      data: updatedUser
    });
  } catch (error) {
    console.error('Error toggling user status:', error);
    next(error);
  }
};