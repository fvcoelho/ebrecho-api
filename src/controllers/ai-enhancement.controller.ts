import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { imageEnhancementService, EnhancementOptions } from '../services/ai-image-enhancement.service';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export class AIEnhancementController {
  
  async enhanceSingleImage(req: Request, res: Response) {
    const startTime = Date.now();
    const partnerId = req.user?.partnerId;
    
    logger.info('Single Image Enhancement Request', {
      partnerId,
      file: req.file ? {
        filename: req.file.filename,
        size: req.file.size,
        mimetype: req.file.mimetype
      } : null,
      body: req.body,
      timestamp: new Date().toISOString()
    });

    try {
      if (!req.file) {
        logger.warn('Single Image Enhancement - No File Provided', { partnerId });
        return res.status(400).json({
          success: false,
          error: 'No image file provided',
          debug: {
            partnerId,
            requestTime: new Date().toISOString(),
            processingTime: Date.now() - startTime
          }
        });
      }

      if (!partnerId) {
        logger.warn('Single Image Enhancement - No Partner ID', { file: req.file.filename });
        return res.status(403).json({
          success: false,
          error: 'Partner access required',
          debug: {
            requestTime: new Date().toISOString(),
            processingTime: Date.now() - startTime
          }
        });
      }

      const options: EnhancementOptions = {
        quality: req.body.quality || 'standard',
        backgroundRemoval: req.body.backgroundRemoval === 'true' || req.body.backgroundRemoval === true,
        autoOptimize: req.body.autoOptimize !== 'false',
        category: req.body.category,
        provider: req.body.provider
      };

      logger.info('Single Image Enhancement - Processing Options', {
        partnerId,
        filename: req.file.filename,
        options,
        fileSize: req.file.size
      });

      const { result, debugInfo } = await imageEnhancementService.enhanceImage(req.file, options);

      // Save usage data to database
      await prisma.aIEnhancementUsage.create({
        data: {
          partnerId,
          provider: result.provider,
          enhancementType: 'single_image',
          imagesProcessed: 1,
          totalCost: result.cost,
          requestId: debugInfo.requestId,
          metadata: {
            originalSize: result.metadata.originalSize,
            enhancedSize: result.metadata.enhancedSize,
            qualityScore: result.qualityScore,
            processingTime: result.processingTime,
            enhancementTypes: result.metadata.enhancementType
          }
        }
      });

      const response = {
        success: true,
        data: {
          result,
          debug: {
            requestId: debugInfo.requestId,
            processingTime: Date.now() - startTime,
            steps: debugInfo.processingSteps,
            provider: debugInfo.providerSelection
          }
        }
      };

      logger.info('Single Image Enhancement - Success', {
        partnerId,
        requestId: debugInfo.requestId,
        provider: result.provider,
        cost: result.cost,
        qualityScore: result.qualityScore,
        totalProcessingTime: Date.now() - startTime
      });

      res.json(response);

    } catch (error) {
      logger.error('Single Image Enhancement - Error', {
        partnerId,
        filename: req.file?.filename,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: Date.now() - startTime
      });

      res.status(500).json({
        success: false,
        error: 'Enhancement failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          partnerId,
          requestTime: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
        }
      });
    }
  }

  async enhanceBatchImages(req: Request, res: Response) {
    const startTime = Date.now();
    const partnerId = req.user?.partnerId;
    const files = req.files as Express.Multer.File[];

    logger.info('Batch Image Enhancement Request', {
      partnerId,
      fileCount: files?.length || 0,
      files: files?.map(f => ({
        filename: f.filename,
        size: f.size,
        mimetype: f.mimetype
      })) || [],
      body: req.body,
      timestamp: new Date().toISOString()
    });

    try {
      if (!files || files.length === 0) {
        logger.warn('Batch Image Enhancement - No Files Provided', { partnerId });
        return res.status(400).json({
          success: false,
          error: 'No image files provided',
          debug: {
            partnerId,
            requestTime: new Date().toISOString(),
            processingTime: Date.now() - startTime
          }
        });
      }

      if (!partnerId) {
        logger.warn('Batch Image Enhancement - No Partner ID', { fileCount: files.length });
        return res.status(403).json({
          success: false,
          error: 'Partner access required',
          debug: {
            requestTime: new Date().toISOString(),
            processingTime: Date.now() - startTime
          }
        });
      }

      const options: EnhancementOptions = {
        quality: req.body.quality || 'standard',
        backgroundRemoval: req.body.backgroundRemoval === 'true' || req.body.backgroundRemoval === true,
        autoOptimize: req.body.autoOptimize !== 'false',
        category: req.body.category,
        provider: req.body.provider
      };

      logger.info('Batch Image Enhancement - Processing Options', {
        partnerId,
        fileCount: files.length,
        options,
        totalFileSize: files.reduce((sum, f) => sum + f.size, 0)
      });

      const results = await imageEnhancementService.batchProcess(files, options);

      // Save usage data to database
      const totalCost = results.reduce((sum, r) => sum + r.result.cost, 0);
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await prisma.aIEnhancementUsage.create({
        data: {
          partnerId,
          provider: results[0]?.result.provider || 'multiple',
          enhancementType: 'batch_images',
          imagesProcessed: results.length,
          totalCost,
          batchId,
          metadata: {
            batchSize: results.length,
            providers: [...new Set(results.map(r => r.result.provider))],
            averageQualityScore: results.reduce((sum, r) => sum + (r.result.qualityScore || 0), 0) / results.length,
            totalProcessingTime: results.reduce((sum, r) => sum + r.result.processingTime, 0),
            averageProcessingTime: results.reduce((sum, r) => sum + r.result.processingTime, 0) / results.length
          }
        }
      });

      const response = {
        success: true,
        data: {
          results: results.map(r => r.result),
          summary: {
            totalImages: results.length,
            totalCost,
            averageQualityScore: results.reduce((sum, r) => sum + (r.result.qualityScore || 0), 0) / results.length,
            providers: [...new Set(results.map(r => r.result.provider))],
            batchId
          },
          debug: {
            batchId,
            processingTime: Date.now() - startTime,
            detailedResults: results.map(r => ({
              requestId: r.debugInfo.requestId,
              steps: r.debugInfo.processingSteps,
              provider: r.debugInfo.providerSelection
            }))
          }
        }
      };

      logger.info('Batch Image Enhancement - Success', {
        partnerId,
        batchId,
        totalImages: results.length,
        totalCost,
        providers: [...new Set(results.map(r => r.result.provider))],
        totalProcessingTime: Date.now() - startTime
      });

      res.json(response);

    } catch (error) {
      logger.error('Batch Image Enhancement - Error', {
        partnerId,
        fileCount: files?.length || 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: Date.now() - startTime
      });

      res.status(500).json({
        success: false,
        error: 'Batch enhancement failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          partnerId,
          requestTime: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
        }
      });
    }
  }

  async enhanceProductImages(req: Request, res: Response) {
    const startTime = Date.now();
    const partnerId = req.user?.partnerId;
    const { productId } = req.params;

    logger.info('Product Images Enhancement Request', {
      partnerId,
      productId,
      body: req.body,
      timestamp: new Date().toISOString()
    });

    try {
      if (!partnerId) {
        logger.warn('Product Images Enhancement - No Partner ID', { productId });
        return res.status(403).json({
          success: false,
          error: 'Partner access required',
          debug: {
            productId,
            requestTime: new Date().toISOString(),
            processingTime: Date.now() - startTime
          }
        });
      }

      // Get product and its images
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          partnerId
        },
        include: {
          images: {
            orderBy: { order: 'asc' }
          }
        }
      });

      if (!product) {
        logger.warn('Product Images Enhancement - Product Not Found', { partnerId, productId });
        return res.status(404).json({
          success: false,
          error: 'Product not found or access denied',
          debug: {
            partnerId,
            productId,
            requestTime: new Date().toISOString(),
            processingTime: Date.now() - startTime
          }
        });
      }

      if (product.images.length === 0) {
        logger.warn('Product Images Enhancement - No Images Found', { partnerId, productId });
        return res.status(400).json({
          success: false,
          error: 'Product has no images to enhance',
          debug: {
            partnerId,
            productId,
            requestTime: new Date().toISOString(),
            processingTime: Date.now() - startTime
          }
        });
      }

      const options: EnhancementOptions = {
        quality: req.body.quality || 'standard',
        backgroundRemoval: req.body.backgroundRemoval === 'true' || req.body.backgroundRemoval === true,
        autoOptimize: req.body.autoOptimize !== 'false',
        category: product.category,
        provider: req.body.provider
      };

      logger.info('Product Images Enhancement - Processing Options', {
        partnerId,
        productId,
        imageCount: product.images.length,
        options,
        productCategory: product.category
      });

      // Mock file objects for existing images (in real implementation, fetch from storage)
      const mockFiles = product.images.map(img => ({
        filename: img.originalUrl.split('/').pop() || 'unknown',
        originalname: img.originalUrl.split('/').pop() || 'unknown',
        size: 1024000, // Mock size
        mimetype: 'image/jpeg' // Mock mimetype
      }));

      const results = await imageEnhancementService.batchProcess(mockFiles, options);

      // Update product images with enhancement data
      const updatePromises = product.images.map(async (img, index) => {
        const result = results[index];
        if (result) {
          return prisma.productImage.update({
            where: { id: img.id },
            data: {
              aiEnhanced: true,
              enhancementProvider: result.result.provider,
              enhancementVersion: '1.0',
              qualityScore: result.result.qualityScore,
              processingCost: result.result.cost,
              enhancementRequestId: result.debugInfo.requestId,
              enhancedUrl: result.result.enhancedUrl
            }
          });
        }
      });

      await Promise.all(updatePromises);

      // Save usage data to database
      const totalCost = results.reduce((sum, r) => sum + r.result.cost, 0);
      const batchId = `product_${productId}_${Date.now()}`;

      await prisma.aIEnhancementUsage.create({
        data: {
          partnerId,
          provider: results[0]?.result.provider || 'multiple',
          enhancementType: 'product_images',
          imagesProcessed: results.length,
          totalCost,
          batchId,
          metadata: {
            productId,
            productCategory: product.category,
            productName: product.name,
            batchSize: results.length,
            providers: [...new Set(results.map(r => r.result.provider))],
            averageQualityScore: results.reduce((sum, r) => sum + (r.result.qualityScore || 0), 0) / results.length
          }
        }
      });

      const response = {
        success: true,
        data: {
          productId,
          productName: product.name,
          results: results.map(r => r.result),
          summary: {
            totalImages: results.length,
            totalCost,
            averageQualityScore: results.reduce((sum, r) => sum + (r.result.qualityScore || 0), 0) / results.length,
            providers: [...new Set(results.map(r => r.result.provider))],
            batchId
          },
          debug: {
            batchId,
            processingTime: Date.now() - startTime,
            productCategory: product.category,
            detailedResults: results.map(r => ({
              requestId: r.debugInfo.requestId,
              steps: r.debugInfo.processingSteps,
              provider: r.debugInfo.providerSelection
            }))
          }
        }
      };

      logger.info('Product Images Enhancement - Success', {
        partnerId,
        productId,
        batchId,
        totalImages: results.length,
        totalCost,
        providers: [...new Set(results.map(r => r.result.provider))],
        totalProcessingTime: Date.now() - startTime
      });

      res.json(response);

    } catch (error) {
      logger.error('Product Images Enhancement - Error', {
        partnerId,
        productId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        processingTime: Date.now() - startTime
      });

      res.status(500).json({
        success: false,
        error: 'Product enhancement failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        debug: {
          partnerId,
          productId,
          requestTime: new Date().toISOString(),
          processingTime: Date.now() - startTime,
          errorType: error instanceof Error ? error.constructor.name : 'UnknownError'
        }
      });
    }
  }

  async getUsageStats(req: Request, res: Response) {
    const partnerId = req.user?.partnerId;

    logger.info('Usage Stats Request', {
      partnerId,
      query: req.query,
      timestamp: new Date().toISOString()
    });

    try {
      if (!partnerId) {
        return res.status(403).json({
          success: false,
          error: 'Partner access required'
        });
      }

      const { startDate, endDate, provider } = req.query;

      const whereClause: any = { partnerId };
      
      if (startDate || endDate) {
        whereClause.createdAt = {};
        if (startDate) whereClause.createdAt.gte = new Date(startDate as string);
        if (endDate) whereClause.createdAt.lte = new Date(endDate as string);
      }
      
      if (provider) {
        whereClause.provider = provider;
      }

      const [totalUsage, recentUsage, providerStats] = await Promise.all([
        // Total usage statistics
        prisma.aIEnhancementUsage.aggregate({
          where: whereClause,
          _sum: {
            imagesProcessed: true,
            totalCost: true
          },
          _count: {
            id: true
          }
        }),

        // Recent usage (last 10 entries)
        prisma.aIEnhancementUsage.findMany({
          where: { partnerId },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            provider: true,
            enhancementType: true,
            imagesProcessed: true,
            totalCost: true,
            createdAt: true,
            metadata: true
          }
        }),

        // Provider breakdown
        prisma.aIEnhancementUsage.groupBy({
          by: ['provider'],
          where: whereClause,
          _sum: {
            imagesProcessed: true,
            totalCost: true
          },
          _count: {
            id: true
          }
        })
      ]);

      const response = {
        success: true,
        data: {
          summary: {
            totalRequests: totalUsage._count.id || 0,
            totalImagesProcessed: totalUsage._sum.imagesProcessed || 0,
            totalCost: totalUsage._sum.totalCost || 0,
            averageCostPerImage: (Number(totalUsage._sum.imagesProcessed) || 0) > 0
              ? (Number(totalUsage._sum.totalCost) || 0) / (Number(totalUsage._sum.imagesProcessed) || 1)
              : 0
          },
          providerBreakdown: providerStats.map(stat => ({
            provider: stat.provider,
            requests: stat._count.id,
            imagesProcessed: stat._sum.imagesProcessed || 0,
            totalCost: stat._sum.totalCost || 0,
            averageCostPerImage: (Number(stat._sum.imagesProcessed) || 0) > 0
              ? (Number(stat._sum.totalCost) || 0) / (Number(stat._sum.imagesProcessed) || 1)
              : 0
          })),
          recentUsage,
          debug: {
            partnerId,
            queryFilters: { startDate, endDate, provider },
            generatedAt: new Date().toISOString()
          }
        }
      };

      logger.info('Usage Stats - Success', {
        partnerId,
        totalRequests: totalUsage._count.id,
        totalCost: totalUsage._sum.totalCost,
        providersUsed: providerStats.length
      });

      res.json(response);

    } catch (error) {
      logger.error('Usage Stats - Error', {
        partnerId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch usage statistics',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getDetailedUsage(req: Request, res: Response) {
    const partnerId = req.user?.partnerId;

    logger.info('Detailed Usage Request', {
      partnerId,
      query: req.query,
      timestamp: new Date().toISOString()
    });

    try {
      if (!partnerId) {
        return res.status(403).json({
          success: false,
          error: 'Partner access required'
        });
      }

      const { page = 1, limit = 20, provider, enhancementType } = req.query;
      const offset = (Number(page) - 1) * Number(limit);

      const whereClause: any = { partnerId };
      if (provider) whereClause.provider = provider;
      if (enhancementType) whereClause.enhancementType = enhancementType;

      const [usage, total] = await Promise.all([
        prisma.aIEnhancementUsage.findMany({
          where: whereClause,
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: Number(limit),
          include: {
            partner: {
              select: {
                name: true,
                slug: true
              }
            }
          }
        }),

        prisma.aIEnhancementUsage.count({
          where: whereClause
        })
      ]);

      const response = {
        success: true,
        data: {
          usage,
          pagination: {
            page: Number(page),
            limit: Number(limit),
            total,
            totalPages: Math.ceil(total / Number(limit)),
            hasNextPage: offset + Number(limit) < total,
            hasPreviousPage: Number(page) > 1
          },
          debug: {
            partnerId,
            queryFilters: { provider, enhancementType },
            generatedAt: new Date().toISOString()
          }
        }
      };

      logger.info('Detailed Usage - Success', {
        partnerId,
        recordsReturned: usage.length,
        totalRecords: total,
        page: Number(page)
      });

      res.json(response);

    } catch (error) {
      logger.error('Detailed Usage - Error', {
        partnerId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch detailed usage',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getDebugInfo(req: Request, res: Response) {
    const { requestId } = req.params;

    logger.info('Debug Info Request', {
      requestId,
      timestamp: new Date().toISOString()
    });

    try {
      const debugInfo = imageEnhancementService.getDebugInfo(requestId);

      if (!debugInfo) {
        logger.warn('Debug Info - Not Found', { requestId });
        return res.status(404).json({
          success: false,
          error: 'Debug information not found or expired',
          debug: {
            requestId,
            requestTime: new Date().toISOString()
          }
        });
      }

      logger.info('Debug Info - Success', {
        requestId,
        stepsCount: debugInfo.processingSteps.length,
        provider: debugInfo.providerSelection.selectedProvider
      });

      res.json({
        success: true,
        data: debugInfo
      });

    } catch (error) {
      logger.error('Debug Info - Error', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch debug information',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getAllDebugInfo(req: Request, res: Response) {
    logger.info('All Debug Info Request', {
      timestamp: new Date().toISOString()
    });

    try {
      const allDebugInfo = imageEnhancementService.getAllActiveDebugInfo();

      logger.info('All Debug Info - Success', {
        totalActiveRequests: allDebugInfo.length
      });

      res.json({
        success: true,
        data: {
          activeRequests: allDebugInfo.length,
          debugInfo: allDebugInfo
        }
      });

    } catch (error) {
      logger.error('All Debug Info - Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: 'Failed to fetch debug information',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}