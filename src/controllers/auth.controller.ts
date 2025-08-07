import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../prisma';
import { generateToken } from '../utils/jwt.utils';
import { LoginInput, RegisterInput, UpdateProfileInput, VerifyEmailInput, ResendVerificationInput } from '../schemas/auth.schema';
import { LoginResponse, JWTPayload } from '../types';
import { emailService } from '../utils/email.utils';

export const login = async (
  req: Request<{}, {}, LoginInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;
    
    // Trim whitespace
    const trimmedEmail = email.trim();

    // Find user (case-insensitive email)
    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail.toLowerCase() },
      include: {
        partner: true,
      },
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Email ou senha inválidos',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'Email ou senha inválidos',
      });
    }

    // Generate token
    const token = generateToken(user);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    const response: LoginResponse = {
      user: userWithoutPassword,
      token,
    };

    res.json({
      success: true,
      data: response,
    });
  } catch (error) {
    next(error);
  }
};

export const register = async (
  req: Request<{}, {}, RegisterInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password, name, role = 'CUSTOMER', partnerId } = req.body;

    // Trim whitespace
    const trimmedEmail = email.trim();

    // Check if user already exists (case-insensitive)
    const existingUser = await prisma.user.findUnique({
      where: { email: trimmedEmail.toLowerCase() },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'Email já cadastrado',
      });
    }

    // Validate partner if provided
    if (partnerId) {
      const partner = await prisma.partner.findUnique({
        where: { id: partnerId },
      });

      if (!partner) {
        return res.status(400).json({
          success: false,
          error: 'Parceiro inválido',
        });
      }
    }

    // Generate email verification token
    const emailVerifyToken = emailService.generateVerificationToken();
    const emailVerifyExpires = emailService.getTokenExpiration();

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user (with normalized email)
    const user = await prisma.user.create({
      data: {
        email: trimmedEmail.toLowerCase(),
        password: hashedPassword,
        name,
        role,
        partnerId,
        emailVerifyToken,
        emailVerifyExpires,
      },
      include: {
        partner: true,
      },
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, emailVerifyToken, user.name);
    } catch (emailError) {
      console.error('Erro ao enviar email de verificação:', emailError);
      // Don't fail the registration if email fails to send
    }

    // Generate token (but user needs to verify email to login)
    const token = generateToken(user);

    // Remove password and sensitive fields from response
    const { password: _, emailVerifyToken: __, emailVerifyExpires: ___, ...userWithoutPassword } = user;

    const response: LoginResponse = {
      user: userWithoutPassword as any, // TypeScript workaround for the type mismatch
      token,
    };

    res.status(201).json({
      success: true,
      data: response,
      message: 'Usuário criado com sucesso. Verifique seu email para ativar a conta.',
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user as JWTPayload;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado',
      });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
      include: {
        partner: true,
      },
    });

    if (!dbUser || !dbUser.isActive) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
      });
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = dbUser;

    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};

export const updateProfile = async (
  req: Request<{}, any, UpdateProfileInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = (req as any).user as JWTPayload;
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Não autenticado',
      });
    }

    const { name, currentPassword, newPassword } = req.body;

    // Get current user
    const dbUser = await prisma.user.findUnique({
      where: { id: user.userId },
    });

    if (!dbUser) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
      });
    }

    // Prepare update data
    const updateData: any = {};

    if (name) {
      updateData.name = name;
    }

    // Handle password change
    if (newPassword) {
      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword!,
        dbUser.password
      );

      if (!isCurrentPasswordValid) {
        return res.status(400).json({
          success: false,
          error: 'Senha atual incorreta',
        });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: user.userId },
      data: updateData,
      include: {
        partner: true,
      },
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      data: userWithoutPassword,
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (
  req: Request<{}, {}, VerifyEmailInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { token } = req.body;

    // Find user by verification token
    const user = await prisma.user.findUnique({
      where: { emailVerifyToken: token },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        error: 'Token de verificação inválido',
      });
    }

    // Check if token is expired
    if (user.emailVerifyExpires && user.emailVerifyExpires < new Date()) {
      return res.status(400).json({
        success: false,
        error: 'Token de verificação expirado',
      });
    }

    // Update user as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null,
        emailVerifyExpires: null,
      },
    });

    res.json({
      success: true,
      message: 'Email verificado com sucesso',
    });
  } catch (error) {
    next(error);
  }
};

export const resendVerification = async (
  req: Request<{}, {}, ResendVerificationInput>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email } = req.body;

    // Trim whitespace
    const trimmedEmail = email.trim();

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: trimmedEmail.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'Usuário não encontrado',
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        error: 'Email já verificado',
      });
    }

    // Generate new verification token
    const emailVerifyToken = emailService.generateVerificationToken();
    const emailVerifyExpires = emailService.getTokenExpiration();

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifyToken,
        emailVerifyExpires,
      },
    });

    // Send verification email
    try {
      await emailService.sendVerificationEmail(user.email, emailVerifyToken, user.name);
    } catch (emailError) {
      console.error('Erro ao enviar email de verificação:', emailError);
      return res.status(500).json({
        success: false,
        error: 'Erro ao enviar email de verificação',
      });
    }

    res.json({
      success: true,
      message: 'Email de verificação enviado com sucesso',
    });
  } catch (error) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // In a stateless JWT setup, logout is handled client-side
    // Here we just return success
    res.json({
      success: true,
      message: 'Logout realizado com sucesso',
    });
  } catch (error) {
    next(error);
  }
};