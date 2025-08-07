import axios from 'axios';
import { randomUUID } from 'crypto';
import { ImageProcessingService } from './image-processing.service';

const GLAM_AI_API_KEY = '32iBMnBLSUrgRvZNhuRlNA';
const GLAM_AI_BASE_URL = 'https://api.glam.ai/api/v1';

export interface TryOnRequest {
  mask_type: 'overall';
}

export interface TryOnResponse {
  event_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'READY' | 'IN_QUEUE' | 'IN_PROGRESS';
  created_at: string;
}

export interface TryOnResult {
  event_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'READY' | 'IN_QUEUE' | 'IN_PROGRESS';
  result_url?: string;
  media_urls?: string[];
  error?: string;
  created_at: string;
  completed_at?: string;
}

export interface TryOnDebugInfo {
  requestId: string;
  timestamp: string;
  personImage: {
    filename: string;
    size: number;
    mimeType: string;
    path?: string;
  };
  garmentImage: {
    filename: string;
    size: number;
    mimeType: string;
    path?: string;
  };
  tryOnOptions: TryOnRequest;
  glamAiRequest: {
    url: string;
    headers: Record<string, string>;
    formDataFields: string[];
  };
  processingSteps: Array<{
    step: string;
    startTime: string;
    endTime?: string;
    duration?: number;
    status: 'success' | 'error' | 'warning' | 'in_progress';
    details?: any;
    error?: string;
  }>;
  result?: TryOnResponse | TryOnResult;
  error?: {
    code: string;
    message: string;
    stack?: string;
    glamAiResponse?: any;
  };
}

export interface TryOnServiceResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  debug: TryOnDebugInfo;
}

class GlamAITryOnService {
  private apiKey: string;
  private baseUrl: string;
  private imageProcessingService: ImageProcessingService;

  constructor() {
    this.apiKey = GLAM_AI_API_KEY;
    this.baseUrl = GLAM_AI_BASE_URL;
    this.imageProcessingService = new ImageProcessingService();
  }

  private getHeaders(): Record<string, string> {
    return {
      'accept': 'application/json',
      'X-API-Key': this.apiKey
    };
  }

  private createDebugInfo(requestId: string): TryOnDebugInfo {
    return {
      requestId,
      timestamp: new Date().toISOString(),
      personImage: { filename: '', size: 0, mimeType: '' },
      garmentImage: { filename: '', size: 0, mimeType: '' },
      tryOnOptions: { mask_type: 'overall' },
      glamAiRequest: {
        url: '',
        headers: {},
        formDataFields: []
      },
      processingSteps: []
    };
  }

  private addProcessingStep(
    debugInfo: TryOnDebugInfo, 
    step: string, 
    status: 'success' | 'error' | 'warning' | 'in_progress' = 'in_progress',
    details?: any,
    error?: string
  ): void {
    const stepInfo = {
      step,
      startTime: new Date().toISOString(),
      status,
      details,
      error
    };

    // Update existing step or add new one
    const existingIndex = debugInfo.processingSteps.findIndex(s => s.step === step);
    if (existingIndex >= 0) {
      const existing = debugInfo.processingSteps[existingIndex];
      debugInfo.processingSteps[existingIndex] = {
        ...existing,
        endTime: new Date().toISOString(),
        duration: Date.now() - new Date(existing.startTime).getTime(),
        status,
        details,
        error
      };
    } else {
      debugInfo.processingSteps.push(stepInfo);
    }

    console.log(`[Glam AI Try-On Service] ${step}:`, {
      requestId: debugInfo.requestId,
      status,
      details: details || undefined,
      error
    });
  }

  async createTryOn(
    personImageUrl: string,
    garmentImageUrl: string,
    personImageInfo: { filename: string, size: number, mimeType: string },
    garmentImageInfo: { filename: string, size: number, mimeType: string },
    options: TryOnRequest
  ): Promise<TryOnServiceResponse<TryOnResponse>> {
    const requestId = randomUUID();
    const debugInfo = this.createDebugInfo(requestId);
    const startTime = Date.now();

    console.log(`[Glam AI Try-On Service] Starting try-on creation:`, {
      requestId,
      personImage: personImageInfo,
      garmentImage: garmentImageInfo,
      options,
      timestamp: debugInfo.timestamp
    });

    try {
      // Initialize debug info
      debugInfo.personImage = { ...personImageInfo, path: personImageUrl };
      debugInfo.garmentImage = { ...garmentImageInfo, path: garmentImageUrl };
      debugInfo.tryOnOptions = options;

      this.addProcessingStep(debugInfo, 'initialize_request', 'success', {
        personImage: personImageInfo,
        garmentImage: garmentImageInfo,
        options
      });

      // Prepare JSON payload
      this.addProcessingStep(debugInfo, 'prepare_json_payload', 'in_progress');
      
      const requestPayload = {
        mask_type: options.mask_type,
        media_url: personImageUrl,
        garment_url: garmentImageUrl
      };

      debugInfo.glamAiRequest = {
        url: `${this.baseUrl}/tryon`,
        headers: {
          ...this.getHeaders(),
          'content-type': 'application/json'
        },
        formDataFields: ['mask_type', 'media_url', 'garment_url']
      };

      this.addProcessingStep(debugInfo, 'prepare_json_payload', 'success', {
        payload: requestPayload,
        url: debugInfo.glamAiRequest.url,
        personImageUrl,
        garmentImageUrl
      });

      // Make API request
      this.addProcessingStep(debugInfo, 'send_glam_ai_request', 'in_progress');

      console.log(`[Glam AI Try-On Service] Making request to Glam.ai:`, {
        requestId,
        url: `${this.baseUrl}/tryon`,
        method: 'POST',
        headers: debugInfo.glamAiRequest.headers,
        payload: requestPayload,
        payloadSize: JSON.stringify(requestPayload).length
      });

      const response = await axios.post(`${this.baseUrl}/tryon`, requestPayload, {
        headers: debugInfo.glamAiRequest.headers
      });

      console.log(`[Glam AI Try-On Service] Glam.ai request completed:`, {
        requestId,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });

      const result = response.data;

      const processingTime = Date.now() - startTime;

      console.log(`[Glam AI Try-On Service] Glam.ai API response:`, {
        requestId,
        status: response.status,
        statusText: response.statusText,
        processingTime,
        responseSize: JSON.stringify(result).length,
        hasEventId: !!result?.event_id
      });

      if (response.status >= 400) {
        this.addProcessingStep(debugInfo, 'send_glam_ai_request', 'error', {
          status: response.status,
          statusText: response.statusText,
          response: result
        }, `HTTP ${response.status}: ${response.statusText}`);

        debugInfo.error = {
          code: `GLAM_AI_HTTP_${response.status}`,
          message: `Try-on request failed: ${result?.error || response.statusText}`,
          glamAiResponse: result
        };

        return {
          success: false,
          error: debugInfo.error.message,
          debug: debugInfo
        };
      }

      this.addProcessingStep(debugInfo, 'send_glam_ai_request', 'success', {
        status: response.status,
        processingTime,
        eventId: result.event_id,
        responseKeys: Object.keys(result)
      });

      // Validate response
      this.addProcessingStep(debugInfo, 'validate_response', 'in_progress');

      if (!result.event_id) {
        this.addProcessingStep(debugInfo, 'validate_response', 'error', {
          result,
          missingField: 'event_id'
        }, 'Missing event_id in response');

        debugInfo.error = {
          code: 'INVALID_RESPONSE',
          message: 'Invalid response: missing event_id',
          glamAiResponse: result
        };

        return {
          success: false,
          error: debugInfo.error.message,
          debug: debugInfo
        };
      }

      this.addProcessingStep(debugInfo, 'validate_response', 'success', {
        eventId: result.event_id,
        status: result.status,
        createdAt: result.created_at
      });

      debugInfo.result = result;

      console.log(`[Glam AI Try-On Service] Try-on creation successful:`, {
        requestId,
        eventId: result.event_id,
        totalProcessingTime: processingTime,
        stepsCompleted: debugInfo.processingSteps.length
      });

      return {
        success: true,
        data: result,
        debug: debugInfo
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      console.error(`[Glam AI Try-On Service] Try-on creation failed:`, {
        requestId,
        error: errorMessage,
        processingTime,
        personImageUrl,
        garmentImageUrl
      });

      this.addProcessingStep(debugInfo, 'handle_error', 'error', {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        processingTime
      }, errorMessage);

      debugInfo.error = {
        code: 'CREATION_FAILED',
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      };

      return {
        success: false,
        error: errorMessage,
        debug: debugInfo
      };
    }
  }

  async getTryOnResult(
    eventId: string, 
    maxRetries: number = 3, 
    retryDelayMs: number = 2000
  ): Promise<TryOnServiceResponse<TryOnResult>> {
    const requestId = randomUUID();
    const debugInfo = this.createDebugInfo(requestId);
    const startTime = Date.now();

    // Safety check for eventId
    if (!eventId || eventId === 'undefined') {
      console.error(`[Glam AI Try-On Service] Invalid eventId received:`, {
        requestId,
        eventId,
        eventIdType: typeof eventId
      });
      
      debugInfo.error = {
        code: 'INVALID_EVENT_ID',
        message: `Invalid eventId: ${eventId}`,
      };

      return {
        success: false,
        error: debugInfo.error.message,
        debug: debugInfo
      };
    }

    console.log(`[Glam AI Try-On Service] Getting try-on result:`, {
      requestId,
      eventId,
      eventIdType: typeof eventId,
      eventIdLength: eventId?.length || 0,
      maxRetries,
      retryDelayMs,
      timestamp: debugInfo.timestamp
    });

    let attempts = 0;
    let lastResult: any = null;

    while (attempts <= maxRetries) {
      attempts++;
      const attemptStartTime = Date.now();

      try {
        this.addProcessingStep(debugInfo, `get_result_attempt_${attempts}`, 'in_progress', { 
          eventId, 
          attempt: attempts, 
          maxRetries: maxRetries + 1 
        });

        debugInfo.glamAiRequest = {
          url: `${this.baseUrl}/tryon/${eventId}`,
          headers: this.getHeaders(),
          formDataFields: []
        };

        console.log(`[Glam AI Try-On Service] Get result attempt ${attempts}/${maxRetries + 1}:`, {
          requestId,
          eventId,
          url: debugInfo.glamAiRequest.url
        });

        const response = await axios.get(`${this.baseUrl}/tryon/${eventId}`, {
          headers: this.getHeaders()
        });

        const result = response.data;

        const attemptDuration = Date.now() - attemptStartTime;
        lastResult = result;

        console.log(`[Glam AI Try-On Service] Get result attempt ${attempts} response:`, {
          requestId,
          eventId,
          status: response.status,
          resultStatus: result?.status,
          hasResultUrl: !!result?.result_url,
          attemptDuration,
          totalTime: Date.now() - startTime
        });

        if (response.status >= 400) {
          this.addProcessingStep(debugInfo, `get_result_attempt_${attempts}`, 'error', {
            status: response.status,
            statusText: response.statusText,
            response: result,
            attemptDuration
          }, `HTTP ${response.status}: ${response.statusText}`);

          // If it's a client error (4xx), don't retry
          if (response.status >= 400 && response.status < 500) {
            debugInfo.error = {
              code: `GLAM_AI_HTTP_${response.status}`,
              message: `Get result failed: ${result?.error || response.statusText}`,
              glamAiResponse: result
            };

            return {
              success: false,
              error: debugInfo.error.message,
              debug: debugInfo
            };
          }

          // For server errors (5xx), continue retrying
          if (attempts <= maxRetries) {
            console.log(`[Glam AI Try-On Service] Server error, retrying in ${retryDelayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            continue;
          } else {
            debugInfo.error = {
              code: `GLAM_AI_HTTP_${response.status}`,
              message: `Get result failed after ${attempts} attempts: ${result?.error || response.statusText}`,
              glamAiResponse: result
            };

            return {
              success: false,
              error: debugInfo.error.message,
              debug: debugInfo
            };
          }
        }

        this.addProcessingStep(debugInfo, `get_result_attempt_${attempts}`, 'success', {
          status: response.status,
          resultStatus: result.status,
          resultKeys: Object.keys(result),
          attemptDuration
        });

        // Check if result is ready or still processing
        if (result.status === 'completed' || result.status === 'READY' || result.status === 'failed') {
          // Final result - return immediately
          this.addProcessingStep(debugInfo, 'validate_final_result', 'success', {
            eventId: result.event_id,
            status: result.status,
            hasResultUrl: !!result.result_url,
            hasMediaUrls: !!result.media_urls,
            hasError: !!result.error,
            totalAttempts: attempts,
            totalTime: Date.now() - startTime
          });

          // If status is READY and we have media_urls, download them
          if (result.status === 'READY' && result.media_urls && result.media_urls.length > 0) {
            try {
              this.addProcessingStep(debugInfo, 'download_result_images', 'in_progress', {
                mediaUrlsCount: result.media_urls.length
              });

              console.log(`[Glam AI Try-On Service] Downloading ${result.media_urls.length} result images`);
              
              const downloadedImages = await this.imageProcessingService.downloadMultipleImages(
                result.media_urls,
                result.event_id
              );

              // Replace media_urls with local URLs
              result.media_urls = downloadedImages.map(img => img.localUrl);
              
              // Set the first local URL as the main result_url
              if (downloadedImages.length > 0) {
                result.result_url = downloadedImages[0].localUrl;
              }

              this.addProcessingStep(debugInfo, 'download_result_images', 'success', {
                downloadedCount: downloadedImages.length,
                localUrls: result.media_urls
              });

              console.log(`[Glam AI Try-On Service] Downloaded images successfully:`, {
                eventId: result.event_id,
                downloadedCount: downloadedImages.length,
                localUrls: result.media_urls
              });
            } catch (downloadError) {
              console.error(`[Glam AI Try-On Service] Failed to download result images:`, downloadError);
              this.addProcessingStep(debugInfo, 'download_result_images', 'error', 
                { error: downloadError instanceof Error ? downloadError.message : 'Unknown error' },
                'Failed to download result images'
              );
              // Continue with original URLs if download fails
            }
          }

          debugInfo.result = result;

          console.log(`[Glam AI Try-On Service] Final result received:`, {
            requestId,
            eventId,
            status: result.status,
            attempts,
            totalTime: Date.now() - startTime
          });

          return {
            success: true,
            data: result,
            debug: debugInfo
          };
        } else if (result.status === 'processing' || result.status === 'pending' || 
                   result.status === 'IN_QUEUE' || result.status === 'IN_PROGRESS') {
          // Still processing - retry if we have attempts left
          this.addProcessingStep(debugInfo, `still_processing_${attempts}`, 'warning', {
            resultStatus: result.status,
            attempt: attempts,
            maxRetries: maxRetries + 1,
            willRetry: attempts <= maxRetries
          }, `Result still processing: ${result.status}`);

          if (attempts <= maxRetries) {
            console.log(`[Glam AI Try-On Service] Result still processing (${result.status}), retrying in ${retryDelayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelayMs));
            continue;
          } else {
            // Max retries reached, return current status
            debugInfo.result = result;
            console.log(`[Glam AI Try-On Service] Max retries reached, returning current status:`, {
              requestId,
              eventId,
              status: result.status,
              attempts
            });

            return {
              success: true,
              data: result,
              debug: debugInfo
            };
          }
        } else {
          // Unknown status - return as is
          this.addProcessingStep(debugInfo, 'unknown_status_received', 'warning', {
            resultStatus: result.status,
            attempt: attempts
          }, `Unknown status received: ${result.status}`);

          debugInfo.result = result;

          return {
            success: true,
            data: result,
            debug: debugInfo
          };
        }

      } catch (error) {
        const attemptDuration = Date.now() - attemptStartTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        
        console.error(`[Glam AI Try-On Service] Get result attempt ${attempts} failed:`, {
          requestId,
          eventId,
          error: errorMessage,
          attempt: attempts,
          attemptDuration
        });

        this.addProcessingStep(debugInfo, `get_result_attempt_${attempts}`, 'error', {
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          attemptDuration,
          attempt: attempts
        }, errorMessage);

        // If it's the last attempt, return error
        if (attempts > maxRetries) {
          debugInfo.error = {
            code: 'GET_RESULT_FAILED',
            message: `Failed after ${attempts} attempts: ${errorMessage}`,
            stack: error instanceof Error ? error.stack : undefined
          };

          return {
            success: false,
            error: debugInfo.error.message,
            debug: debugInfo
          };
        }

        // Wait before retrying
        console.log(`[Glam AI Try-On Service] Retrying in ${retryDelayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelayMs));
      }
    }

    // This should never be reached, but just in case
    debugInfo.error = {
      code: 'GET_RESULT_FAILED',
      message: 'Unexpected end of retry loop',
      glamAiResponse: lastResult
    };

    return {
      success: false,
      error: debugInfo.error.message,
      debug: debugInfo
    };
  }

  async pollForResult(
    eventId: string, 
    maxAttempts: number = 30, 
    intervalMs: number = 10000
  ): Promise<TryOnServiceResponse<TryOnResult>> {
    const requestId = randomUUID();
    const debugInfo = this.createDebugInfo(requestId);
    const startTime = Date.now();

    console.log(`[Glam AI Try-On Service] Starting polling for result:`, {
      requestId,
      eventId,
      maxAttempts,
      intervalMs,
      estimatedMaxTime: `${(maxAttempts * intervalMs) / 1000}s`
    });

    try {
      this.addProcessingStep(debugInfo, 'initialize_polling', 'success', {
        eventId,
        maxAttempts,
        intervalMs
      });

      let attempts = 0;
      let lastResult: TryOnResult | null = null;

      while (attempts < maxAttempts) {
        attempts++;
        const attemptStartTime = Date.now();

        this.addProcessingStep(debugInfo, `polling_attempt_${attempts}`, 'in_progress', {
          attempt: attempts,
          maxAttempts
        });

        console.log(`[Glam AI Try-On Service] Polling attempt ${attempts}/${maxAttempts} for event: ${eventId}`);

        const resultResponse = await this.getTryOnResult(eventId, 1, 1000); // Single attempt with short delay for polling
        const attemptDuration = Date.now() - attemptStartTime;

        if (!resultResponse.success) {
          this.addProcessingStep(debugInfo, `polling_attempt_${attempts}`, 'error', {
            attempt: attempts,
            duration: attemptDuration,
            error: resultResponse.error
          }, `Attempt ${attempts} failed: ${resultResponse.error}`);

          // Continue polling on API errors unless it's a permanent error
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, intervalMs));
            continue;
          } else {
            throw new Error(`Polling failed after ${attempts} attempts: ${resultResponse.error}`);
          }
        }

        lastResult = resultResponse.data!;

        this.addProcessingStep(debugInfo, `polling_attempt_${attempts}`, 'success', {
          attempt: attempts,
          duration: attemptDuration,
          status: lastResult.status,
          hasResultUrl: !!lastResult.result_url
        });

        if (lastResult.status === 'completed' || lastResult.status === 'READY') {
          const totalTime = Date.now() - startTime;
          this.addProcessingStep(debugInfo, 'polling_completed', 'success', {
            totalAttempts: attempts,
            totalTime,
            resultUrl: lastResult.result_url
          });

          debugInfo.result = lastResult;

          console.log(`[Glam AI Try-On Service] Polling completed successfully:`, {
            requestId,
            eventId,
            attempts,
            totalTime,
            resultUrl: lastResult.result_url
          });

          return {
            success: true,
            data: lastResult,
            debug: debugInfo
          };
        }

        if (lastResult.status === 'failed') {
          this.addProcessingStep(debugInfo, 'polling_failed', 'error', {
            attempts,
            error: lastResult.error
          }, `Try-on processing failed: ${lastResult.error}`);

          debugInfo.error = {
            code: 'TRYON_PROCESSING_FAILED',
            message: lastResult.error || 'Try-on processing failed',
            glamAiResponse: lastResult
          };

          return {
            success: false,
            error: debugInfo.error.message,
            debug: debugInfo
          };
        }

        // Continue polling
        if (attempts < maxAttempts) {
          console.log(`[Glam AI Try-On Service] Status: ${lastResult.status}, waiting ${intervalMs}ms before next attempt`);
          await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
      }

      // Timeout reached
      const totalTime = Date.now() - startTime;
      this.addProcessingStep(debugInfo, 'polling_timeout', 'error', {
        totalAttempts: attempts,
        totalTime,
        lastStatus: lastResult?.status
      }, `Polling timed out after ${attempts} attempts`);

      debugInfo.error = {
        code: 'POLLING_TIMEOUT',
        message: `Try-on processing timed out after ${attempts} attempts (${totalTime}ms)`,
        glamAiResponse: lastResult
      };

      return {
        success: false,
        error: debugInfo.error.message,
        debug: debugInfo
      };

    } catch (error) {
      const totalTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown polling error';
      
      console.error(`[Glam AI Try-On Service] Polling error:`, {
        requestId,
        eventId,
        error: errorMessage,
        totalTime
      });

      this.addProcessingStep(debugInfo, 'polling_error', 'error', {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        totalTime
      }, errorMessage);

      debugInfo.error = {
        code: 'POLLING_ERROR',
        message: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      };

      return {
        success: false,
        error: errorMessage,
        debug: debugInfo
      };
    }
  }
}

export const glamAITryOnService = new GlamAITryOnService();