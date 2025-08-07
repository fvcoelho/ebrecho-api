import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../types';

export const getAdminStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [
      totalUsers,
      totalPartners,
      totalProducts,
      totalSales,
      activeUsers,
      activePartners,
      newUsersThisMonth,
      newPartnersThisMonth,
      newProductsThisMonth,
      salesThisMonth,
      userGrowthLastWeek,
      partnerGrowthLastWeek,
      productsByStatus,
      usersByRole,
      topPartners
    ] = await Promise.all([
      prisma.user.count(),
      prisma.partner.count(),
      prisma.product.count(),
      prisma.product.count({ where: { status: 'SOLD' } }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.partner.count({ where: { isActive: true } }),
      prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.partner.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.product.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      prisma.product.count({ 
        where: { 
          status: 'SOLD',
          updatedAt: { gte: thirtyDaysAgo }
        } 
      }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.partner.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.product.groupBy({
        by: ['status'],
        _count: { status: true }
      }),
      prisma.user.groupBy({
        by: ['role'],
        _count: { role: true }
      }),
      prisma.partner.findMany({
        take: 5,
        orderBy: {
          products: {
            _count: 'desc'
          }
        },
        include: {
          _count: {
            select: {
              products: true
            }
          }
        }
      })
    ]);

    const totalRevenue = await prisma.product.aggregate({
      where: { status: 'SOLD' },
      _sum: { price: true }
    });

    const monthlyRevenue = await prisma.product.aggregate({
      where: { 
        status: 'SOLD',
        updatedAt: { gte: thirtyDaysAgo }
      },
      _sum: { price: true }
    });

    const userGrowthRate = totalUsers > 0 
      ? ((userGrowthLastWeek / (totalUsers - userGrowthLastWeek)) * 100).toFixed(1)
      : 0;

    const partnerGrowthRate = totalPartners > 0
      ? ((partnerGrowthLastWeek / (totalPartners - partnerGrowthLastWeek)) * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalPartners,
          totalProducts,
          totalSales,
          totalRevenue: totalRevenue._sum.price || 0,
          activeUsers,
          activePartners
        },
        monthlyMetrics: {
          newUsers: newUsersThisMonth,
          newPartners: newPartnersThisMonth,
          newProducts: newProductsThisMonth,
          sales: salesThisMonth,
          revenue: monthlyRevenue._sum.price || 0
        },
        growth: {
          userGrowthRate: Number(userGrowthRate),
          partnerGrowthRate: Number(partnerGrowthRate),
          userGrowthLastWeek,
          partnerGrowthLastWeek
        },
        distributions: {
          productsByStatus: productsByStatus.reduce((acc, item) => {
            acc[item.status] = item._count.status;
            return acc;
          }, {} as Record<string, number>),
          usersByRole: usersByRole.reduce((acc, item) => {
            acc[item.role] = item._count.role;
            return acc;
          }, {} as Record<string, number>)
        },
        topPartners: topPartners.map(partner => ({
          id: partner.id,
          name: partner.name,
          productCount: partner._count.products
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    next(error);
  }
};

export const getUserStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { period = '30d' } = req.query;
    
    const startDate = new Date();
    switch (period) {
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const userRegistrations = await prisma.user.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: startDate }
      },
      _count: { id: true }
    });

    const dailyRegistrations = userRegistrations.reduce((acc, item) => {
      const date = new Date(item.createdAt).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + item._count.id;
      return acc;
    }, {} as Record<string, number>);

    const verificationStats = await prisma.user.groupBy({
      by: ['emailVerified'],
      _count: { emailVerified: true }
    });

    const activeUserStats = await prisma.user.groupBy({
      by: ['isActive'],
      _count: { isActive: true }
    });

    res.json({
      success: true,
      data: {
        period,
        dailyRegistrations,
        verificationStats: verificationStats.reduce((acc, item) => {
          acc[item.emailVerified ? 'verified' : 'unverified'] = item._count.emailVerified;
          return acc;
        }, {} as Record<string, number>),
        activeStats: activeUserStats.reduce((acc, item) => {
          acc[item.isActive ? 'active' : 'inactive'] = item._count.isActive;
          return acc;
        }, {} as Record<string, number>)
      }
    });
  } catch (error) {
    console.error('Error fetching user stats:', error);
    next(error);
  }
};

export const getPartnerStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const partners = await prisma.partner.findMany({
      include: {
        _count: {
          select: {
            products: true,
            users: true
          }
        },
        products: {
          where: { status: 'SOLD' },
          select: { price: true }
        }
      }
    });

    const partnerStats = partners.map(partner => ({
      id: partner.id,
      name: partner.name,
      email: partner.email,
      isActive: partner.isActive,
      productCount: partner._count.products,
      userCount: partner._count.users,
      totalRevenue: partner.products.reduce((sum, product) => 
        sum + Number(product.price), 0
      ),
      createdAt: partner.createdAt
    }));

    const topPerformers = [...partnerStats]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    const averageProductsPerPartner = partnerStats.length > 0
      ? partnerStats.reduce((sum, p) => sum + p.productCount, 0) / partnerStats.length
      : 0;

    res.json({
      success: true,
      data: {
        totalPartners: partners.length,
        activePartners: partners.filter(p => p.isActive).length,
        averageProductsPerPartner: Math.round(averageProductsPerPartner),
        topPerformers,
        allPartners: partnerStats
      }
    });
  } catch (error) {
    console.error('Error fetching partner stats:', error);
    next(error);
  }
};

export const getProductStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const categoryStats = await prisma.product.groupBy({
      by: ['category'],
      _count: { category: true },
      _avg: { price: true }
    });

    const conditionStats = await prisma.product.groupBy({
      by: ['condition'],
      _count: { condition: true }
    });

    const priceRanges = await prisma.$queryRaw<Array<{range: string, count: bigint}>>`
      SELECT 
        CASE 
          WHEN price < 50 THEN '0-50'
          WHEN price < 100 THEN '50-100'
          WHEN price < 200 THEN '100-200'
          WHEN price < 500 THEN '200-500'
          ELSE '500+'
        END as range,
        COUNT(*) as count
      FROM "Product"
      GROUP BY range
      ORDER BY 
        CASE range
          WHEN '0-50' THEN 1
          WHEN '50-100' THEN 2
          WHEN '100-200' THEN 3
          WHEN '200-500' THEN 4
          ELSE 5
        END
    `;

    const topCategories = [...categoryStats]
      .sort((a, b) => b._count.category - a._count.category)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        categoryDistribution: categoryStats.map(cat => ({
          category: cat.category,
          count: cat._count.category,
          averagePrice: cat._avg.price || 0
        })),
        conditionDistribution: conditionStats.reduce((acc, item) => {
          acc[item.condition] = item._count.condition;
          return acc;
        }, {} as Record<string, number>),
        priceRanges: priceRanges.reduce((acc, item) => {
          acc[item.range] = Number(item.count);
          return acc;
        }, {} as Record<string, number>),
        topCategories
      }
    });
  } catch (error) {
    console.error('Error fetching product stats:', error);
    next(error);
  }
};

export const getSalesStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { period = '30d' } = req.query;
    
    const startDate = new Date();
    switch (period) {
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
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    const sales = await prisma.product.findMany({
      where: {
        status: 'SOLD',
        updatedAt: { gte: startDate }
      },
      select: {
        price: true,
        updatedAt: true,
        category: true,
        partner: {
          select: {
            name: true
          }
        }
      }
    });

    const dailySales = sales.reduce((acc, sale) => {
      const date = new Date(sale.updatedAt).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { count: 0, revenue: 0 };
      }
      acc[date].count += 1;
      acc[date].revenue += Number(sale.price);
      return acc;
    }, {} as Record<string, { count: number; revenue: number }>);

    const categorySales = sales.reduce((acc, sale) => {
      if (!acc[sale.category]) {
        acc[sale.category] = { count: 0, revenue: 0 };
      }
      acc[sale.category].count += 1;
      acc[sale.category].revenue += Number(sale.price);
      return acc;
    }, {} as Record<string, { count: number; revenue: number }>);

    const totalRevenue = sales.reduce((sum, sale) => sum + Number(sale.price), 0);
    const averageOrderValue = sales.length > 0 ? totalRevenue / sales.length : 0;

    res.json({
      success: true,
      data: {
        period,
        totalSales: sales.length,
        totalRevenue,
        averageOrderValue,
        dailySales,
        categorySales,
        salesTrend: Object.entries(dailySales).map(([date, data]) => ({
          date,
          ...data
        })).sort((a, b) => a.date.localeCompare(b.date))
      }
    });
  } catch (error) {
    console.error('Error fetching sales stats:', error);
    next(error);
  }
};