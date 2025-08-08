import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import axios from 'axios';
import { randomUUID } from 'crypto';

export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  crop?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ProcessedImageResult {
  originalUrl: string;
  processedUrl: string;
  thumbnailUrl: string;
  metadata: {
    width: number;
    height: number;
    format: string;
    size: number;
  };
}

export interface DownloadedImageResult {
  localPath: string;
  localUrl: string;
  filename: string;
  originalUrl: string;
}

export class ImageProcessingService {
  private readonly uploadDir: string;
  private readonly processedDir: string;
  private readonly thumbnailDir: string;
  private readonly tryonDir: string;

  constructor() {
    // Use /tmp directory for serverless environments
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
    this.uploadDir = isServerless ? '/tmp/uploads' : (process.env.UPLOAD_DIR || './uploads');
    this.processedDir = path.join(this.uploadDir, 'processed');
    this.thumbnailDir = path.join(this.uploadDir, 'thumbnails');
    this.tryonDir = path.join(this.uploadDir, 'tryon');
    
    // Only try to create directories in non-serverless environments
    if (!isServerless) {
      this.ensureDirectories();
    }
  }

  private ensureDirectories() {
    [this.processedDir, this.thumbnailDir, this.tryonDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  private async ensureDirectoryExists(dir: string) {
    try {
      await fsPromises.access(dir);
    } catch {
      await fsPromises.mkdir(dir, { recursive: true });
    }
  }

  async processProductImage(
    filePath: string,
    filename: string,
    options: ImageProcessingOptions = {}
  ): Promise<ProcessedImageResult> {
    try {
      // Ensure directories exist when actually processing
      await this.ensureDirectoryExists(this.processedDir);
      await this.ensureDirectoryExists(this.thumbnailDir);
      
      const originalPath = filePath;
      const baseFilename = path.parse(filename).name;
      
      // Get original image metadata
      const originalMetadata = await sharp(originalPath).metadata();
      
      let sharpInstance = sharp(originalPath);

      // Apply crop if specified
      if (options.crop) {
        sharpInstance = sharpInstance.extract({
          left: options.crop.x,
          top: options.crop.y,
          width: options.crop.width,
          height: options.crop.height
        });
      }

      // Process main image (800x600 max, maintain aspect ratio)
      const processedFilename = `${baseFilename}_processed.webp`;
      const processedPath = path.join(this.processedDir, processedFilename);
      
      const processedImage = await sharpInstance
        .clone()
        .resize(800, 600, { 
          fit: 'inside',
          withoutEnlargement: true 
        })
        .webp({ quality: options.quality || 85 })
        .toFile(processedPath);

      // Create thumbnail (300x300)
      const thumbnailFilename = `${baseFilename}_thumb.webp`;
      const thumbnailPath = path.join(this.thumbnailDir, thumbnailFilename);
      
      await sharpInstance
        .clone()
        .resize(300, 300, { 
          fit: 'cover',
          position: 'center' 
        })
        .webp({ quality: 75 })
        .toFile(thumbnailPath);

      // Create small thumbnail (150x150)
      const smallThumbFilename = `${baseFilename}_thumb_small.webp`;
      const smallThumbPath = path.join(this.thumbnailDir, smallThumbFilename);
      
      await sharpInstance
        .resize(150, 150, { 
          fit: 'cover',
          position: 'center' 
        })
        .webp({ quality: 70 })
        .toFile(smallThumbPath);

      return {
        originalUrl: `/uploads/products/${filename}`,
        processedUrl: `/uploads/processed/${processedFilename}`,
        thumbnailUrl: `/uploads/thumbnails/${thumbnailFilename}`,
        metadata: {
          width: processedImage.width,
          height: processedImage.height,
          format: processedImage.format,
          size: processedImage.size
        }
      };
    } catch (error) {
      console.error('Error processing image:', error);
      throw new Error('Failed to process image');
    }
  }

  async deleteImage(imageUrl: string): Promise<void> {
    try {
      // Extract filename from URL and delete all variants
      const filename = path.basename(imageUrl);
      const baseFilename = path.parse(filename).name;
      
      const filesToDelete = [
        path.join(this.uploadDir, 'products', filename),
        path.join(this.processedDir, `${baseFilename}_processed.webp`),
        path.join(this.thumbnailDir, `${baseFilename}_thumb.webp`),
        path.join(this.thumbnailDir, `${baseFilename}_thumb_small.webp`)
      ];

      await Promise.all(
        filesToDelete.map(async (filePath) => {
          try {
            if (fs.existsSync(filePath)) {
              await fsPromises.unlink(filePath);
            }
          } catch (error) {
            console.warn(`Failed to delete file: ${filePath}`, error);
          }
        })
      );
    } catch (error) {
      console.error('Error deleting image:', error);
      throw new Error('Failed to delete image');
    }
  }

  async cropImage(
    originalPath: string,
    cropData: { x: number; y: number; width: number; height: number },
    outputPath: string
  ): Promise<void> {
    try {
      await sharp(originalPath)
        .extract({
          left: Math.round(cropData.x),
          top: Math.round(cropData.y),
          width: Math.round(cropData.width),
          height: Math.round(cropData.height)
        })
        .toFile(outputPath);
    } catch (error) {
      console.error('Error cropping image:', error);
      throw new Error('Failed to crop image');
    }
  }

  async downloadImageFromUrl(
    imageUrl: string,
    eventId?: string
  ): Promise<DownloadedImageResult> {
    try {
      console.log(`[ImageProcessingService] Downloading image from URL: ${imageUrl}`);
      
      // Ensure tryon directory exists when actually downloading
      await this.ensureDirectoryExists(this.tryonDir);
      
      // Generate unique filename
      const timestamp = Date.now();
      const uniqueId = randomUUID().substring(0, 8);
      const extension = path.extname(imageUrl.split('?')[0]) || '.jpg';
      const filename = `tryon_${eventId || uniqueId}_${timestamp}${extension}`;
      const localPath = path.join(this.tryonDir, filename);
      
      // Download the image
      const response = await axios({
        method: 'GET',
        url: imageUrl,
        responseType: 'stream',
        timeout: 30000, // 30 second timeout
        headers: {
          'User-Agent': 'eBrecho/1.0'
        }
      });

      // Create write stream
      const writer = fs.createWriteStream(localPath);

      // Pipe the response data to the file
      response.data.pipe(writer);

      // Wait for the download to complete
      await new Promise<void>((resolve, reject) => {
        writer.on('finish', () => resolve());
        writer.on('error', reject);
        response.data.on('error', reject);
      });

      console.log(`[ImageProcessingService] Image downloaded successfully: ${filename}`);

      // Return the local path and URL
      return {
        localPath,
        localUrl: `/uploads/tryon/${filename}`,
        filename,
        originalUrl: imageUrl
      };
    } catch (error) {
      console.error('[ImageProcessingService] Error downloading image:', error);
      throw new Error(`Failed to download image: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async downloadMultipleImages(
    imageUrls: string[],
    eventId?: string
  ): Promise<DownloadedImageResult[]> {
    try {
      console.log(`[ImageProcessingService] Downloading ${imageUrls.length} images`);
      
      const downloadPromises = imageUrls.map((url, index) => 
        this.downloadImageFromUrl(url, eventId ? `${eventId}_${index}` : undefined)
      );

      const results = await Promise.all(downloadPromises);
      
      console.log(`[ImageProcessingService] Successfully downloaded ${results.length} images`);
      return results;
    } catch (error) {
      console.error('[ImageProcessingService] Error downloading multiple images:', error);
      throw new Error(`Failed to download images: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}