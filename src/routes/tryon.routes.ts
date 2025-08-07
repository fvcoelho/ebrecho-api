import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { tryonController } from '../controllers/tryon.controller';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/tryon');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const extension = path.extname(file.originalname);
    const filename = `${timestamp}_${randomString}_${file.fieldname}${extension}`;
    cb(null, filename);
  }
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, and WebP are allowed.`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 2, // Maximum 2 files (person + garment)
  }
});

// Middleware to handle multer errors
const handleMulterError = (error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    console.error('[Try-On Routes] Multer error:', {
      code: error.code,
      message: error.message,
      field: error.field
    });

    let errorMessage = 'File upload error';
    let statusCode = 400;

    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        errorMessage = 'File too large. Maximum size is 10MB.';
        break;
      case 'LIMIT_FILE_COUNT':
        errorMessage = 'Too many files. Maximum 2 files allowed.';
        break;
      case 'LIMIT_UNEXPECTED_FILE':
        errorMessage = 'Unexpected file field. Only "person" and "garment" fields are allowed.';
        break;
      default:
        errorMessage = error.message;
    }

    return res.status(statusCode).json({
      success: false,
      error: errorMessage,
      debug: {
        multerError: {
          code: error.code,
          message: error.message,
          field: error.field
        },
        timestamp: new Date().toISOString()
      }
    });
  }

  if (error.message.includes('Invalid file type')) {
    console.error('[Try-On Routes] File type error:', error.message);
    return res.status(400).json({
      success: false,
      error: error.message,
      debug: {
        fileTypeError: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }

  next(error);
};

// Routes

/**
 * POST /api/tryon-url
 * Create a new try-on request with image URLs
 * 
 * Body: JSON with:
 * - media_url: string (URL to person image)
 * - garment_url: string (URL to garment image)
 * - mask_type: 'overall' (optional, defaults to 'overall')
 * 
 * Response: {
 *   success: true,
 *   data: { event_id: string, status: string, created_at: string },
 *   message: string,
 *   debug: { ... }
 * }
 */
router.post('/url', tryonController.createTryOnWithUrls);

/**
 * POST /api/tryon
 * Create a new try-on request with file uploads
 * 
 * Body: FormData with:
 * - person: Image file (JPEG/PNG/WebP, max 10MB)
 * - garment: Image file (JPEG/PNG/WebP, max 10MB)
 * - mask_type: 'overall' (optional, defaults to 'overall')
 * 
 * Response: {
 *   success: true,
 *   data: { event_id: string, status: string, created_at: string },
 *   message: string,
 *   debug: { ... }
 * }
 */
router.post('/', 
  upload.fields([
    { name: 'person', maxCount: 1 },
    { name: 'garment', maxCount: 1 }
  ]),
  handleMulterError,
  tryonController.createTryOn
);

/**
 * GET /api/tryon/:eventId
 * Get the result of a try-on request with automatic retry for processing states
 * 
 * Params:
 * - eventId: string - The event ID from the create request
 * 
 * Query Parameters:
 * - maxRetries: number (0-10, default: 3) - Max retries for IN_QUEUE/IN_PROGRESS states
 * - retryDelayMs: number (1000-10000, default: 2000) - Delay between retries in milliseconds
 * 
 * Response: {
 *   success: true,
 *   data: { event_id: string, status: string, result_url?: string, error?: string },
 *   message: string,
 *   debug: { ... }
 * }
 */
router.get('/:eventId', tryonController.getTryOnResult);

/**
 * GET /api/tryon/:eventId/poll
 * Poll for the result of a try-on request until completion
 * 
 * Params:
 * - eventId: string - The event ID from the create request
 * 
 * Query Parameters:
 * - maxAttempts: number (1-100, default: 30) - Maximum polling attempts
 * - intervalMs: number (1000-60000, default: 10000) - Polling interval in milliseconds
 * 
 * Response: {
 *   success: true,
 *   data: { event_id: string, status: string, result_url?: string, error?: string },
 *   message: string,
 *   debug: { ... }
 * }
 */
router.get('/:eventId/poll', tryonController.pollTryOnResult);

export { router as tryonRoutes };