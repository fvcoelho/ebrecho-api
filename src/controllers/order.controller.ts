import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../types';
import { Decimal } from '@prisma/client/runtime/library';

// Generate unique order number
function generateOrderNumber(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD${year}${month}${day}${random}`;
}

export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      customerId,
      partnerId,
      items,
      shippingAddress,
      billingAddress,
      paymentMethod,
      shippingCost = 0,
      discount = 0,
      notes
    } = req.body;

    // Validate items and calculate totals
    let subtotal = new Decimal(0);
    const orderItems = [];

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId },
        include: {
          partner: true,
          images: true
        }
      });

      if (!product) {
        return res.status(400).json({
          success: false,
          error: `Product ${item.productId} not found`
        });
      }

      if (product.status !== 'AVAILABLE') {
        return res.status(400).json({
          success: false,
          error: `Product ${product.name} is not available`
        });
      }

      if (product.partnerId !== partnerId) {
        return res.status(400).json({
          success: false,
          error: `Product ${product.name} belongs to a different partner`
        });
      }

      const itemTotal = new Decimal(product.price).mul(item.quantity);
      subtotal = subtotal.add(itemTotal);

      orderItems.push({
        productId: product.id,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal,
        productSnapshot: {
          name: product.name,
          description: product.description,
          sku: product.sku,
          category: product.category,
          brand: product.brand,
          size: product.size,
          color: product.color,
          condition: product.condition,
          images: product.images.map(img => ({
            url: img.processedUrl || img.originalUrl,
            order: img.order
          }))
        }
      });
    }

    const total = subtotal.add(shippingCost).sub(discount);

    // Create order with items in a transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create the order
      const newOrder = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          customerId,
          partnerId,
          paymentMethod,
          subtotal,
          shippingCost: new Decimal(shippingCost),
          discount: new Decimal(discount),
          total,
          shippingAddress,
          billingAddress: billingAddress || shippingAddress,
          notes,
          items: {
            create: orderItems
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          },
          customer: true,
          partner: true
        }
      });

      // Update product status to RESERVED
      await tx.product.updateMany({
        where: {
          id: { in: items.map((item: any) => item.productId) }
        },
        data: {
          status: 'RESERVED'
        }
      });

      return newOrder;
    });

    res.status(201).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    next(error);
  }
};

export const getOrders = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role, partnerId: userPartnerId } = req.user!;
    
    const {
      page = '1',
      limit = '20',
      status,
      paymentStatus,
      customerId,
      partnerId,
      startDate,
      endDate,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const pageNumber = parseInt(page as string);
    const pageLimit = parseInt(limit as string);
    const skip = (pageNumber - 1) * pageLimit;

    const where: any = {};

    // Filter by partner for non-admin users
    if (role !== 'ADMIN' && userPartnerId) {
      where.partnerId = userPartnerId;
    } else if (partnerId) {
      where.partnerId = partnerId;
    }

    if (status) {
      where.status = status;
    }

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (customerId) {
      where.customerId = customerId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take: pageLimit,
        orderBy: {
          [sortBy as string]: sortOrder as 'asc' | 'desc'
        },
        include: {
          customer: true,
          partner: {
            select: {
              id: true,
              name: true
            }
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          },
          payments: true
        }
      }),
      prisma.order.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / pageLimit);

    res.json({
      success: true,
      data: {
        orders,
        pagination: {
          page: pageNumber,
          limit: pageLimit,
          total: totalCount,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    next(error);
  }
};

export const getOrderById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { role, partnerId: userPartnerId } = req.user!;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        partner: true,
        items: {
          include: {
            product: true
          }
        },
        payments: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check permissions
    if (role !== 'ADMIN' && userPartnerId && order.partnerId !== userPartnerId) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    next(error);
  }
};

export const updateOrderStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { status, trackingCode } = req.body;
    const { role, partnerId: userPartnerId } = req.user!;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check permissions
    if (role !== 'ADMIN' && userPartnerId && order.partnerId !== userPartnerId) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const updateData: any = { status };

    // Set timestamps based on status
    switch (status) {
      case 'CONFIRMED':
        updateData.confirmedAt = new Date();
        break;
      case 'SHIPPED':
        updateData.shippedAt = new Date();
        if (trackingCode) {
          updateData.trackingCode = trackingCode;
        }
        break;
      case 'DELIVERED':
        updateData.deliveredAt = new Date();
        break;
      case 'CANCELLED':
        updateData.cancelledAt = new Date();
        break;
      case 'REFUNDED':
        updateData.refundedAt = new Date();
        break;
    }

    // Update order and handle product status in transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { id },
        data: updateData,
        include: {
          customer: true,
          partner: true,
          items: {
            include: {
              product: true
            }
          },
          payments: true
        }
      });

      // Update product status based on order status
      if (status === 'DELIVERED') {
        // Mark products as SOLD
        await tx.product.updateMany({
          where: {
            id: { in: order.items.map(item => item.productId) }
          },
          data: {
            status: 'SOLD'
          }
        });
      } else if (status === 'CANCELLED' || status === 'REFUNDED') {
        // Return products to AVAILABLE
        await tx.product.updateMany({
          where: {
            id: { in: order.items.map(item => item.productId) }
          },
          data: {
            status: 'AVAILABLE'
          }
        });
      }

      return updated;
    });

    res.json({
      success: true,
      data: updatedOrder
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    next(error);
  }
};

export const cancelOrder = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const { role, partnerId: userPartnerId } = req.user!;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true
      }
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found'
      });
    }

    // Check permissions
    if (role !== 'ADMIN' && userPartnerId && order.partnerId !== userPartnerId) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    // Check if order can be cancelled
    if (['DELIVERED', 'CANCELLED', 'REFUNDED'].includes(order.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot cancel order with status ${order.status}`
      });
    }

    const cancelledOrder = await prisma.$transaction(async (tx) => {
      // Update order
      const updated = await tx.order.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          notes: order.notes ? `${order.notes}\n\nCancellation reason: ${reason}` : `Cancellation reason: ${reason}`
        },
        include: {
          customer: true,
          partner: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // Return products to AVAILABLE
      await tx.product.updateMany({
        where: {
          id: { in: order.items.map(item => item.productId) }
        },
        data: {
          status: 'AVAILABLE'
        }
      });

      return updated;
    });

    res.json({
      success: true,
      data: cancelledOrder
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    next(error);
  }
};

export const getOrderStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role, partnerId: userPartnerId } = req.user!;
    const { partnerId, startDate, endDate } = req.query;

    const where: any = {};

    // Filter by partner for non-admin users
    if (role !== 'ADMIN' && userPartnerId) {
      where.partnerId = userPartnerId;
    } else if (partnerId) {
      where.partnerId = partnerId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    const [
      totalOrders,
      ordersByStatus,
      totalRevenue,
      averageOrderValue,
      topProducts
    ] = await Promise.all([
      // Total orders
      prisma.order.count({ where }),
      
      // Orders by status
      prisma.order.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      
      // Total revenue (completed orders)
      prisma.order.aggregate({
        where: {
          ...where,
          status: 'DELIVERED'
        },
        _sum: { total: true }
      }),
      
      // Average order value
      prisma.order.aggregate({
        where: {
          ...where,
          status: 'DELIVERED'
        },
        _avg: { total: true }
      }),
      
      // Top selling products
      prisma.orderItem.groupBy({
        by: ['productId'],
        where: {
          order: {
            ...where,
            status: 'DELIVERED'
          }
        },
        _count: { productId: true },
        _sum: { totalPrice: true },
        orderBy: {
          _count: {
            productId: 'desc'
          }
        },
        take: 10
      })
    ]);

    // Get product details for top products
    const topProductDetails = await Promise.all(
      topProducts.map(async (item) => {
        const product = await prisma.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            name: true,
            category: true,
            price: true
          }
        });
        return {
          product,
          unitsSold: item._count.productId,
          revenue: item._sum.totalPrice
        };
      })
    );

    res.json({
      success: true,
      data: {
        totalOrders,
        ordersByStatus: ordersByStatus.reduce((acc, item) => {
          acc[item.status] = item._count.status;
          return acc;
        }, {} as Record<string, number>),
        totalRevenue: totalRevenue._sum.total || 0,
        averageOrderValue: averageOrderValue._avg.total || 0,
        topProducts: topProductDetails
      }
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    next(error);
  }
};