import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { CreateAddressInput, UpdateAddressInput } from '../schemas/address.schema';

// Get address by partner ID
export const getAddressByPartnerId = async (req: Request, res: Response) => {
  try {
    const { partnerId } = req.params;

    // Check if partner exists
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return res.status(404).json({
        success: false,
        error: 'Parceiro não encontrado'
      });
    }

    const address = await prisma.address.findUnique({
      where: { partnerId },
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        error: 'Endereço não encontrado para este parceiro'
      });
    }

    res.json({
      success: true,
      data: address
    });

  } catch (error) {
    console.error('Get address by partner ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

// Create address for partner
export const createAddress = async (
  req: Request<{}, {}, CreateAddressInput>,
  res: Response
) => {
  try {
    const { partnerId, ...addressData } = req.body;

    // Check if partner exists
    const partner = await prisma.partner.findUnique({
      where: { id: partnerId }
    });

    if (!partner) {
      return res.status(404).json({
        success: false,
        error: 'Parceiro não encontrado'
      });
    }

    // Check if partner already has an address
    const existingAddress = await prisma.address.findUnique({
      where: { partnerId }
    });

    if (existingAddress) {
      return res.status(409).json({
        success: false,
        error: 'Parceiro já possui um endereço cadastrado'
      });
    }

    const address = await prisma.address.create({
      data: {
        ...addressData,
        partnerId
      } as any,
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: address
    });

  } catch (error) {
    console.error('Create address error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

// Update address
export const updateAddress = async (
  req: Request<{ id: string }, {}, UpdateAddressInput>,
  res: Response
) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if address exists
    const existingAddress = await prisma.address.findUnique({
      where: { id }
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        error: 'Endereço não encontrado'
      });
    }

    const address = await prisma.address.update({
      where: { id },
      data: updateData,
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: address
    });

  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

// Update address by partner ID
export const updateAddressByPartnerId = async (
  req: Request<{ partnerId: string }, {}, UpdateAddressInput>,
  res: Response
) => {
  try {
    const { partnerId } = req.params;
    const updateData = req.body;

    // Check if partner exists and has an address
    const address = await prisma.address.findUnique({
      where: { partnerId }
    });

    if (!address) {
      return res.status(404).json({
        success: false,
        error: 'Endereço não encontrado para este parceiro'
      });
    }

    const updatedAddress = await prisma.address.update({
      where: { partnerId },
      data: updateData,
      include: {
        partner: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: updatedAddress
    });

  } catch (error) {
    console.error('Update address by partner ID error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};

// Delete address
export const deleteAddress = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Check if address exists
    const existingAddress = await prisma.address.findUnique({
      where: { id }
    });

    if (!existingAddress) {
      return res.status(404).json({
        success: false,
        error: 'Endereço não encontrado'
      });
    }

    await prisma.address.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Endereço excluído com sucesso'
    });

  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({
      success: false,
      error: 'Erro interno do servidor'
    });
  }
};