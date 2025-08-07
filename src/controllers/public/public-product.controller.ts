import { Request, Response } from 'express';
import { prisma } from '../../prisma';
import { Prisma } from '@prisma/client';

interface ProductQuery {
  page?: string;
  limit?: string;
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'popular';
  category?: string;
  search?: string;
  min_price?: string;
  max_price?: string;
}

// Get public products for a store
export const getPublicProducts = async (req: Request<{ slug: string }, {}, {}, ProductQuery>, res: Response) => {
  try {
    const { slug } = req.params;
    const {
      page = '1',
      limit = '20',
      sort = 'newest',
      category,
      search,
      min_price,
      max_price
    } = req.query;

    // Verify store exists and is public
    const store = await prisma.partner.findFirst({
      where: {
        slug: slug.toLowerCase(),
        isActive: true,
        isPublicActive: true
      },
      select: {
        id: true
      }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Build query conditions
    const where: Prisma.ProductWhereInput = {
      partnerId: store.id,
      isPublicVisible: true,
      status: 'AVAILABLE'
    };

    // Category filter
    if (category) {
      where.category = category;
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { publicTags: { has: search.toLowerCase() } }
      ];
    }

    // Price filters
    if (min_price || max_price) {
      where.price = {};
      if (min_price) {
        where.price.gte = parseFloat(min_price);
      }
      if (max_price) {
        where.price.lte = parseFloat(max_price);
      }
    }

    // Sorting
    let orderBy: Prisma.ProductOrderByWithRelationInput = {};
    switch (sort) {
      case 'price_asc':
        orderBy = { price: 'asc' };
        break;
      case 'price_desc':
        orderBy = { price: 'desc' };
        break;
      case 'popular':
        orderBy = { viewCount: 'desc' };
        break;
      case 'newest':
      default:
        orderBy = { createdAt: 'desc' };
        break;
    }

    // Pagination
    const pageNumber = parseInt(page);
    const pageLimit = Math.min(parseInt(limit), 100); // Max 100 items per page
    const skip = (pageNumber - 1) * pageLimit;

    // Execute queries
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: pageLimit,
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          price: true,
          category: true,
          size: true,
          condition: true,
          viewCount: true,
          publicTags: true,
          images: {
            orderBy: { order: 'asc' },
            select: {
              id: true,
              thumbnailUrl: true,
              processedUrl: true,
              originalUrl: true,
              order: true
            }
          },
          createdAt: true
        }
      }),
      prisma.product.count({ where })
    ]);

    // Format response
    const formattedProducts = products.map(product => ({
      ...product,
      price: product.price.toNumber(),
      isAvailable: true
    }));

    res.json({
      success: true,
      data: {
        products: formattedProducts,
        pagination: {
          page: pageNumber,
          limit: pageLimit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / pageLimit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching public products:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get single product by slug
export const getPublicProductBySlug = async (req: Request, res: Response) => {
  try {
    const { slug: storeSlug, productSlug } = req.params;

    // Verify store exists
    const store = await prisma.partner.findFirst({
      where: {
        slug: storeSlug.toLowerCase(),
        isActive: true,
        isPublicActive: true
      },
      select: {
        id: true
      }
    });

    if (!store) {
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    // Get product with view count increment
    const product = await prisma.product.findFirst({
      where: {
        partnerId: store.id,
        slug: productSlug,
        isPublicVisible: true,
        status: 'AVAILABLE'
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        price: true,
        sku: true,
        category: true,
        brand: true,
        size: true,
        color: true,
        condition: true,
        viewCount: true,
        publicTags: true,
        images: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            thumbnailUrl: true,
            processedUrl: true,
            originalUrl: true,
            order: true
          }
        },
        createdAt: true,
        updatedAt: true
      }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Increment view count asynchronously
    prisma.product.update({
      where: { id: product.id },
      data: { viewCount: { increment: 1 } }
    }).catch(err => console.error('Error incrementing view count:', err));

    // Get related products
    const relatedProducts = await prisma.product.findMany({
      where: {
        partnerId: store.id,
        category: product.category,
        id: { not: product.id },
        isPublicVisible: true,
        status: 'AVAILABLE'
      },
      take: 4,
      orderBy: { viewCount: 'desc' },
      select: {
        id: true,
        slug: true,
        name: true,
        price: true,
        images: {
          take: 1,
          orderBy: { order: 'asc' },
          select: {
            thumbnailUrl: true
          }
        }
      }
    });

    const formattedProduct = {
      ...product,
      price: product.price.toNumber(),
      isAvailable: true
    };

    const formattedRelated = relatedProducts.map(p => ({
      ...p,
      price: p.price.toNumber()
    }));

    res.json({
      success: true,
      data: {
        product: formattedProduct,
        relatedProducts: formattedRelated
      }
    });

  } catch (error) {
    console.error('Error fetching public product:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Register product view
export const registerProductView = async (req: Request, res: Response) => {
  try {
    const { slug: storeSlug, productId } = req.params;

    // This endpoint is fire-and-forget, just return success
    res.json({
      success: true,
      message: 'View registered'
    });

    // Update view count asynchronously
    prisma.product.update({
      where: { id: productId },
      data: { viewCount: { increment: 1 } }
    }).catch(err => console.error('Error updating product view count:', err));

  } catch (error) {
    console.error('Error registering product view:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};