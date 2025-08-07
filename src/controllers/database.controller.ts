import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';

export const getStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('📊 Database stats endpoint called');
    console.log('Request method:', req.method);
    console.log('Request URL:', req.url);
    console.log('Request headers:', req.headers);
    
    // Get counts from all tables
    console.log('🔍 Starting database queries...');
    const [
      userCount,
      partnerCount,
      productCount,
      addressCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.partner.count(),
      prisma.product.count(),
      prisma.address.count()
    ]);
    
    console.log('📈 Basic counts retrieved:', {
      users: userCount,
      partners: partnerCount,
      products: productCount,
      addresses: addressCount
    });

    // Get additional stats
    console.log('🔍 Getting user stats...');
    const activeUsers = await prisma.user.count({
      where: { isActive: true }
    });

    const verifiedUsers = await prisma.user.count({
      where: { emailVerified: true }
    });

    console.log('👥 User stats:', { activeUsers, verifiedUsers });

    console.log('🔍 Getting partner stats...');
    const activePartners = await prisma.partner.count({
      where: { isActive: true }
    });

    console.log('🏪 Partner stats:', { activePartners });

    console.log('🔍 Getting product stats...');
    const availableProducts = await prisma.product.count({
      where: { status: 'AVAILABLE' }
    });

    const soldProducts = await prisma.product.count({
      where: { status: 'SOLD' }
    });

    console.log('📦 Product stats:', { availableProducts, soldProducts });

    // Get product stats by status
    console.log('🔍 Getting product status breakdown...');
    const productStats = await prisma.product.groupBy({
      by: ['status'],
      _count: {
        status: true
      }
    });

    // Format product stats
    const productStatusBreakdown = productStats.reduce((acc, stat) => {
      acc[stat.status] = stat._count.status;
      return acc;
    }, {} as Record<string, number>);

    console.log('📊 Product status breakdown:', productStatusBreakdown);

    // Get product stats by condition
    console.log('🔍 Getting product condition breakdown...');
    const productConditionStats = await prisma.product.groupBy({
      by: ['condition'],
      _count: {
        condition: true
      }
    });

    // Format condition stats
    const productConditionBreakdown = productConditionStats.reduce((acc, stat) => {
      acc[stat.condition] = stat._count.condition;
      return acc;
    }, {} as Record<string, number>);

    console.log('📊 Product condition breakdown:', productConditionBreakdown);

    // Get user role distribution
    console.log('🔍 Getting user role distribution...');
    const userRoleStats = await prisma.user.groupBy({
      by: ['role'],
      _count: {
        role: true
      }
    });

    // Format user role stats
    const userRoleBreakdown = userRoleStats.reduce((acc, stat) => {
      acc[stat.role] = stat._count.role;
      return acc;
    }, {} as Record<string, number>);

    console.log('👥 User role breakdown:', userRoleBreakdown);

    // Get recent activity (last 24 hours)
    console.log('🔍 Getting recent activity (last 24 hours)...');
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    console.log('⏰ Checking activity since:', twentyFourHoursAgo.toISOString());

    const recentActivity = {
      newUsers: await prisma.user.count({
        where: {
          createdAt: {
            gte: twentyFourHoursAgo
          }
        }
      }),
      newProducts: await prisma.product.count({
        where: {
          createdAt: {
            gte: twentyFourHoursAgo
          }
        }
      }),
      newPartners: await prisma.partner.count({
        where: {
          createdAt: {
            gte: twentyFourHoursAgo
          }
        }
      })
    };

    console.log('🆕 Recent activity:', recentActivity);

    // Database connection info
    console.log('🔍 Preparing database connection info...');
    const databaseInfo = {
      provider: 'PostgreSQL',
      isConnected: true,
      connectionTime: new Date().toISOString()
    };

    console.log('📊 Compiling final stats response...');
    const stats = {
      success: true,
      data: {
        database: databaseInfo,
        totals: {
          users: userCount,
          partners: partnerCount,
          products: productCount,
          addresses: addressCount
        },
        active: {
          users: activeUsers,
          verifiedUsers: verifiedUsers,
          partners: activePartners,
          availableProducts: availableProducts,
          soldProducts: soldProducts
        },
        productStatus: productStatusBreakdown,
        productCondition: productConditionBreakdown,
        userRoles: userRoleBreakdown,
        recentActivity: recentActivity,
        timestamp: new Date().toISOString()
      }
    };

    console.log('✅ Database stats compiled successfully');
    console.log('📤 Sending response with stats data');
    res.json(stats);
  } catch (error) {
    console.error('❌ Error fetching database stats:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type'
    });
    next(error);
  }
};

export const checkHealth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Try to execute a simple query
    await prisma.$queryRaw`SELECT 1`;
    
    res.json({
      success: true,
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      success: false,
      status: 'unhealthy',
      database: 'disconnected',
      error: 'Database connection failed',
      timestamp: new Date().toISOString()
    });
  }
};