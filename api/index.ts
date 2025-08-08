import { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Lazy load the Express app to avoid initialization issues
    const { app, initDatabase } = await import('../src/app');
    
    // Initialize database connection on first request
    try {
      await initDatabase();
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
      // Continue anyway - some endpoints might not need DB
    }

    // Forward the request to Express
    return new Promise((resolve) => {
      app(req as any, res as any, (err: any) => {
        if (err) {
          console.error('Express app error:', err);
          if (!res.headersSent) {
            res.status(500).json({ 
              error: 'Internal server error', 
              message: err.message 
            });
          }
        }
        resolve(undefined);
      });
    });
  } catch (error) {
    console.error('Handler error:', error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: 'Handler initialization failed', 
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }
}