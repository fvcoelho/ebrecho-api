import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../types';
import { generateProductSlug } from '../services/slug.service';

export const createProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const partnerId = req.user!.partnerId;
    
    if (!partnerId) {
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    const {
      name,
      description,
      price,
      sku,
      category,
      brand,
      size,
      color,
      condition,
      status = 'AVAILABLE'
    } = req.body;

    // Generate unique slug for product
    const slug = generateProductSlug(name, sku);

    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        sku,
        category,
        brand,
        size,
        color,
        condition,
        status,
        partnerId,
        slug
      },
      include: {
        images: true,
        partner: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error creating product:', error);
    next(error);
  }
};

export const getProducts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const partnerId = req.user!.partnerId;
    
    if (!partnerId) {
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    const {
      page = '1',
      limit = '20',
      status,
      category,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNumber = parseInt(page as string);
    const pageLimit = parseInt(limit as string);
    const skip = (pageNumber - 1) * pageLimit;

    const where: any = { partnerId };

    if (status) {
      where.status = status;
    }

    if (category) {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { description: { contains: search as string, mode: 'insensitive' } },
        { brand: { contains: search as string, mode: 'insensitive' } },
        { sku: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        skip,
        take: pageLimit,
        orderBy: {
          [sortBy as string]: sortOrder as 'asc' | 'desc'
        },
        include: {
          images: {
            orderBy: {
              order: 'asc'
            }
          }
        }
      }),
      prisma.product.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / pageLimit);

    res.json({
      success: true,
      data: {
        products,
        pagination: {
          page: pageNumber,
          limit: pageLimit,
          total: totalCount,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    next(error);
  }
};

export const getProductById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const partnerId = req.user!.partnerId;
    
    if (!partnerId) {
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    const product = await prisma.product.findFirst({
      where: {
        id,
        partnerId
      },
      include: {
        images: {
          orderBy: {
            order: 'asc'
          }
        },
        partner: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        }
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error fetching product:', error);
    next(error);
  }
};

export const updateProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const partnerId = req.user!.partnerId;
    
    if (!partnerId) {
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    const existingProduct = await prisma.product.findFirst({
      where: { id, partnerId }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const {
      name,
      description,
      price,
      sku,
      category,
      brand,
      size,
      color,
      condition,
      status
    } = req.body;

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        description,
        price,
        sku,
        category,
        brand,
        size,
        color,
        condition,
        status
      },
      include: {
        images: {
          orderBy: {
            order: 'asc'
          }
        }
      }
    });

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error updating product:', error);
    next(error);
  }
};

export const deleteProduct = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const partnerId = req.user!.partnerId;
    
    if (!partnerId) {
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    const existingProduct = await prisma.product.findFirst({
      where: { id, partnerId }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    await prisma.product.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    next(error);
  }
};

export const getProductCategories = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const partnerId = req.user!.partnerId;
    
    if (!partnerId) {
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    const categories = await prisma.product.groupBy({
      by: ['category'],
      where: { partnerId },
      _count: { category: true },
      orderBy: {
        _count: {
          category: 'desc'
        }
      }
    });

    res.json({
      success: true,
      data: categories.map(cat => ({
        name: cat.category,
        count: cat._count.category
      }))
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    next(error);
  }
};

export const updateProductStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const partnerId = req.user!.partnerId;
    
    if (!partnerId) {
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    if (!['AVAILABLE', 'SOLD', 'RESERVED', 'INACTIVE'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    const existingProduct = await prisma.product.findFirst({
      where: { id, partnerId }
    });

    if (!existingProduct) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const product = await prisma.product.update({
      where: { id },
      data: { status },
      include: {
        images: true
      }
    });

    res.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('Error updating product status:', error);
    next(error);
  }
};