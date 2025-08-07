import { logger } from '../utils/logger';

export interface EnhancementOptions {
  category?: string;
  quality: 'standard' | 'premium';
  backgroundRemoval: boolean;
  autoOptimize: boolean;
  provider?: 'deep-image' | 'photoroom' | 'claid';
}

export interface EnhancementResult {
  originalUrl: string;
  enhancedUrl: string;
  provider: string;
  processingTime: number;
  qualityScore?: number;
  cost: number;
  metadata: {
    originalSize: number;
    enhancedSize: number;
    dimensions: { width: number; height: number };
    enhancementType: string[];
  };
}

export interface EnhancementDebugInfo {
  requestId: string;
  timestamp: string;
  originalImage: {
    filename: string;
    size: number;
    dimensions: { width: number; height: number };
    mimeType: string;
  };
  enhancementOptions: EnhancementOptions;
  providerSelection: {
    selectedProvider: string;
    reason: string;
    availableProviders: string[];
  };
  processingSteps: Array<{
    step: string;
    startTime: string;
    endTime: string;
    duration: number;
    status: 'success' | 'error' | 'warning';
    details?: any;
  }>;
  result?: EnhancementResult;
  error?: {
    code: string;
    message: string;
    stack?: string;
    provider?: string;
  };
}

class ImageEnhancementService {
  private debugInfo: Map<string, EnhancementDebugInfo> = new Map();

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeDebugInfo(requestId: string, imageFile: any, options: EnhancementOptions): EnhancementDebugInfo {
    const debugInfo: EnhancementDebugInfo = {
      requestId,
      timestamp: new Date().toISOString(),
      originalImage: {
        filename: imageFile.originalname || imageFile.filename || 'unknown',
        size: imageFile.size || 0,
        dimensions: { width: 0, height: 0 }, // Will be populated after image analysis
        mimeType: imageFile.mimetype || 'unknown'
      },
      enhancementOptions: { ...options },
      providerSelection: {
        selectedProvider: '',
        reason: '',
        availableProviders: ['deep-image', 'photoroom', 'claid']
      },
      processingSteps: []
    };

    this.debugInfo.set(requestId, debugInfo);
    
    logger.info('AI Enhancement Request Initialized', {
      requestId,
      originalImage: debugInfo.originalImage,
      options: debugInfo.enhancementOptions
    });

    return debugInfo;
  }

  private addProcessingStep(requestId: string, step: string, status: 'success' | 'error' | 'warning', details?: any) {
    const debugInfo = this.debugInfo.get(requestId);
    if (!debugInfo) return;

    const stepInfo = {
      step,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 0,
      status,
      details
    };

    debugInfo.processingSteps.push(stepInfo);

    logger.info('AI Enhancement Processing Step', {
      requestId,
      step,
      status,
      details
    });
  }

  private selectProvider(options: EnhancementOptions, debugInfo: EnhancementDebugInfo): string {
    let selectedProvider: string;
    let reason: string;

    if (options.provider) {
      selectedProvider = options.provider;
      reason = 'Provider explicitly specified by user';
    } else if (options.quality === 'premium') {
      selectedProvider = 'claid';
      reason = 'Premium quality requested - using Claid API for best results';
    } else if (options.backgroundRemoval) {
      selectedProvider = 'photoroom';
      reason = 'Background removal requested - using Photoroom specialized service';
    } else {
      selectedProvider = 'deep-image';
      reason = 'Standard enhancement - using Deep Image for cost-effectiveness';
    }

    debugInfo.providerSelection = {
      selectedProvider,
      reason,
      availableProviders: debugInfo.providerSelection.availableProviders
    };

    logger.info('AI Enhancement Provider Selected', {
      requestId: debugInfo.requestId,
      provider: selectedProvider,
      reason,
      options
    });

    return selectedProvider;
  }

  private async analyzeImage(imageFile: any, requestId: string): Promise<{ width: number; height: number }> {
    const debugInfo = this.debugInfo.get(requestId);
    const stepStart = Date.now();

    try {
      // Mock image analysis - in real implementation, use Sharp or similar
      const dimensions = { width: 1200, height: 800 }; // Placeholder
      
      if (debugInfo) {
        debugInfo.originalImage.dimensions = dimensions;
      }

      this.addProcessingStep(requestId, 'Image Analysis', 'success', {
        dimensions,
        duration: Date.now() - stepStart
      });

      return dimensions;
    } catch (error) {
      this.addProcessingStep(requestId, 'Image Analysis', 'error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - stepStart
      });
      throw error;
    }
  }

  private async callDeepImageAPI(imageFile: any, options: EnhancementOptions, requestId: string): Promise<EnhancementResult> {
    const stepStart = Date.now();
    
    try {
      logger.info('Deep Image API Call Started', {
        requestId,
        options,
        filename: imageFile.filename
      });

      // Mock API call - replace with actual Deep Image API integration
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API delay

      const result: EnhancementResult = {
        originalUrl: `/uploads/products/${imageFile.filename}`,
        enhancedUrl: `/uploads/enhanced/${imageFile.filename}`,
        provider: 'deep-image',
        processingTime: Date.now() - stepStart,
        qualityScore: 0.85,
        cost: 0.03,
        metadata: {
          originalSize: imageFile.size,
          enhancedSize: Math.floor(imageFile.size * 1.2),
          dimensions: { width: 1200, height: 800 },
          enhancementType: ['noise_reduction', 'sharpening', 'color_correction']
        }
      };

      this.addProcessingStep(requestId, 'Deep Image API Processing', 'success', {
        processingTime: result.processingTime,
        qualityScore: result.qualityScore,
        cost: result.cost
      });

      logger.info('Deep Image API Call Completed', {
        requestId,
        result: {
          processingTime: result.processingTime,
          qualityScore: result.qualityScore,
          cost: result.cost
        }
      });

      return result;
    } catch (error) {
      this.addProcessingStep(requestId, 'Deep Image API Processing', 'error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - stepStart
      });
      
      logger.error('Deep Image API Call Failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  private async callPhotoroomAPI(imageFile: any, options: EnhancementOptions, requestId: string): Promise<EnhancementResult> {
    const stepStart = Date.now();
    
    try {
      logger.info('Photoroom API Call Started', {
        requestId,
        options,
        filename: imageFile.filename
      });

      // Mock API call - replace with actual Photoroom API integration
      await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate API delay

      const result: EnhancementResult = {
        originalUrl: `/uploads/products/${imageFile.filename}`,
        enhancedUrl: `/uploads/enhanced/${imageFile.filename}`,
        provider: 'photoroom',
        processingTime: Date.now() - stepStart,
        qualityScore: 0.90,
        cost: 0.05,
        metadata: {
          originalSize: imageFile.size,
          enhancedSize: Math.floor(imageFile.size * 0.8),
          dimensions: { width: 1200, height: 800 },
          enhancementType: ['background_removal', 'edge_refinement', 'color_correction']
        }
      };

      this.addProcessingStep(requestId, 'Photoroom API Processing', 'success', {
        processingTime: result.processingTime,
        qualityScore: result.qualityScore,
        cost: result.cost
      });

      logger.info('Photoroom API Call Completed', {
        requestId,
        result: {
          processingTime: result.processingTime,
          qualityScore: result.qualityScore,
          cost: result.cost
        }
      });

      return result;
    } catch (error) {
      this.addProcessingStep(requestId, 'Photoroom API Processing', 'error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - stepStart
      });
      
      logger.error('Photoroom API Call Failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  private async callClaidAPI(imageFile: any, options: EnhancementOptions, requestId: string): Promise<EnhancementResult> {
    const stepStart = Date.now();
    
    try {
      logger.info('Claid API Call Started', {
        requestId,
        options,
        filename: imageFile.filename
      });

      // Mock API call - replace with actual Claid API integration
      await new Promise(resolve => setTimeout(resolve, 4000)); // Simulate API delay

      const result: EnhancementResult = {
        originalUrl: `/uploads/products/${imageFile.filename}`,
        enhancedUrl: `/uploads/enhanced/${imageFile.filename}`,
        provider: 'claid',
        processingTime: Date.now() - stepStart,
        qualityScore: 0.95,
        cost: 0.08,
        metadata: {
          originalSize: imageFile.size,
          enhancedSize: Math.floor(imageFile.size * 1.5),
          dimensions: { width: 1600, height: 1200 },
          enhancementType: ['upscaling', 'noise_reduction', 'color_correction', 'sharpening', 'lighting_adjustment']
        }
      };

      this.addProcessingStep(requestId, 'Claid API Processing', 'success', {
        processingTime: result.processingTime,
        qualityScore: result.qualityScore,
        cost: result.cost
      });

      logger.info('Claid API Call Completed', {
        requestId,
        result: {
          processingTime: result.processingTime,
          qualityScore: result.qualityScore,
          cost: result.cost
        }
      });

      return result;
    } catch (error) {
      this.addProcessingStep(requestId, 'Claid API Processing', 'error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - stepStart
      });
      
      logger.error('Claid API Call Failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  async enhanceImage(imageFile: any, options: EnhancementOptions = { quality: 'standard', backgroundRemoval: false, autoOptimize: true }): Promise<{ result: EnhancementResult; debugInfo: EnhancementDebugInfo }> {
    const requestId = this.generateRequestId();
    const debugInfo = this.initializeDebugInfo(requestId, imageFile, options);

    try {
      // Step 1: Analyze image
      await this.analyzeImage(imageFile, requestId);

      // Step 2: Select provider
      const provider = this.selectProvider(options, debugInfo);

      // Step 3: Call appropriate API
      let result: EnhancementResult;
      
      switch (provider) {
        case 'claid':
          result = await this.callClaidAPI(imageFile, options, requestId);
          break;
        case 'photoroom':
          result = await this.callPhotoroomAPI(imageFile, options, requestId);
          break;
        case 'deep-image':
        default:
          result = await this.callDeepImageAPI(imageFile, options, requestId);
          break;
      }

      debugInfo.result = result;

      logger.info('AI Enhancement Completed Successfully', {
        requestId,
        provider,
        processingTime: result.processingTime,
        qualityScore: result.qualityScore,
        cost: result.cost,
        totalSteps: debugInfo.processingSteps.length
      });

      return { result, debugInfo };

    } catch (error) {
      const errorInfo = {
        code: 'ENHANCEMENT_FAILED',
        message: error instanceof Error ? error.message : 'Unknown enhancement error',
        stack: error instanceof Error ? error.stack : undefined,
        provider: debugInfo.providerSelection.selectedProvider
      };

      debugInfo.error = errorInfo;

      logger.error('AI Enhancement Failed', {
        requestId,
        error: errorInfo,
        processingSteps: debugInfo.processingSteps.length
      });

      throw error;
    } finally {
      // Cleanup debug info after 1 hour to prevent memory leaks
      setTimeout(() => {
        this.debugInfo.delete(requestId);
      }, 3600000);
    }
  }

  async batchProcess(images: any[], options: EnhancementOptions = { quality: 'standard', backgroundRemoval: false, autoOptimize: true }): Promise<Array<{ result: EnhancementResult; debugInfo: EnhancementDebugInfo }>> {
    const batchId = this.generateRequestId();
    
    logger.info('Batch AI Enhancement Started', {
      batchId,
      imageCount: images.length,
      options
    });

    try {
      const results = await Promise.all(
        images.map(async (image, index) => {
          try {
            const imageOptions = { ...options };
            const result = await this.enhanceImage(image, imageOptions);
            
            logger.info('Batch Image Enhancement Completed', {
              batchId,
              imageIndex: index,
              requestId: result.debugInfo.requestId,
              status: 'success'
            });
            
            return result;
          } catch (error) {
            logger.error('Batch Image Enhancement Failed', {
              batchId,
              imageIndex: index,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            throw error;
          }
        })
      );

      logger.info('Batch AI Enhancement Completed', {
        batchId,
        totalImages: images.length,
        successfulEnhancements: results.length,
        totalCost: results.reduce((sum, r) => sum + r.result.cost, 0),
        averageProcessingTime: results.reduce((sum, r) => sum + r.result.processingTime, 0) / results.length
      });

      return results;
    } catch (error) {
      logger.error('Batch AI Enhancement Failed', {
        batchId,
        imageCount: images.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  getDebugInfo(requestId: string): EnhancementDebugInfo | null {
    return this.debugInfo.get(requestId) || null;
  }

  getAllActiveDebugInfo(): EnhancementDebugInfo[] {
    return Array.from(this.debugInfo.values());
  }
}

export const imageEnhancementService = new ImageEnhancementService();