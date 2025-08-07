import { Request, Response } from 'express';
import { prisma } from '../../prisma';

// Get public store data by slug
export const getPublicStoreBySlug = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    console.log('[DEBUG] getPublicStoreBySlug called with slug:', slug);
    
    if (!slug) {
      console.log('[DEBUG] No slug provided');
      return res.status(400).json({
        success: false,
        error: 'Slug is required'
      });
    }

    console.log('[DEBUG] Searching for store with conditions:', {
      slug: slug.toLowerCase(),
      isActive: true,
      isPublicActive: true
    });

    // Find store by slug that is active and public
    const store = await prisma.partner.findFirst({
      where: {
        slug: slug.toLowerCase(),
        isActive: true,
        isPublicActive: true
      },
      select: {
        id: true,
        slug: true,
        name: true,
        publicDescription: true,
        publicBanner: true,
        publicLogo: true,
        whatsappNumber: true,
        publicEmail: true,
        businessHours: true,
        socialLinks: true,
        address: {
          select: {
            street: true,
            number: true,
            complement: true,
            neighborhood: true,
            city: true,
            state: true,
            zipCode: true
          }
        },
        _count: {
          select: {
            products: {
              where: {
                isPublicVisible: true,
                status: 'AVAILABLE'
              }
            }
          }
        },
        createdAt: true
      }
    });

    console.log('[DEBUG] Database query result:', store);

    if (!store) {
      console.log('[DEBUG] Store not found in database');
      
      // Let's also check if the store exists but doesn't meet the conditions
      const storeCheck = await prisma.partner.findFirst({
        where: {
          slug: slug.toLowerCase()
        },
        select: {
          id: true,
          slug: true,
          name: true,
          isActive: true,
          isPublicActive: true
        }
      });
      
      console.log('[DEBUG] Store exists check:', storeCheck);
      
      return res.status(404).json({
        success: false,
        error: 'Store not found'
      });
    }

    console.log('[DEBUG] Store found:', store.name, 'ID:', store.id);

    // Format response
    const publicStore = {
      ...store,
      productCount: store._count.products,
      _count: undefined,
      address: store.address ? {
        street: store.address.street,
        number: store.address.number,
        complement: store.address.complement,
        neighborhood: store.address.neighborhood,
        city: store.address.city,
        state: store.address.state,
        zipCode: store.address.zipCode
      } : undefined
    };

    console.log('[DEBUG] Sending response:', JSON.stringify(publicStore, null, 2));

    res.json({
      success: true,
      data: publicStore
    });

  } catch (error) {
    console.error('Error fetching public store:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Get store categories
export const getStoreCategories = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;

    // First verify the store exists and is public
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

    // Get categories with product counts
    const categories = await prisma.product.groupBy({
      by: ['category'],
      where: {
        partnerId: store.id,
        isPublicVisible: true,
        status: 'AVAILABLE'
      },
      _count: {
        category: true
      },
      orderBy: {
        _count: {
          category: 'desc'
        }
      }
    });

    const formattedCategories = categories.map(cat => ({
      name: cat.category,
      count: cat._count.category
    }));

    res.json({
      success: true,
      data: formattedCategories
    });

  } catch (error) {
    console.error('Error fetching store categories:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Register store view (analytics)
export const registerStoreView = async (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const { referrer, userAgent } = req.body;

    // Verify store exists
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

    // TODO: Implement analytics tracking
    // For now, just return success
    res.json({
      success: true,
      message: 'View registered'
    });

  } catch (error) {
    console.error('Error registering store view:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};