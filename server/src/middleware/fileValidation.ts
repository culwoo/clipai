import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { HttpError, ValidationError } from './errorHandler';

// File type validation
const allowedMimeTypes = [
  'video/mp4',
  'video/avi',
  'video/mov',
  'video/wmv',
  'video/flv',
  'video/webm',
  'video/mkv',
  'video/m4v',
  'video/3gp',
  'video/quicktime'
];

const allowedExtensions = [
  '.mp4', '.avi', '.mov', '.wmv', '.flv', 
  '.webm', '.mkv', '.m4v', '.3gp', '.qt'
];

// Maximum file size (50MB)
const maxFileSize = 50 * 1024 * 1024;

// Minimum file size (1KB)
const minFileSize = 1024;

// Check file signature (magic bytes) for security
const getFileSignature = (filePath: string): Buffer => {
  const buffer = Buffer.alloc(16);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);
  return buffer;
};

const isValidVideoFile = (filePath: string, mimeType: string): boolean => {
  const signature = getFileSignature(filePath);
  
  // Common video file signatures
  const videoSignatures = [
    // MP4
    [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70],
    [0x00, 0x00, 0x00, 0x1C, 0x66, 0x74, 0x79, 0x70],
    [0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70],
    // AVI
    [0x52, 0x49, 0x46, 0x46],
    // MOV/QuickTime
    [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74],
    // WebM
    [0x1A, 0x45, 0xDF, 0xA3],
    // FLV
    [0x46, 0x4C, 0x56, 0x01],
    // 3GP
    [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x33, 0x67, 0x70]
  ];

  // Check if file signature matches any known video format
  for (const sig of videoSignatures) {
    let matches = true;
    for (let i = 0; i < sig.length && i < signature.length; i++) {
      if (signature[i] !== sig[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }

  return false;
};

// Custom file filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Check MIME type
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new ValidationError(`Invalid file type. Only video files are allowed.`, {
      allowedTypes: allowedMimeTypes,
      receivedType: file.mimetype
    }));
  }

  // Check file extension
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext)) {
    return cb(new ValidationError(`Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`, {
      allowedExtensions,
      receivedExtension: ext
    }));
  }

  cb(null, true);
};

// File size validation middleware
export const validateFileSize = (req: any, res: any, next: any) => {
  if (!req.file) {
    return next();
  }

  const fileSize = req.file.size;

  if (fileSize > maxFileSize) {
    // Clean up uploaded file asynchronously
    fs.unlink(req.file.path, (err) => {
      if (err) console.error('Failed to clean up oversized file:', err);
    });
    
    return next(new ValidationError(`File too large. Maximum size is ${maxFileSize / 1024 / 1024}MB`, {
      maxSize: maxFileSize,
      receivedSize: fileSize
    }));
  }

  if (fileSize < minFileSize) {
    fs.unlinkSync(req.file.path); // Clean up uploaded file
    return next(new ValidationError(`File too small. Minimum size is ${minFileSize / 1024}KB`, {
      minSize: minFileSize,
      receivedSize: fileSize
    }));
  }

  next();
};

// File content validation middleware
export const validateFileContent = (req: any, res: any, next: any) => {
  if (!req.file) {
    return next();
  }

  try {
    const isValid = isValidVideoFile(req.file.path, req.file.mimetype);
    
    if (!isValid) {
      fs.unlinkSync(req.file.path); // Clean up uploaded file
      return next(new ValidationError('File appears to be corrupted or not a valid video file', {
        fileName: req.file.originalname,
        mimeType: req.file.mimetype
      }));
    }

    next();
  } catch (error) {
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path); // Clean up uploaded file
    }
    next(new HttpError('Error validating file content', 500));
  }
};

// Security validation middleware
export const validateFileSecurity = (req: any, res: any, next: any) => {
  if (!req.file) {
    return next();
  }

  // Check for suspicious file names
  const fileName = req.file.originalname;
  const suspiciousPatterns = [
    /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|bin)$/i,
    /[\x00-\x1f\x7f-\x9f]/,  // Control characters
    /\.\.\/\.\.\//,  // Path traversal
    /__MACOSX/,  // macOS metadata
    /desktop\.ini/i,  // Windows metadata
    /thumbs\.db/i,   // Windows thumbnails
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(fileName)) {
      fs.unlinkSync(req.file.path); // Clean up uploaded file
      return next(new ValidationError('Suspicious file name detected', {
        fileName,
        pattern: pattern.toString()
      }));
    }
  }

  // Check file path length
  if (fileName.length > 255) {
    fs.unlinkSync(req.file.path); // Clean up uploaded file
    return next(new ValidationError('File name too long', {
      maxLength: 255,
      receivedLength: fileName.length
    }));
  }

  next();
};

// Virus scanning placeholder (would integrate with actual antivirus in production)
export const validateAntiVirus = (req: any, res: any, next: any) => {
  if (!req.file) {
    return next();
  }

  // In production, integrate with antivirus API like:
  // - ClamAV
  // - VirusTotal API
  // - Windows Defender API
  // - Cloud-based scanning services

  console.log(`[SECURITY] File scan: ${req.file.originalname} - Clean (mock)`);
  next();
};

// Rate limiting for file uploads per IP
const uploadAttempts = new Map<string, { count: number; resetTime: number }>();

export const validateUploadRate = (req: any, res: any, next: any) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxUploads = 10; // Max 10 uploads per hour per IP

  const attempt = uploadAttempts.get(ip);
  
  if (!attempt) {
    uploadAttempts.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (now > attempt.resetTime) {
    uploadAttempts.set(ip, { count: 1, resetTime: now + windowMs });
    return next();
  }

  if (attempt.count >= maxUploads) {
    return next(new ValidationError('Upload rate limit exceeded. Please try again later.', {
      maxUploads,
      windowMs,
      nextReset: new Date(attempt.resetTime).toISOString()
    }));
  }

  attempt.count++;
  next();
};

// Configure multer with security validations
export const createSecureUpload = (uploadPath: string) => {
  // Ensure upload directory exists and is secure
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true, mode: 0o755 });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      // Generate secure filename
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2);
      const ext = path.extname(file.originalname).toLowerCase();
      const secureFilename = `upload_${timestamp}_${random}${ext}`;
      cb(null, secureFilename);
    },
  });

  return multer({
    storage,
    fileFilter,
    limits: {
      fileSize: maxFileSize,
      files: 1, // Only allow single file upload
      fields: 10, // Limit form fields
      fieldNameSize: 100, // Limit field name size
      fieldSize: 1024, // Limit field value size
    },
  });
};