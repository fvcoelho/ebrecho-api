import serverless from 'serverless-http';
import { app, initDatabase } from './app';

// Initialize database connection once
let dbInitialized = false;

// Create serverless handler
export const handler = serverless(app, {
  request: async (request, event, context) => {
    // Initialize database connection on cold start
    if (!dbInitialized) {
      try {
        await initDatabase();
        dbInitialized = true;
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    }

    // Optional: Add request context
    request.serverlessEvent = event;
    request.serverlessContext = context;
  }
});

// Export for AWS Lambda
export default handler;