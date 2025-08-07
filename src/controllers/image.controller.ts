import { Request, Response, NextFunction } from 'express';
import { prisma } from '../prisma';
import { AuthRequest } from '../types';
import { ImageProcessingService } from '../services/image-processing.service';
import path from 'path';
import fs from 'fs';

const imageProcessingService = new ImageProcessingService();

export const uploadProductImages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { productId } = req.params;
    const partnerId = req.user!.partnerId;
    
    if (!partnerId) {
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    // Verify product belongs to partner
    const product = await prisma.product.findFirst({
      where: { id: productId, partnerId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files uploaded'
      });
    }

    // Get current image count for ordering
    const currentImageCount = await prisma.productImage.count({
      where: { productId }
    });

    const processedImages = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // Process the image
        const result = await imageProcessingService.processProductImage(
          file.path,
          file.filename
        );

        // Save to database
        const productImage = await prisma.productImage.create({
          data: {
            productId,
            originalUrl: result.originalUrl,
            processedUrl: result.processedUrl,
            thumbnailUrl: result.thumbnailUrl,
            order: currentImageCount + i,
            metadata: result.metadata
          }
        });

        processedImages.push(productImage);
      } catch (error) {
        console.error(`Error processing file ${file.filename}:`, error);
        // Continue with other files
      }
    }

    res.status(201).json({
      success: true,
      data: {
        images: processedImages,
        uploaded: processedImages.length,
        total: files.length
      }
    });
  } catch (error) {
    console.error('Error uploading product images:', error);
    next(error);
  }
};

export const deleteProductImage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { productId, imageId } = req.params;
    const partnerId = req.user!.partnerId;
    
    if (!partnerId) {
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    // Verify product belongs to partner
    const product = await prisma.product.findFirst({
      where: { id: productId, partnerId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find the image
    const productImage = await prisma.productImage.findFirst({
      where: { id: imageId, productId }
    });

    if (!productImage) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    // Delete files
    try {
      await imageProcessingService.deleteImage(productImage.originalUrl);
    } catch (error) {
      console.warn('Error deleting image files:', error);
    }

    // Delete from database
    await prisma.productImage.delete({
      where: { id: imageId }
    });

    res.json({
      success: true,
      message: 'Image deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting product image:', error);
    next(error);
  }
};

export const reorderProductImages = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { productId } = req.params;
    const { imageOrders } = req.body; // Array of { imageId, order }
    const partnerId = req.user!.partnerId;
    
    if (!partnerId) {
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    // Verify product belongs to partner
    const product = await prisma.product.findFirst({
      where: { id: productId, partnerId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Update image orders
    const updatePromises = imageOrders.map((item: { imageId: string; order: number }) =>
      prisma.productImage.update({
        where: { id: item.imageId, productId },
        data: { order: item.order }
      })
    );

    await Promise.all(updatePromises);

    // Return updated images
    const updatedImages = await prisma.productImage.findMany({
      where: { productId },
      orderBy: { order: 'asc' }
    });

    res.json({
      success: true,
      data: updatedImages
    });
  } catch (error) {
    console.error('Error reordering product images:', error);
    next(error);
  }
};

export const cropProductImage = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { productId, imageId } = req.params;
    const { cropData } = req.body; // { x, y, width, height }
    const partnerId = req.user!.partnerId;
    
    if (!partnerId) {
      return res.status(403).json({
        success: false,
        error: 'User is not associated with a partner'
      });
    }

    // Verify product belongs to partner
    const product = await prisma.product.findFirst({
      where: { id: productId, partnerId }
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    // Find the image
    const productImage = await prisma.productImage.findFirst({
      where: { id: imageId, productId }
    });

    if (!productImage) {
      return res.status(404).json({
        success: false,
        error: 'Image not found'
      });
    }

    // Get original file path
    const originalPath = path.join(
      process.env.UPLOAD_DIR || './uploads',
      'products',
      path.basename(productImage.originalUrl)
    );

    if (!fs.existsSync(originalPath)) {
      return res.status(404).json({
        success: false,
        error: 'Original image file not found'
      });
    }

    // Process cropped image
    const filename = path.basename(productImage.originalUrl);
    const result = await imageProcessingService.processProductImage(
      originalPath,
      filename,
      { crop: cropData }
    );

    // Update database record
    const updatedImage = await prisma.productImage.update({
      where: { id: imageId },
      data: {
        processedUrl: result.processedUrl,
        thumbnailUrl: result.thumbnailUrl,
        metadata: result.metadata
      }
    });

    res.json({
      success: true,
      data: updatedImage
    });
  } catch (error) {
    console.error('Error cropping product image:', error);
    next(error);
  }
};