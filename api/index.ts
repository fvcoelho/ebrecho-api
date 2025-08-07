import { VercelRequest, VercelResponse } from '@vercel/node';
import { app, initDatabase } from '../src/app';

// Initialize database connection once
let dbInitialized = false;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Initialize database connection on cold start
  if (!dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
    } catch (error) {
      console.error('Failed to initialize database:', error);
      // Continue anyway - some endpoints might not need DB
    }
  }

  // Forward the request to Express
  return new Promise((resolve, reject) => {
    app(req as any, res as any, (err: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(undefined);
      }
    });
  });
}