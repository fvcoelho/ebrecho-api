import jwt, { SignOptions } from 'jsonwebtoken';
import { User } from '@prisma/client';
import { JWTPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const generateToken = (user: User): string => {
  const payload: JWTPayload = {
    id: user.id,
    userId: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    partnerId: user.partnerId || undefined,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as any);
};

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, JWT_SECRET) as JWTPayload;
};