import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../types';
import { validateSlug } from '../services/slug.service';

export const getPartnerDashboardStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('[Dashboard] getPartnerDashboardStats called');
    console.log('[Dashboard] Request user:', JSON.stringify(req.user, null, 2));
    
    const partnerId = req.user!.partnerId;
    console.log('[Dashboard] Partner ID:', partnerId);
    
    if (!partnerId) {
      console.log('[Dashboard] No partner ID found for user');
      console.log('[Dashboard] User data:', JSON.stringify({
        userId: req.user?.userId,
        email: req.user?.email,
        role: req.user?.role,
        partnerId: req.user?.partnerId
      }, null, 2));
      
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner',
        message: 'Your authentication token may be outdated. Please complete the partner setup or log in again to refresh your token.',
        hint: 'If you just completed partner setup, the new token should be in the response. Update your authorization header with the new token.'
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    console.log('[Dashboard] Date ranges - 30 days ago:', thirtyDaysAgo, 'Seven days ago:', sevenDaysAgo);
    console.log('[Dashboard] Starting Promise.all queries...');

    const [
      totalProducts,
      availableProducts,
      soldProducts,
      reservedProducts,
      soldThisMonth,
      newProductsThisWeek,
      partner
    ] = await Promise.all([
      prisma.product.count({ where: { partnerId } }),
      prisma.product.count({ where: { partnerId, status: 'AVAILABLE' } }),
      prisma.product.count({ where: { partnerId, status: 'SOLD' } }),
      prisma.product.count({ where: { partnerId, status: 'RESERVED' } }),
      prisma.product.count({ 
        where: { 
          partnerId,
          status: 'SOLD',
          updatedAt: { gte: thirtyDaysAgo }
        } 
      }),
      prisma.product.count({
        where: {
          partnerId,
          createdAt: { gte: sevenDaysAgo }
        }
      }),
      prisma.partner.findUnique({
        where: { id: partnerId },
        include: {
          _count: {
            select: {
              users: true
            }
          }
        }
      })
    ]);

    console.log('[Dashboard] Promise.all results:', {
      totalProducts,
      availableProducts,
      soldProducts,
      reservedProducts,
      soldThisMonth,
      newProductsThisWeek,
      partnerFound: !!partner
    });

    console.log('[Dashboard] Fetching additional aggregations...');
    const monthlyRevenue = await prisma.product.aggregate({
      where: { 
        partnerId,
        status: 'SOLD',
        updatedAt: { gte: thirtyDaysAgo }
      },
      _sum: { price: true }
    });

    const totalRevenue = await prisma.product.aggregate({
      where: { 
        partnerId,
        status: 'SOLD'
      },
      _sum: { price: true }
    });

    const averageProductPrice = await prisma.product.aggregate({
      where: { partnerId },
      _avg: { price: true }
    });

    const productsByCategory = await prisma.product.groupBy({
      by: ['category'],
      where: { partnerId },
      _count: { category: true }
    });

    const productsByCondition = await prisma.product.groupBy({
      by: ['condition'],
      where: { partnerId },
      _count: { condition: true }
    });

    const recentSales = await prisma.product.findMany({
      where: {
        partnerId,
        status: 'SOLD'
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        price: true,
        updatedAt: true,
        images: true
      }
    });

    const topSellingCategories = await prisma.product.groupBy({
      by: ['category'],
      where: {
        partnerId,
        status: 'SOLD'
      },
      _count: { category: true },
      _sum: { price: true },
      orderBy: {
        _count: {
          category: 'desc'
        }
      },
      take: 5
    });

    console.log('[Dashboard] All aggregations completed successfully');
    console.log('[Dashboard] Monthly revenue sum:', monthlyRevenue._sum.price);
    console.log('[Dashboard] Total revenue sum:', totalRevenue._sum.price);
    console.log('[Dashboard] Average price:', averageProductPrice._avg.price);
    console.log('[Dashboard] Products by category count:', productsByCategory.length);
    console.log('[Dashboard] Recent sales count:', recentSales.length);
    console.log('[Dashboard] Top selling categories count:', topSellingCategories.length);

    const salesGrowth = soldThisMonth > 0 && soldProducts > soldThisMonth
      ? ((soldThisMonth / (soldProducts - soldThisMonth)) * 100).toFixed(1)
      : 0;

    console.log('[Dashboard] Sales growth calculated:', salesGrowth);
    console.log('[Dashboard] Sending response...');

    res.json({
      success: true,
      data: {
        partner: {
          name: partner?.name,
          email: partner?.email,
          userCount: partner?._count.users || 0
        },
        overview: {
          totalProducts,
          availableProducts,
          soldProducts,
          reservedProducts,
          totalRevenue: totalRevenue._sum.price || 0,
          averagePrice: averageProductPrice._avg.price || 0
        },
        monthlyMetrics: {
          soldThisMonth,
          revenue: monthlyRevenue._sum.price || 0,
          salesGrowth: Number(salesGrowth)
        },
        weeklyMetrics: {
          newProducts: newProductsThisWeek
        },
        productDistribution: {
          byCategory: productsByCategory.reduce((acc, item) => {
            acc[item.category] = item._count.category;
            return acc;
          }, {} as Record<string, number>),
          byCondition: productsByCondition.reduce((acc, item) => {
            acc[item.condition] = item._count.condition;
            return acc;
          }, {} as Record<string, number>)
        },
        topSellingCategories: topSellingCategories.map(cat => ({
          category: cat.category,
          count: cat._count.category,
          revenue: cat._sum.price || 0
        })),
        recentSales: recentSales.map(sale => ({
          id: sale.id,
          name: sale.name,
          price: sale.price,
          soldAt: sale.updatedAt,
          image: sale.images[0] || null
        }))
      }
    });
    
    console.log('[Dashboard] Response sent successfully');
  } catch (error) {
    console.error('[Dashboard] Error fetching partner dashboard stats:', error);
    console.error('[Dashboard] Error stack:', error instanceof Error ? error.stack : 'Unknown error');
    next(error);
  }
};

export const getPartnerSalesHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('[Dashboard] getPartnerSalesHistory called');
    const partnerId = req.user!.partnerId;
    const { period = '30d', page = 1, limit = 20 } = req.query;
    console.log('[Dashboard] Sales history params:', { partnerId, period, page, limit });
    
    if (!partnerId) {
      console.log('[Dashboard] No partner ID for sales history');
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    const startDate = new Date();
    switch (period as string) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      case 'all':
        startDate.setFullYear(2000);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const pageNumber = parseInt(page as string);
    const pageLimit = parseInt(limit as string);
    const skip = (pageNumber - 1) * pageLimit;

    const [sales, totalCount] = await Promise.all([
      prisma.product.findMany({
        where: {
          partnerId,
          status: 'SOLD',
          updatedAt: { gte: startDate }
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageLimit,
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          category: true,
          brand: true,
          size: true,
          color: true,
          condition: true,
          images: true,
          updatedAt: true,
          createdAt: true
        }
      }),
      prisma.product.count({
        where: {
          partnerId,
          status: 'SOLD',
          updatedAt: { gte: startDate }
        }
      })
    ]);

    const totalPages = Math.ceil(totalCount / pageLimit);

    console.log('[Dashboard] Sales history results:', { 
      salesCount: sales.length, 
      totalCount, 
      totalPages,
      period 
    });

    res.json({
      success: true,
      data: {
        sales,
        pagination: {
          page: pageNumber,
          limit: pageLimit,
          total: totalCount,
          totalPages
        },
        period
      }
    });
  } catch (error) {
    console.error('[Dashboard] Error fetching partner sales history:', error);
    console.error('[Dashboard] Sales history error stack:', error instanceof Error ? error.stack : 'Unknown error');
    next(error);
  }
};

export const getPartnerProductStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('[Dashboard] getPartnerProductStats called');
    const partnerId = req.user!.partnerId;
    console.log('[Dashboard] Product stats partner ID:', partnerId);
    
    if (!partnerId) {
      console.log('[Dashboard] No partner ID for product stats');
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    const inventoryValue = await prisma.product.aggregate({
      where: {
        partnerId,
        status: 'AVAILABLE'
      },
      _sum: { price: true },
      _avg: { price: true },
      _min: { price: true },
      _max: { price: true }
    });

    const categoryPerformance = await prisma.$queryRaw<Array<{
      category: string;
      total_products: bigint;
      available: bigint;
      sold: bigint;
      conversion_rate: number;
    }>>`
      SELECT 
        category,
        COUNT(*) as total_products,
        COUNT(CASE WHEN status = 'AVAILABLE' THEN 1 END) as available,
        COUNT(CASE WHEN status = 'SOLD' THEN 1 END) as sold,
        CASE 
          WHEN COUNT(*) > 0 THEN 
            ROUND(COUNT(CASE WHEN status = 'SOLD' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2)
          ELSE 0 
        END as conversion_rate
      FROM "Product"
      WHERE "partnerId" = ${partnerId}
      GROUP BY category
      ORDER BY conversion_rate DESC
    `;

    const ageAnalysis = await prisma.$queryRaw<Array<{
      age_group: string;
      count: bigint;
    }>>`
      SELECT 
        CASE 
          WHEN "createdAt" > CURRENT_DATE - INTERVAL '7 days' THEN '0-7 days'
          WHEN "createdAt" > CURRENT_DATE - INTERVAL '30 days' THEN '8-30 days'
          WHEN "createdAt" > CURRENT_DATE - INTERVAL '90 days' THEN '31-90 days'
          ELSE '90+ days'
        END as age_group,
        COUNT(*) as count
      FROM "Product"
      WHERE "partnerId" = ${partnerId} AND status = 'AVAILABLE'
      GROUP BY age_group
      ORDER BY 
        CASE age_group
          WHEN '0-7 days' THEN 1
          WHEN '8-30 days' THEN 2
          WHEN '31-90 days' THEN 3
          ELSE 4
        END
    `;

    const lowStockCategories = await prisma.product.groupBy({
      by: ['category'],
      where: {
        partnerId,
        status: 'AVAILABLE'
      },
      _count: { category: true },
      having: {
        category: {
          _count: {
            lte: 5
          }
        }
      }
    });

    console.log('[Dashboard] Product stats completed:', {
      inventoryValueSum: inventoryValue._sum.price,
      categoryPerformanceCount: categoryPerformance.length,
      ageAnalysisCount: ageAnalysis.length,
      lowStockCount: lowStockCategories.length
    });

    res.json({
      success: true,
      data: {
        inventory: {
          totalValue: inventoryValue._sum.price || 0,
          averagePrice: inventoryValue._avg.price || 0,
          minPrice: inventoryValue._min.price || 0,
          maxPrice: inventoryValue._max.price || 0
        },
        categoryPerformance: categoryPerformance.map(cat => ({
          category: cat.category,
          totalProducts: Number(cat.total_products),
          available: Number(cat.available),
          sold: Number(cat.sold),
          conversionRate: Number(cat.conversion_rate)
        })),
        inventoryAge: ageAnalysis.reduce((acc, item) => {
          acc[item.age_group] = Number(item.count);
          return acc;
        }, {} as Record<string, number>),
        lowStockCategories: lowStockCategories.map(cat => ({
          category: cat.category,
          count: cat._count.category
        }))
      }
    });
  } catch (error) {
    console.error('[Dashboard] Error fetching partner product stats:', error);
    console.error('[Dashboard] Product stats error stack:', error instanceof Error ? error.stack : 'Unknown error');
    next(error);
  }
};

export const getPartnerCustomerInsights = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('[Dashboard] getPartnerCustomerInsights called');
    const partnerId = req.user!.partnerId;
    console.log('[Dashboard] Customer insights partner ID:', partnerId);
    
    if (!partnerId) {
      console.log('[Dashboard] No partner ID for customer insights');
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    const bestSellingProducts = await prisma.product.findMany({
      where: {
        partnerId,
        status: 'SOLD'
      },
      orderBy: { updatedAt: 'desc' },
      take: 10,
      select: {
        name: true,
        category: true,
        price: true,
        brand: true,
        condition: true,
        updatedAt: true
      }
    });

    const categoryPreferences = await prisma.product.groupBy({
      by: ['category'],
      where: {
        partnerId,
        status: 'SOLD'
      },
      _count: { category: true },
      orderBy: {
        _count: {
          category: 'desc'
        }
      }
    });

    const pricePreferences = await prisma.$queryRaw<Array<{
      price_range: string;
      count: bigint;
    }>>`
      SELECT 
        CASE 
          WHEN price < 50 THEN 'Budget (< R$50)'
          WHEN price < 100 THEN 'Economy (R$50-100)'
          WHEN price < 200 THEN 'Mid-range (R$100-200)'
          WHEN price < 500 THEN 'Premium (R$200-500)'
          ELSE 'Luxury (R$500+)'
        END as price_range,
        COUNT(*) as count
      FROM "Product"
      WHERE "partnerId" = ${partnerId} AND status = 'SOLD'
      GROUP BY price_range
      ORDER BY 
        CASE price_range
          WHEN 'Budget (< R$50)' THEN 1
          WHEN 'Economy (R$50-100)' THEN 2
          WHEN 'Mid-range (R$100-200)' THEN 3
          WHEN 'Premium (R$200-500)' THEN 4
          ELSE 5
        END
    `;

    const brandPreferences = await prisma.product.groupBy({
      by: ['brand'],
      where: {
        partnerId,
        status: 'SOLD',
        NOT: { brand: null }
      },
      _count: { brand: true },
      orderBy: {
        _count: {
          brand: 'desc'
        }
      },
      take: 10
    });

    console.log('[Dashboard] Customer insights completed:', {
      bestSellingCount: bestSellingProducts.length,
      categoryPreferencesCount: categoryPreferences.length,
      pricePreferencesCount: pricePreferences.length,
      brandPreferencesCount: brandPreferences.length
    });

    res.json({
      success: true,
      data: {
        bestSellingProducts,
        categoryPreferences: categoryPreferences.map(cat => ({
          category: cat.category,
          count: cat._count.category
        })),
        pricePreferences: pricePreferences.reduce((acc, item) => {
          acc[item.price_range] = Number(item.count);
          return acc;
        }, {} as Record<string, number>),
        brandPreferences: brandPreferences.map(brand => ({
          brand: brand.brand,
          count: brand._count.brand
        }))
      }
    });
  } catch (error) {
    console.error('[Dashboard] Error fetching partner customer insights:', error);
    console.error('[Dashboard] Customer insights error stack:', error instanceof Error ? error.stack : 'Unknown error');
    next(error);
  }
};

export const getCurrentPartner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('[Dashboard] getCurrentPartner called');
    const partnerId = req.user!.partnerId;
    
    if (!partnerId) {
      console.log('[Dashboard] No partner ID for getCurrentPartner');
      console.log('[Dashboard] User data:', JSON.stringify({
        userId: req.user?.userId,
        email: req.user?.email,
        role: req.user?.role,
        partnerId: req.user?.partnerId
      }, null, 2));
      
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner',
        message: 'Your authentication token may be outdated. Please complete the partner setup or log in again to refresh your token.',
        hint: 'If you just completed partner setup, the new token should be in the response. Update your authorization header with the new token.'
      });
    }

    const partner = await prisma.partner.findFirst({
      where: { 
        id: partnerId,
        isActive: true
      },
      include: {
        address: true
      }
    });

    console.log('[Dashboard] Partner found:', partner);
    console.log('[Dashboard] Partner document:', partner?.document);
    console.log('[Dashboard] Partner documentType:', partner?.documentType);

    if (!partner) {
      return res.status(404).json({
        success: false,
        error: 'Partner not found'
      });
    }

    console.log('[Dashboard] Sending partner data:', JSON.stringify(partner, null, 2));

    res.json({
      success: true,
      data: partner
    });
  } catch (error) {
    console.error('[Dashboard] Error fetching current partner:', error);
    next(error);
  }
};

export const updateCurrentPartner = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('[Dashboard] updateCurrentPartner called');
    const partnerId = req.user!.partnerId;
    const updateData = req.body;
    
    if (!partnerId) {
      console.log('[Dashboard] No partner ID for updateCurrentPartner');
      console.log('[Dashboard] User data:', JSON.stringify({
        userId: req.user?.userId,
        email: req.user?.email,
        role: req.user?.role,
        partnerId: req.user?.partnerId
      }, null, 2));
      
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner',
        message: 'Your authentication token may be outdated. Please complete the partner setup or log in again to refresh your token.',
        hint: 'If you just completed partner setup, the new token should be in the response. Update your authorization header with the new token.'
      });
    }

    // Check if partner exists and is active
    const existingPartner = await prisma.partner.findFirst({
      where: { 
        id: partnerId,
        isActive: true
      }
    });

    if (!existingPartner) {
      return res.status(404).json({
        success: false,
        error: 'Partner not found'
      });
    }

    // Check for email conflicts if email is being updated
    if (updateData.email && updateData.email !== existingPartner.email) {
      const emailConflict = await prisma.partner.findFirst({
        where: {
          email: updateData.email.toLowerCase(),
          id: { not: partnerId }
        }
      });

      if (emailConflict) {
        return res.status(409).json({
          success: false,
          error: 'Email já está em uso por outro parceiro'
        });
      }
    }

    // Check for slug conflicts if slug is being updated
    if (updateData.slug && updateData.slug !== existingPartner.slug) {
      const slugValidation = await validateSlug(updateData.slug, partnerId);
      
      if (!slugValidation.valid) {
        return res.status(400).json({
          success: false,
          error: slugValidation.error
        });
      }
    }

    // Extract address data from updateData
    const { address, ...partnerData } = updateData;
    
    // Update partner data (excluding address)
    const partner = await prisma.partner.update({
      where: { id: partnerId },
      data: {
        ...partnerData,
        email: partnerData.email ? partnerData.email.toLowerCase() : undefined,
        slug: partnerData.slug ? partnerData.slug.toLowerCase() : undefined
      },
      include: { address: true }
    });

    // Handle address separately if provided
    if (address !== undefined) {
      if (address === null) {
        // Delete existing address if hasPhysicalStore is false
        await prisma.address.deleteMany({
          where: { partnerId: partnerId }
        });
      } else {
        // Create or update address
        await prisma.address.upsert({
          where: { partnerId: partnerId },
          update: {
            street: address.street,
            number: address.number,
            complement: address.complement || null,
            neighborhood: address.neighborhood,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode
          },
          create: {
            partnerId: partnerId,
            street: address.street,
            number: address.number,
            complement: address.complement || null,
            neighborhood: address.neighborhood,
            city: address.city,
            state: address.state,
            zipCode: address.zipCode
          }
        });
      }
    }

    // Fetch the updated partner with address
    const updatedPartner = await prisma.partner.findUnique({
      where: { id: partnerId },
      include: { address: true }
    });

    res.json({
      success: true,
      data: updatedPartner
    });

  } catch (error: any) {
    console.error('[Dashboard] Error updating current partner:', error);
    
    // Handle Prisma validation errors
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Email, documento ou slug já está em uso'
      });
    }
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Partner not found'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};