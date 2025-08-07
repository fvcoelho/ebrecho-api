import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../types';

export const createCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      email,
      name,
      phone,
      cpf,
      dateOfBirth,
      preferredPayment
    } = req.body;

    // Check if customer already exists
    const existingCustomer = await prisma.customer.findFirst({
      where: {
        OR: [
          { email },
          ...(cpf ? [{ cpf }] : [])
        ]
      }
    });

    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        error: 'Customer with this email or CPF already exists'
      });
    }

    const customer = await prisma.customer.create({
      data: {
        email,
        name,
        phone,
        cpf,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        preferredPayment
      }
    });

    res.status(201).json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error creating customer:', error);
    next(error);
  }
};

export const getCustomers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role, partnerId } = req.user!;
    
    const {
      page = '1',
      limit = '20',
      search,
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
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
        { cpf: { contains: search as string, mode: 'insensitive' } }
      ];
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    // For partner users, only show customers who have made orders with them
    if (role !== 'ADMIN' && partnerId) {
      where.orders = {
        some: {
          partnerId
        }
      };
    }

    const [customers, totalCount] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: pageLimit,
        orderBy: {
          [sortBy as string]: sortOrder as 'asc' | 'desc'
        },
        include: {
          addresses: true,
          _count: {
            select: {
              orders: true,
              wishlist: true
            }
          }
        }
      }),
      prisma.customer.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / pageLimit);

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          page: pageNumber,
          limit: pageLimit,
          total: totalCount,
          totalPages
        }
      }
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    next(error);
  }
};

export const getCustomerById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { role, partnerId } = req.user!;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: true,
        orders: {
          take: 10,
          orderBy: {
            createdAt: 'desc'
          },
          include: {
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
                    name: true,
                    price: true
                  }
                }
              }
            }
          }
        },
        wishlist: {
          include: {
            product: {
              include: {
                images: {
                  take: 1,
                  orderBy: {
                    order: 'asc'
                  }
                },
                partner: {
                  select: {
                    id: true,
                    name: true
                  }
                }
              }
            }
          }
        },
        _count: {
          select: {
            orders: true,
            wishlist: true
          }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // For partner users, check if customer has orders with them
    if (role !== 'ADMIN' && partnerId) {
      const hasOrderWithPartner = customer.orders.some(
        order => order.partnerId === partnerId
      );

      if (!hasOrderWithPartner) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }
    }

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    next(error);
  }
};

export const updateCustomer = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { role } = req.user!;

    // Only admins can update customers
    if (role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    const {
      name,
      phone,
      cpf,
      dateOfBirth,
      preferredPayment,
      isActive
    } = req.body;

    // Check if CPF is already taken by another customer
    if (cpf) {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          cpf,
          NOT: { id }
        }
      });

      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          error: 'CPF already registered to another customer'
        });
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name,
        phone,
        cpf,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        preferredPayment,
        isActive
      },
      include: {
        addresses: true,
        _count: {
          select: {
            orders: true,
            wishlist: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error updating customer:', error);
    next(error);
  }
};

export const createCustomerAddress = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { customerId } = req.params;
    const {
      nickname,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      zipCode,
      isDefault
    } = req.body;

    // Check if customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: {
          customerId,
          isDefault: true
        },
        data: {
          isDefault: false
        }
      });
    }

    const address = await prisma.customerAddress.create({
      data: {
        customerId,
        nickname,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        zipCode,
        isDefault: isDefault || false
      }
    });

    res.status(201).json({
      success: true,
      data: address
    });
  } catch (error) {
    console.error('Error creating customer address:', error);
    next(error);
  }
};

export const updateCustomerAddress = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { customerId, addressId } = req.params;
    const {
      nickname,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      zipCode,
      isDefault
    } = req.body;

    // Check if address exists and belongs to customer
    const existingAddress = await prisma.customerAddress.findFirst({
      where: {
        id: addressId,
        customerId
      }
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        error: 'Address not found'
      });
    }

    // If setting as default, unset other defaults
    if (isDefault && !existingAddress.isDefault) {
      await prisma.customerAddress.updateMany({
        where: {
          customerId,
          isDefault: true,
          NOT: { id: addressId }
        },
        data: {
          isDefault: false
        }
      });
    }

    const address = await prisma.customerAddress.update({
      where: { id: addressId },
      data: {
        nickname,
        street,
        number,
        complement,
        neighborhood,
        city,
        state,
        zipCode,
        isDefault
      }
    });

    res.json({
      success: true,
      data: address
    });
  } catch (error) {
    console.error('Error updating customer address:', error);
    next(error);
  }
};

export const deleteCustomerAddress = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { customerId, addressId } = req.params;

    // Check if address exists and belongs to customer
    const address = await prisma.customerAddress.findFirst({
      where: {
        id: addressId,
        customerId
      }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        error: 'Address not found'
      });
    }

    await prisma.customerAddress.delete({
      where: { id: addressId }
    });

    res.json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting customer address:', error);
    next(error);
  }
};

export const getCustomerStats = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role, partnerId } = req.user!;
    const { startDate, endDate } = req.query;

    const where: any = {};

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate as string);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate as string);
      }
    }

    // For partner users, only count customers who have made orders with them
    if (role !== 'ADMIN' && partnerId) {
      where.orders = {
        some: {
          partnerId
        }
      };
    }

    const [
      totalCustomers,
      activeCustomers,
      newCustomers,
      topCustomers
    ] = await Promise.all([
      // Total customers
      prisma.customer.count({ where }),
      
      // Active customers (with recent orders)
      prisma.customer.count({
        where: {
          ...where,
          orders: {
            some: {
              createdAt: {
                gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) // Last 90 days
              },
              ...(role !== 'ADMIN' && partnerId ? { partnerId } : {})
            }
          }
        }
      }),
      
      // New customers this period
      prisma.customer.count({
        where: {
          createdAt: where.createdAt || {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      }),
      
      // Top customers by order value
      prisma.customer.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          orders: {
            where: {
              status: 'DELIVERED',
              ...(role !== 'ADMIN' && partnerId ? { partnerId } : {})
            },
            select: {
              total: true
            }
          },
          _count: {
            select: {
              orders: true
            }
          }
        },
        take: 10
      })
    ]);

    // Calculate top customers with total spent
    const topCustomersWithTotal = topCustomers
      .map(customer => ({
        id: customer.id,
        name: customer.name,
        email: customer.email,
        orderCount: customer._count.orders,
        totalSpent: customer.orders.reduce((sum, order) => sum + Number(order.total), 0)
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);

    res.json({
      success: true,
      data: {
        totalCustomers,
        activeCustomers,
        newCustomers,
        topCustomers: topCustomersWithTotal
      }
    });
  } catch (error) {
    console.error('Error fetching customer stats:', error);
    next(error);
  }
};