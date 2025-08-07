import { Request } from 'express';
import { User } from '@prisma/client';
import { ParamsDictionary } from 'express-serve-static-core';
import { ParsedQs } from 'qs';

// JWT Payload type
export interface JWTPayload {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'CUSTOMER' | 'PARTNER_ADMIN' | 'PARTNER_USER' | 'PROMOTER' | 'PARTNER_PROMOTER';
  partnerId?: string;
  promoter?: {
    id: string;
    tier: string;
    isActive: boolean;
  };
}

// Authenticated Request type - Generic to match Express RequestHandler signature
export interface AuthenticatedRequest<
  P = ParamsDictionary,
  ResBody = any,
  ReqBody = any,
  ReqQuery = ParsedQs,
  Locals extends Record<string, any> = Record<string, any>
> extends Request<P, ResBody, ReqBody, ReqQuery, Locals> {
  user?: JWTPayload;
}

// Type alias for backwards compatibility
export type AuthRequest = AuthenticatedRequest;

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Login response type
export interface LoginResponse {
  user: Omit<User, 'password'>;
  token: string;
}

// Registration data type
export interface RegisterData {
  email: string;
  password: string;
  name: string;
  role?: 'CUSTOMER' | 'PARTNER_ADMIN' | 'PARTNER_USER';
  partnerId?: string;
}