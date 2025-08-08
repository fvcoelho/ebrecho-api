import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../types';
import { generateToken } from '../utils/jwt.utils';

export const completePartnerRegistration = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('=== PARTNER REGISTRATION START ===');
    console.log('completePartnerRegistration: Request received');
    console.log('completePartnerRegistration: User ID:', req.user!.userId);
    console.log('completePartnerRegistration: User role:', req.user!.role);
    console.log('completePartnerRegistration: Request body:', JSON.stringify(req.body, null, 2));
    
    const userId = req.user!.userId;
    const {
      name,
      email,
      phone,
      document,
      documentType,
      description,
      hasPhysicalStore,
      address
    } = req.body;
    
    console.log('completePartnerRegistration: Extracted fields:');
    console.log('  - name:', name);
    console.log('  - email:', email);
    console.log('  - phone:', phone);
    console.log('  - document:', document);
    console.log('  - documentType:', documentType);
    console.log('  - description:', description);
    console.log('  - hasPhysicalStore:', hasPhysicalStore);
    console.log('  - address:', address);

    // Verificar se o usuário já tem um parceiro associado
    console.log('=== USER VALIDATION START ===');
    console.log('completePartnerRegistration: Checking for existing user...');
    
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { partner: true }
    });

    console.log('completePartnerRegistration: Existing user found:', !!existingUser);
    console.log('completePartnerRegistration: User data:', existingUser ? {
      id: existingUser.id,
      email: existingUser.email,
      role: existingUser.role,
      partnerId: existingUser.partnerId,
      hasPartner: !!existingUser.partner
    } : null);

    if (!existingUser) {
      console.log('completePartnerRegistration: ERROR - User not found');
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    if (existingUser.partnerId) {
      console.log('completePartnerRegistration: ERROR - User already has partner:', existingUser.partnerId);
      return res.status(400).json({
        success: false,
        error: 'Usuário já possui um parceiro associado'
      });
    }

    if (existingUser.role !== 'PARTNER_ADMIN') {
      console.log('completePartnerRegistration: ERROR - Invalid role:', existingUser.role);
      return res.status(403).json({
        success: false,
        error: 'Apenas usuários PARTNER_ADMIN podem criar parceiros'
      });
    }
    
    console.log('completePartnerRegistration: User validation passed');

    // Verificar se já existe um parceiro com o mesmo documento ou email
    console.log('=== PARTNER DUPLICATE CHECK START ===');
    console.log('completePartnerRegistration: Checking for existing partner with document/email...');
    
    const existingPartner = await prisma.partner.findFirst({
      where: {
        OR: [
          { document },
          { email }
        ]
      }
    });

    console.log('completePartnerRegistration: Existing partner found:', !!existingPartner);
    if (existingPartner) {
      console.log('completePartnerRegistration: Existing partner data:', {
        id: existingPartner.id,
        email: existingPartner.email,
        document: document
      });
    }

    if (existingPartner) {
      console.log('completePartnerRegistration: ERROR - Partner already exists');
      return res.status(400).json({
        success: false,
        error: 'Já existe um parceiro com este documento ou email'
      });
    }
    
    console.log('completePartnerRegistration: Partner duplicate check passed');

    // Criar o parceiro com endereço em uma transação
    console.log('=== PARTNER CREATION START ===');
    console.log('completePartnerRegistration: Starting database transaction...');
    
    const result = await prisma.$transaction(async (tx) => {
      console.log('completePartnerRegistration: Transaction started');
      console.log('completePartnerRegistration: Building partner data object...');
      
      // Criar o parceiro com ou sem endereço baseado no hasPhysicalStore
      const partnerData = {
        name,
        email,
        phone,
        document,
        documentType,
        description,
        hasPhysicalStore,
        ...(hasPhysicalStore && address ? {
          address: {
            create: {
              street: address.street,
              number: address.number,
              complement: address.complement,
              neighborhood: address.neighborhood,
              city: address.city,
              state: address.state,
              zipCode: address.zipCode
            }
          }
        } : {})
      };

      console.log('completePartnerRegistration: Final partner data to be created:');
      console.log(JSON.stringify(partnerData, null, 2));
      console.log('completePartnerRegistration: Creating partner in database...');

      const partner = await tx.partner.create({
        data: partnerData,
        include: {
          address: true
        }
      });
      
      console.log('completePartnerRegistration: Partner created successfully');
      console.log('completePartnerRegistration: Created partner ID:', partner.id);
      console.log('completePartnerRegistration: Partner has address:', !!partner.address);

      // Associar o usuário ao parceiro
      console.log('completePartnerRegistration: Updating user with partner ID...');
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { partnerId: partner.id },
        include: { partner: true }
      });
      
      console.log('completePartnerRegistration: User updated successfully');
      console.log('completePartnerRegistration: User partnerId:', updatedUser.partnerId);
      console.log('completePartnerRegistration: Transaction completed successfully');

      return { partner, user: updatedUser };
    });

    console.log('=== TOKEN GENERATION START ===');
    console.log('completePartnerRegistration: Generating new JWT token...');
    
    // Generate new JWT token with updated user data (including partnerId)
    const newToken = generateToken(result.user);
    
    console.log('completePartnerRegistration: Token generated successfully');
    console.log('completePartnerRegistration: Token (first 20 chars):', newToken.substring(0, 20) + '...');

    console.log('=== RESPONSE PREPARATION START ===');
    const responseData = {
      success: true,
      message: 'Cadastro do parceiro concluído com sucesso',
      data: {
        partner: result.partner,
        user: {
          ...result.user,
          password: undefined // Não retornar a senha
        },
        token: newToken // Include the new token
      }
    };
    
    console.log('completePartnerRegistration: Response data prepared');
    console.log('completePartnerRegistration: Partner created with ID:', result.partner.id);
    console.log('completePartnerRegistration: User updated with partnerId:', result.user.partnerId);
    console.log('=== PARTNER REGISTRATION COMPLETED SUCCESSFULLY ===');

    res.json(responseData);
  } catch (error) {
    console.log('=== ERROR IN PARTNER REGISTRATION ===');
    console.error('completePartnerRegistration: Error caught:', error);
    console.error('completePartnerRegistration: Error type:', typeof error);
    console.error('completePartnerRegistration: Error constructor:', error?.constructor?.name);
    
    if (error instanceof Error) {
      console.error('completePartnerRegistration: Error message:', error.message);
      console.error('completePartnerRegistration: Error stack:', error.stack);
    }
    
    // Check if it's a Prisma error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('completePartnerRegistration: Prisma error code:', (error as any).code);
      console.error('completePartnerRegistration: Prisma error meta:', (error as any).meta);
    }
    
    console.log('=== ERROR HANDLING COMPLETE - PASSING TO MIDDLEWARE ===');
    next(error);
  }
};

export const getOnboardingStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { 
        partner: {
          include: {
            address: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado'
      });
    }

    const onboardingStatus = {
      isComplete: false,
      requiresPartnerSetup: false,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        partnerId: user.partnerId
      },
      partner: user.partner
    };

    // Se é PARTNER_ADMIN mas não tem partnerId, precisa completar cadastro
    if (userRole === 'PARTNER_ADMIN' && !user.partnerId) {
      onboardingStatus.requiresPartnerSetup = true;
      onboardingStatus.isComplete = false;
    } 
    // Se tem partnerId, cadastro está completo
    else if (user.partnerId && user.partner) {
      onboardingStatus.isComplete = true;
    }
    // Para outros roles (ADMIN, CUSTOMER, PROMOTER, PARTNER_PROMOTER), considerar completo
    else if (userRole === 'ADMIN' || userRole === 'CUSTOMER' || userRole === 'PROMOTER' || userRole === 'PARTNER_PROMOTER') {
      onboardingStatus.isComplete = true;
    }

    res.json({
      success: true,
      data: onboardingStatus
    });
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    next(error);
  }
};