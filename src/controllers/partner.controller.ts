import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { CreatePartnerInput, UpdatePartnerInput } from '../schemas/partner.schema';

// Create a new partner with address
export const createPartner = async (
  req: Request<{}, {}, CreatePartnerInput>,
  res: Response
) => {
  try {
    const { address, ...partnerData } = req.body;

    // Check if partner already exists (email or document)
    const existingPartner = await prisma.partner.findFirst({
      where: {
        OR: [
          { email: partnerData.email.toLowerCase() },
          { document: partnerData.document }
        ]
      }
    });

    if (existingPartner) {
      return res.status(409).json({
        success: false,
        error: 'Parceiro já existe com este email ou documento'
      });
    }

    // Create partner with address in a transaction
    const partner = await prisma.$transaction(async (tx) => {
      const newPartner = await tx.partner.create({
        data: {
          name: partnerData.name,
          email: partnerData.email.toLowerCase(),
          phone: partnerData.phone,
          document: partnerData.document,
          documentType: partnerData.documentType,
          description: partnerData.description,
          logo: partnerData.logo
        }
      });

      const newAddress = await tx.address.create({
        data: {
          street: address.street,
          number: address.number,
          complement: address.complement,
          neighborhood: address.neighborhood,
          city: address.city,
          state: address.state,
          zipCode: address.zipCode,
          partner: {
            connect: { id: newPartner.id }
          }
        }
      });

      return tx.partner.findUnique({
        where: { id: newPartner.id },
        include: { address: true }
      });
    });

    res.status(201).json({
      success: true,
      data: partner
    });

  } catch (error: any) {
    console.error('Create partner error:', error);
    
    // Handle Prisma validation errors
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Email ou documento já está em uso'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

// Get all partners
export const getPartners = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const where = {
      isActive: req.query.includeInactive !== 'true' ? true : undefined
    };

    const [partners, total] = await Promise.all([
      prisma.partner.findMany({
        where,
        include: {
          address: true,
          _count: {
            select: {
              users: true,
              products: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.partner.count({ where })
    ]);

    res.json({
      success: true,
      data: {
        partners,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get partners error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

// Get partner by ID
export const getPartnerById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const partner = await prisma.partner.findFirst({
      where: { 
        id,
        isActive: true
      },
      include: {
        address: true,
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isActive: true
          }
        },
        products: {
          select: {
            id: true,
            name: true,
            price: true,
            status: true,
            condition: true
          },
          where: { status: 'AVAILABLE' },
          take: 10,
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            users: true,
            products: true
          }
        }
      }
    });

    if (!partner) {
      return res.status(404).json({
        success: false,
        error: 'Parceiro não encontrado'
      });
    }

    res.json({
      success: true,
      data: partner
    });

  } catch (error) {
    console.error('Get partner by ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

// Update partner
export const updatePartner = async (
  req: Request<{ id: string }, {}, UpdatePartnerInput>,
  res: Response
) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if partner exists and is active
    const existingPartner = await prisma.partner.findFirst({
      where: { 
        id,
        isActive: true
      }
    });

    if (!existingPartner) {
      return res.status(404).json({
        success: false,
        error: 'Parceiro não encontrado'
      });
    }

    // Check for email conflicts if email is being updated
    if (updateData.email) {
      const emailConflict = await prisma.partner.findFirst({
        where: {
          email: updateData.email.toLowerCase(),
          id: { not: id }
        }
      });

      if (emailConflict) {
        return res.status(409).json({
          success: false,
          error: 'Email já está em uso por outro parceiro'
        });
      }
    }

    const partner = await prisma.partner.update({
      where: { id },
      data: {
        ...updateData,
        email: updateData.email ? updateData.email.toLowerCase() : undefined
      },
      include: { address: true }
    });

    res.json({
      success: true,
      data: partner
    });

  } catch (error: any) {
    console.error('Update partner error:', error);
    
    // Handle Prisma validation errors
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: 'Email ou documento já está em uso'
      });
    }
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: 'Parceiro não encontrado'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

// Delete partner (soft delete)
export const deletePartner = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if partner exists and is active
    const existingPartner = await prisma.partner.findFirst({
      where: { 
        id,
        isActive: true
      },
      include: {
        _count: {
          select: {
            products: { where: { status: 'AVAILABLE' } }
          }
        }
      }
    });

    if (!existingPartner) {
      return res.status(404).json({
        success: false,
        error: 'Parceiro não encontrado'
      });
    }

    // Check if partner has active products
    if (existingPartner._count.products > 0) {
      return res.status(400).json({
        success: false,
        error: 'Não é possível excluir parceiro com produtos ativos'
      });
    }

    // Soft delete the partner
    await prisma.partner.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: 'Parceiro desativado com sucesso'
    });

  } catch (error) {
    console.error('Delete partner error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};