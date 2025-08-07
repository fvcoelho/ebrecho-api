import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', 'test');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Test upload endpoint - POST /api/test-upload
router.post('/', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a file to upload'
      });
    }

    const file = req.file;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `/uploads/test/${file.filename}`;

    // Return upload information
    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        originalName: file.originalname,
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype,
        path: file.path,
        url: `${baseUrl}${fileUrl}`,
        relativePath: fileUrl
      },
      metadata: {
        uploadedAt: new Date().toISOString(),
        uploadDir: file.destination,
        sizeFormatted: `${(file.size / 1024 / 1024).toFixed(2)} MB`
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get upload info - GET /api/test-upload
router.get('/', (req: Request, res: Response) => {
  const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', 'test');
  
  try {
    // Check if upload directory exists
    const dirExists = fs.existsSync(uploadDir);
    let files: string[] = [];
    
    if (dirExists) {
      files = fs.readdirSync(uploadDir).filter(file => {
        const ext = path.extname(file).toLowerCase();
        return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
      });
    }

    res.json({
      endpoint: '/api/test-upload',
      method: 'POST',
      contentType: 'multipart/form-data',
      fieldName: 'file',
      maxFileSize: '10MB',
      allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      uploadDir,
      dirExists,
      existingFiles: files.length,
      files: files.slice(0, 10), // Show max 10 files
      usage: {
        upload: 'POST /api/test-upload with form-data field "file"',
        info: 'GET /api/test-upload for this information'
      }
    });
  } catch (error) {
    console.error('Error reading upload directory:', error);
    res.status(500).json({
      error: 'Failed to read upload directory',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Delete test file - DELETE /api/test-upload/:filename
router.delete('/:filename', (req: Request, res: Response) => {
  try {
    const filename = req.params.filename;
    const uploadDir = path.join(process.env.UPLOAD_DIR || './uploads', 'test');
    const filePath = path.join(uploadDir, filename);

    // Security check - ensure file is in upload directory
    if (!filePath.startsWith(uploadDir)) {
      return res.status(400).json({
        error: 'Invalid filename',
        message: 'Filename contains invalid characters'
      });
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'File not found',
        message: 'The specified file does not exist'
      });
    }

    // Delete file
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: 'File deleted successfully',
      filename
    });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      error: 'Delete failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;