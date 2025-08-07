import { Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../../prisma';
import { acceptInvitationSchema } from '../../schemas/promoter.schema';

export const getInvitationDetails = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({ error: 'Invitation code is required' });
    }

    const invitation = await prisma.partnerInvitation.findUnique({
      where: { invitationCode: code },
      include: {
        promoter: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Check if invitation is expired
    if (new Date() > invitation.expiresAt) {
      await prisma.partnerInvitation.update({
        where: { id: invitation.id },
        data: { status: 'EXPIRED' },
      });
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // Check if invitation is still valid
    if (!['PENDING', 'SENT', 'VIEWED'].includes(invitation.status)) {
      return res.status(400).json({ 
        error: 'Invitation is no longer valid',
        status: invitation.status,
      });
    }

    // Mark invitation as viewed if it was only pending or sent
    if (invitation.status === 'PENDING' || invitation.status === 'SENT') {
      await prisma.partnerInvitation.update({
        where: { id: invitation.id },
        data: { 
          status: 'VIEWED',
          viewedAt: new Date(),
        },
      });
    }

    // Return invitation details without sensitive information
    res.json({
      invitation: {
        id: invitation.id,
        targetEmail: invitation.targetEmail,
        targetName: invitation.targetName,
        targetBusinessName: invitation.targetBusinessName,
        personalizedMessage: invitation.personalizedMessage,
        expiresAt: invitation.expiresAt,
        commissionPercentage: invitation.commissionPercentage,
        promoter: {
          businessName: invitation.promoter.businessName,
          territory: invitation.promoter.territory,
          specialization: invitation.promoter.specialization,
          user: invitation.promoter.user,
        },
      },
    });
  } catch (error) {
    console.error('Error getting invitation details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const acceptInvitation = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const data = acceptInvitationSchema.parse({ body: req.body }).body;

    if (!code) {
      return res.status(400).json({ error: 'Invitation code is required' });
    }

    // Get invitation details
    const invitation = await prisma.partnerInvitation.findUnique({
      where: { invitationCode: code },
      include: {
        promoter: true,
      },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    // Validate invitation
    if (new Date() > invitation.expiresAt) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    if (invitation.status !== 'VIEWED' && invitation.status !== 'SENT' && invitation.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invitation is no longer valid' });
    }

    // Check if email matches invitation
    if (data.partnerData.email !== invitation.targetEmail) {
      return res.status(400).json({ error: 'Email does not match invitation' });
    }

    // Check if email or document already exists
    const [existingPartner, existingUser] = await Promise.all([
      prisma.partner.findFirst({
        where: {
          OR: [
            { email: data.partnerData.email },
            { document: data.partnerData.document },
          ],
        },
      }),
      prisma.user.findUnique({
        where: { email: data.userData.email },
      }),
    ]);

    if (existingPartner) {
      return res.status(400).json({ 
        error: 'Partner with this email or document already exists' 
      });
    }

    if (existingUser) {
      return res.status(400).json({ 
        error: 'User with this email already exists' 
      });
    }

    // Start transaction to create partner and user
    const result = await prisma.$transaction(async (tx: any) => {
      // Hash password
      const hashedPassword = await bcrypt.hash(data.userData.password, 10);

      // Create partner
      const partner = await tx.partner.create({
        data: {
          name: data.partnerData.name,
          email: data.partnerData.email,
          phone: data.partnerData.phone,
          document: data.partnerData.document,
          documentType: data.partnerData.documentType,
          description: data.partnerData.description,
          isActive: true, // Auto-approve invited partners
        },
      });

      // Create address
      await tx.address.create({
        data: {
          ...data.address,
          partnerId: partner.id,
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          name: data.userData.name,
          email: data.userData.email,
          password: hashedPassword,
          role: 'PARTNER_ADMIN',
          partnerId: partner.id,
          emailVerified: true, // Auto-verify invited partners
        },
      });

      // Update invitation status
      await tx.partnerInvitation.update({
        where: { id: invitation.id },
        data: {
          status: 'ACCEPTED',
          acceptedAt: new Date(),
          resultingPartnerId: partner.id,
        },
      });

      // Update promoter statistics
      await tx.promoter.update({
        where: { id: invitation.promoterId },
        data: {
          totalPartnersInvited: {
            increment: 1,
          },
          successfulInvitations: {
            increment: 1,
          },
        },
      });

      // Create initial commission record for invitation bonus
      const invitationBonus = 1500; // R$15.00 invitation bonus (placeholder)
      await tx.promoterCommission.create({
        data: {
          promoterId: invitation.promoterId,
          partnerId: partner.id,
          commissionType: 'INVITATION_BONUS',
          referenceId: invitation.id,
          amount: invitationBonus,
          percentage: 0, // Fixed amount for invitation bonus
          baseAmount: 0,
          description: `Invitation bonus for partner ${partner.name}`,
          status: 'PENDING',
        },
      });

      return { partner, user };
    });

    res.status(201).json({
      message: 'Invitation accepted successfully',
      partner: {
        id: result.partner.id,
        name: result.partner.name,
        email: result.partner.email,
      },
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error accepting invitation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const declineInvitation = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({ error: 'Invitation code is required' });
    }

    const invitation = await prisma.partnerInvitation.findUnique({
      where: { invitationCode: code },
    });

    if (!invitation) {
      return res.status(404).json({ error: 'Invitation not found' });
    }

    if (invitation.status !== 'VIEWED' && invitation.status !== 'SENT' && invitation.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invitation is no longer valid' });
    }

    await prisma.partnerInvitation.update({
      where: { id: invitation.id },
      data: {
        status: 'DECLINED',
        declinedAt: new Date(),
      },
    });

    res.json({
      message: 'Invitation declined successfully',
    });
  } catch (error) {
    console.error('Error declining invitation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};