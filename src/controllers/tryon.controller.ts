import { Request, Response } from 'express';
import { glamAITryOnService } from '../services/glam-ai-tryon.service';
import { randomUUID } from 'crypto';

interface TryOnRequestBody {
  mask_type?: 'overall';
  media_url?: string;
  garment_url?: string;
}

interface MulterRequest extends Request {
  files?: {
    person?: Express.Multer.File[];
    garment?: Express.Multer.File[];
  };
}

interface ControllerDebugInfo {
  requestId: string;
  totalProcessingTime: number;
  timestamp: string;
  mode?: string;
  urls?: {
    mediaUrl: string;
    garmentUrl: string;
  };
  files?: {
    person: {
      originalname: string;
      size: number;
      mimetype: string;
    };
    garment: {
      originalname: string;
      size: number;
      mimetype: string;
    };
  };
  error?: string;
  stack?: string;
}

// Helper functions
const createRequestId = () => randomUUID();
const getCurrentTimestamp = () => new Date().toISOString();

const logRequest = (endpoint: string, requestId: string, details: any) => {
  console.log(`[Try-On Controller] ${endpoint} request received:`, {
    requestId,
    timestamp: getCurrentTimestamp(),
    ...details
  });
};

const logError = (endpoint: string, requestId: string, error: string, details: any) => {
  console.error(`[Try-On Controller] ${endpoint} error:`, {
    requestId,
    error,
    timestamp: getCurrentTimestamp(),
    ...details
  });
};

const logSuccess = (endpoint: string, requestId: string, details: any) => {
  console.log(`[Try-On Controller] ${endpoint} completed successfully:`, {
    requestId,
    ...details
  });
};

const createErrorResponse = (
  requestId: string,
  error: string,
  message: string,
  statusCode: number = 500,
  debugInfo?: any
) => ({
  status: statusCode,
  body: {
    success: false,
    error,
    message,
    debug: {
      requestId,
      timestamp: getCurrentTimestamp(),
      ...debugInfo
    }
  }
});

const createSuccessResponse = (
  requestId: string,
  data: any,
  message: string,
  debugInfo: any
) => ({
  status: 200,
  body: {
    success: true,
    data,
    message,
    debug: {
      ...debugInfo,
      controller: {
        requestId,
        timestamp: getCurrentTimestamp(),
        ...debugInfo.controller
      }
    }
  }
});

const validateEventId = (eventId: string, requestId: string) => {
  if (!eventId || typeof eventId !== 'string' || eventId.length === 0) {
    return createErrorResponse(
      requestId,
      'Valid event ID is required',
      'Invalid event ID provided',
      400,
      {
        validation: {
          eventId,
          type: typeof eventId,
          length: eventId?.length || 0
        }
      }
    );
  }
  return null;
};

const validateUrls = (mediaUrl: string, garmentUrl: string, requestId: string) => {
  if (!mediaUrl || !garmentUrl) {
    return createErrorResponse(
      requestId,
      'Both media_url and garment_url are required',
      'Missing required URLs',
      400,
      {
        validation: {
          hasMediaUrl: !!mediaUrl,
          hasGarmentUrl: !!garmentUrl
        }
      }
    );
  }

  try {
    new URL(mediaUrl);
    new URL(garmentUrl);
  } catch (error) {
    return createErrorResponse(
      requestId,
      'Invalid URLs provided',
      'URL validation failed',
      400,
      {
        validation: {
          mediaUrl,
          garmentUrl,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    );
  }

  return null;
};

const validateFiles = (req: MulterRequest, requestId: string) => {
  if (!req.files?.person?.[0] || !req.files?.garment?.[0]) {
    return createErrorResponse(
      requestId,
      'Both person and garment images are required',
      'Missing required files',
      400,
      {
        validation: {
          hasPerson: !!req.files?.person?.[0],
          hasGarment: !!req.files?.garment?.[0],
          filesReceived: Object.keys(req.files || {})
        }
      }
    );
  }

  const personFile = req.files.person[0];
  const garmentFile = req.files.garment[0];

  // Validate file types
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(personFile.mimetype) || !allowedMimeTypes.includes(garmentFile.mimetype)) {
    return createErrorResponse(
      requestId,
      'Only JPEG, PNG, and WebP images are supported',
      'Invalid file types',
      400,
      {
        validation: {
          personMimetype: personFile.mimetype,
          garmentMimetype: garmentFile.mimetype,
          allowedTypes: allowedMimeTypes
        }
      }
    );
  }

  // Validate file sizes (max 10MB each)
  const maxSize = 10 * 1024 * 1024;
  if (personFile.size > maxSize || garmentFile.size > maxSize) {
    return createErrorResponse(
      requestId,
      'File size must be less than 10MB',
      'File size too large',
      400,
      {
        validation: {
          personSize: personFile.size,
          garmentSize: garmentFile.size,
          maxSize,
          personSizeMB: (personFile.size / 1024 / 1024).toFixed(2),
          garmentSizeMB: (garmentFile.size / 1024 / 1024).toFixed(2)
        }
      }
    );
  }

  return null;
};

const validateRetryParameters = (req: Request, requestId: string) => {
  let maxRetries = parseInt(req.query.maxRetries as string) || 3;
  let retryDelayMs = parseInt(req.query.retryDelayMs as string) || 2000;

  if (maxRetries < 0 || maxRetries > 10) {
    maxRetries = 3;
    console.warn(`[Try-On Controller] Invalid maxRetries, using default:`, {
      requestId,
      providedValue: req.query.maxRetries,
      defaultValue: maxRetries
    });
  }

  if (retryDelayMs < 1000 || retryDelayMs > 10000) {
    retryDelayMs = 2000;
    console.warn(`[Try-On Controller] Invalid retryDelayMs, using default:`, {
      requestId,
      providedValue: req.query.retryDelayMs,
      defaultValue: retryDelayMs
    });
  }

  return { maxRetries, retryDelayMs };
};

const validatePollingParameters = (req: Request, requestId: string) => {
  const maxAttempts = parseInt(req.query.maxAttempts as string) || 30;
  const intervalMs = parseInt(req.query.intervalMs as string) || 10000;

  if (maxAttempts < 1 || maxAttempts > 100) {
    return createErrorResponse(
      requestId,
      'maxAttempts must be between 1 and 100',
      'Invalid polling parameters',
      400,
      {
        validation: { maxAttempts, min: 1, max: 100 }
      }
    );
  }

  if (intervalMs < 1000 || intervalMs > 60000) {
    return createErrorResponse(
      requestId,
      'intervalMs must be between 1000 and 60000',
      'Invalid polling parameters',
      400,
      {
        validation: { intervalMs, min: 1000, max: 60000 }
      }
    );
  }

  return { maxAttempts, intervalMs };
};

export const tryonController = {
  async createTryOnWithUrls(req: Request, res: Response): Promise<void> {
    const requestId = createRequestId();
    const startTime = Date.now();

    logRequest('createTryOnWithUrls', requestId, {
      body: req.body,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    try {
      const { mask_type, media_url, garment_url } = req.body as TryOnRequestBody;

      // Validate URLs
      const urlValidation = validateUrls(media_url!, garment_url!, requestId);
      if (urlValidation) {
        res.status(urlValidation.status).json(urlValidation.body);
        return;
      }

      const maskType = (mask_type as 'overall') || 'overall';

      console.log(`[Try-On Controller] URLs validated:`, {
        requestId,
        mediaUrl: media_url,
        garmentUrl: garment_url,
        maskType
      });

      // Call Glam.ai service
      const serviceResponse = await glamAITryOnService.createTryOn(
        media_url!,
        garment_url!,
        {
          filename: 'person-image-from-url',
          size: 0,
          mimeType: 'image/*'
        },
        {
          filename: 'garment-image-from-url',
          size: 0,
          mimeType: 'image/*'
        },
        { mask_type: maskType }
      );

      const totalProcessingTime = Date.now() - startTime;

      if (!serviceResponse.success) {
        const errorResponse = createErrorResponse(
          requestId,
          serviceResponse.error!,
          'Failed to create try-on request with URLs',
          500,
          {
            ...serviceResponse.debug,
            controller: {
              totalProcessingTime,
              mode: 'url-based'
            }
          }
        );
        res.status(errorResponse.status).json(errorResponse.body);
        return;
      }

      // Success response
      const successResponse = createSuccessResponse(
        requestId,
        serviceResponse.data,
        'Try-on request created successfully with URLs',
        {
          ...serviceResponse.debug,
          controller: {
            totalProcessingTime,
            mode: 'url-based',
            urls: {
              mediaUrl: media_url!,
              garmentUrl: garment_url!
            }
          }
        }
      );

      res.status(successResponse.status).json(successResponse.body);

      logSuccess('createTryOnWithUrls', requestId, {
        eventId: serviceResponse.data?.event_id,
        totalProcessingTime
      });

    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown controller error';
      
      logError('createTryOnWithUrls', requestId, errorMessage, {
        stack: error instanceof Error ? error.stack : undefined,
        totalProcessingTime
      });

      const errorResponse = createErrorResponse(
        requestId,
        errorMessage,
        'Internal server error during URL-based try-on creation',
        500,
        {
          controller: {
            error: errorMessage,
            totalProcessingTime,
            stack: error instanceof Error ? error.stack : undefined,
            mode: 'url-based'
          }
        }
      );

      res.status(errorResponse.status).json(errorResponse.body);
    }
  },

  async createTryOn(req: MulterRequest, res: Response): Promise<void> {
    const requestId = createRequestId();
    const startTime = Date.now();

    logRequest('createTryOn', requestId, {
      hasFiles: !!req.files,
      personFiles: req.files?.person?.length || 0,
      garmentFiles: req.files?.garment?.length || 0,
      body: req.body,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    try {
      // Validate files
      const fileValidation = validateFiles(req, requestId);
      if (fileValidation) {
        res.status(fileValidation.status).json(fileValidation.body);
        return;
      }

      const personFile = req.files!.person![0];
      const garmentFile = req.files!.garment![0];
      const maskType = (req.body.mask_type as 'overall') || 'overall';

      // Generate static URLs for uploaded files
      // In production, use the production domain; in development, try ngrok or API_BASE_URL first
      let baseUrl: string;
      if (process.env.NODE_ENV === 'production') {
        baseUrl = 'https://www.ebrecho.com.br';  // Use www subdomain for production
      } else {
        baseUrl = process.env.NGROK_URL || process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
      }
      
      const personImageUrl = `${baseUrl}/uploads/tryon/${personFile.filename}`;
      const garmentImageUrl = `${baseUrl}/uploads/tryon/${garmentFile.filename}`;

      // Validate URLs are publicly accessible
      if (baseUrl.includes('localhost') || baseUrl.includes('127.0.0.1')) {
        console.warn(`[Try-On Controller] WARNING: Using localhost URLs that may not be accessible to Glam.ai:`, {
          requestId,
          baseUrl,
          suggestion: 'Use ngrok or deploy to a public server for testing'
        });
      }

      console.log(`[Try-On Controller] Generated static URLs:`, {
        requestId,
        personImageUrl,
        garmentImageUrl,
        baseUrl
      });

      // Call Glam.ai service
      const serviceResponse = await glamAITryOnService.createTryOn(
        personImageUrl,
        garmentImageUrl,
        {
          filename: personFile.originalname,
          size: personFile.size,
          mimeType: personFile.mimetype
        },
        {
          filename: garmentFile.originalname,
          size: garmentFile.size,
          mimeType: garmentFile.mimetype
        },
        { mask_type: maskType }
      );

      const totalProcessingTime = Date.now() - startTime;

      if (!serviceResponse.success) {
        const errorResponse = createErrorResponse(
          requestId,
          serviceResponse.error!,
          'Failed to create try-on request',
          500,
          {
            ...serviceResponse.debug,
            controller: {
              totalProcessingTime,
              mode: 'file-upload'
            }
          }
        );
        res.status(errorResponse.status).json(errorResponse.body);
        return;
      }

      // Success response
      const successResponse = createSuccessResponse(
        requestId,
        serviceResponse.data,
        'Try-on request created successfully',
        {
          ...serviceResponse.debug,
          controller: {
            totalProcessingTime,
            mode: 'file-upload',
            files: {
              person: {
                originalname: personFile.originalname,
                size: personFile.size,
                mimetype: personFile.mimetype
              },
              garment: {
                originalname: garmentFile.originalname,
                size: garmentFile.size,
                mimetype: garmentFile.mimetype
              }
            }
          }
        }
      );

      res.status(successResponse.status).json(successResponse.body);

      logSuccess('createTryOn', requestId, {
        eventId: serviceResponse.data?.event_id,
        totalProcessingTime
      });

    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown controller error';
      
      logError('createTryOn', requestId, errorMessage, {
        stack: error instanceof Error ? error.stack : undefined,
        totalProcessingTime
      });

      const errorResponse = createErrorResponse(
        requestId,
        errorMessage,
        'Internal server error during try-on creation',
        500,
        {
          controller: {
            error: errorMessage,
            totalProcessingTime,
            stack: error instanceof Error ? error.stack : undefined,
            mode: 'file-upload'
          }
        }
      );

      res.status(errorResponse.status).json(errorResponse.body);
    }
  },

  async getTryOnResult(req: Request, res: Response): Promise<void> {
    const requestId = createRequestId();
    const startTime = Date.now();
    const { eventId } = req.params;

    logRequest('getTryOnResult', requestId, {
      eventId,
      eventIdType: typeof eventId,
      eventIdLength: eventId?.length || 0,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    try {
      // Validate event ID
      const eventIdValidation = validateEventId(eventId, requestId);
      if (eventIdValidation) {
        res.status(eventIdValidation.status).json(eventIdValidation.body);
        return;
      }

      // Validate retry parameters
      const { maxRetries, retryDelayMs } = validateRetryParameters(req, requestId);

      // Call service
      const serviceResponse = await glamAITryOnService.getTryOnResult(eventId, maxRetries, retryDelayMs);
      const totalProcessingTime = Date.now() - startTime;

      if (!serviceResponse.success) {
        const errorResponse = createErrorResponse(
          requestId,
          serviceResponse.error!,
          'Failed to get try-on result',
          500,
          {
            ...serviceResponse.debug,
            controller: {
              eventId,
              totalProcessingTime
            }
          }
        );
        res.status(errorResponse.status).json(errorResponse.body);
        return;
      }

      // Success response
      const successResponse = createSuccessResponse(
        requestId,
        serviceResponse.data,
        'Try-on result retrieved successfully',
        {
          ...serviceResponse.debug,
          controller: {
            eventId,
            totalProcessingTime
          }
        }
      );

      res.status(successResponse.status).json(successResponse.body);

      logSuccess('getTryOnResult', requestId, {
        eventId,
        status: serviceResponse.data?.status,
        totalProcessingTime
      });

    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown controller error';
      
      logError('getTryOnResult', requestId, errorMessage, {
        eventId,
        stack: error instanceof Error ? error.stack : undefined,
        totalProcessingTime
      });

      const errorResponse = createErrorResponse(
        requestId,
        errorMessage,
        'Internal server error during result retrieval',
        500,
        {
          controller: {
            eventId,
            error: errorMessage,
            totalProcessingTime,
            stack: error instanceof Error ? error.stack : undefined
          }
        }
      );

      res.status(errorResponse.status).json(errorResponse.body);
    }
  },

  async pollTryOnResult(req: Request, res: Response): Promise<void> {
    const requestId = createRequestId();
    const startTime = Date.now();
    const { eventId } = req.params;

    const pollingValidation = validatePollingParameters(req, requestId);
    if ('status' in pollingValidation) {
      res.status(pollingValidation.status).json(pollingValidation.body);
      return;
    }

    const { maxAttempts, intervalMs } = pollingValidation;

    logRequest('pollTryOnResult', requestId, {
      eventId,
      maxAttempts,
      intervalMs,
      estimatedMaxTime: `${(maxAttempts * intervalMs) / 1000}s`
    });

    try {
      // Validate event ID
      const eventIdValidation = validateEventId(eventId, requestId);
      if (eventIdValidation) {
        res.status(eventIdValidation.status).json(eventIdValidation.body);
        return;
      }

      // Call polling service
      const serviceResponse = await glamAITryOnService.pollForResult(eventId, maxAttempts, intervalMs);
      const totalProcessingTime = Date.now() - startTime;

      if (!serviceResponse.success) {
        const errorResponse = createErrorResponse(
          requestId,
          serviceResponse.error!,
          'Polling for try-on result failed',
          500,
          {
            ...serviceResponse.debug,
            controller: {
              eventId,
              maxAttempts,
              intervalMs,
              totalProcessingTime
            }
          }
        );
        res.status(errorResponse.status).json(errorResponse.body);
        return;
      }

      // Success response
      const successResponse = createSuccessResponse(
        requestId,
        serviceResponse.data,
        'Try-on result polling completed successfully',
        {
          ...serviceResponse.debug,
          controller: {
            eventId,
            maxAttempts,
            intervalMs,
            totalProcessingTime
          }
        }
      );

      res.status(successResponse.status).json(successResponse.body);

      logSuccess('pollTryOnResult', requestId, {
        eventId,
        resultUrl: serviceResponse.data?.result_url,
        totalProcessingTime
      });

    } catch (error) {
      const totalProcessingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown polling error';
      
      logError('pollTryOnResult', requestId, errorMessage, {
        eventId,
        stack: error instanceof Error ? error.stack : undefined,
        totalProcessingTime
      });

      const errorResponse = createErrorResponse(
        requestId,
        errorMessage,
        'Internal server error during polling',
        500,
        {
          controller: {
            eventId,
            error: errorMessage,
            totalProcessingTime,
            stack: error instanceof Error ? error.stack : undefined
          }
        }
      );

      res.status(errorResponse.status).json(errorResponse.body);
    }
  }
};