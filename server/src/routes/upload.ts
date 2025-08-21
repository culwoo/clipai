import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../database/init';
import { HttpError } from '../middleware/errorHandler';
import { AuthRequest, authenticateToken, optionalAuth } from '../middleware/auth';
import { 
  createSecureUpload, 
  validateFileSize, 
  validateFileContent, 
  validateFileSecurity,
  validateAntiVirus,
  validateUploadRate
} from '../middleware/fileValidation';

const router = express.Router();

// Create secure upload configuration with enhanced security
const uploadPath = path.join(process.env.UPLOAD_PATH || './uploads', 'videos');
const upload = createSecureUpload(uploadPath);

// Upload video file with comprehensive security validation
router.post('/video', 
  optionalAuth, 
  validateUploadRate,
  upload.single('video'), 
  validateFileSize,
  validateFileContent,
  validateFileSecurity,
  validateAntiVirus,
  async (req: AuthRequest, res, next) => {
  try {
    if (!req.file) {
      throw new HttpError('No video file provided', 400);
    }

    const { originalname, filename, size, mimetype, path: filePath } = req.file;
    
    // Save video metadata to database
    const videoId = await new Promise<number>((resolve, reject) => {
      db.run(
        `INSERT INTO videos (user_id, original_filename, file_path, file_size, mime_type, status) 
         VALUES (?, ?, ?, ?, ?, 'uploaded')`,
        [req.user?.id || null, originalname, filename, size, mimetype],
        function (err) {
          if (err) reject(err);
          else resolve(this.lastID);
        }
      );
    });

    res.json({
      message: 'Video uploaded successfully',
      video: {
        id: videoId,
        originalName: originalname,
        size,
        type: mimetype,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    // Clean up uploaded file if database save failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
});

// Get video metadata
router.get('/video/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const videoId = parseInt(req.params.id);
    
    if (isNaN(videoId)) {
      throw new HttpError('Invalid video ID', 400);
    }

    const video = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT v.*, u.email as uploader_email 
         FROM videos v 
         LEFT JOIN users u ON v.user_id = u.id 
         WHERE v.id = ?`,
        [videoId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!video) {
      throw new HttpError('Video not found', 404);
    }

    // Check if user has access to this video
    if (video.user_id && (!req.user || req.user.id !== video.user_id)) {
      throw new HttpError('Access denied', 403);
    }

    res.json({
      id: video.id,
      originalName: video.original_filename,
      size: video.file_size,
      type: video.mime_type,
      duration: video.duration,
      width: video.width,
      height: video.height,
      status: video.status,
      uploadedAt: video.created_at,
      uploader: video.uploader_email,
    });
  } catch (error) {
    next(error);
  }
});

// Delete video
router.delete('/video/:id', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const videoId = parseInt(req.params.id);
    
    if (isNaN(videoId)) {
      throw new HttpError('Invalid video ID', 400);
    }

    const video = await new Promise<any>((resolve, reject) => {
      db.get('SELECT * FROM videos WHERE id = ?', [videoId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!video) {
      throw new HttpError('Video not found', 404);
    }

    // Check ownership
    if (video.user_id !== req.user!.id) {
      throw new HttpError('Access denied', 403);
    }

    // Delete file from filesystem
    const filePath = path.join(process.env.UPLOAD_PATH || './uploads', 'videos', video.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database (CASCADE will handle related records)
    await new Promise<void>((resolve, reject) => {
      db.run('DELETE FROM videos WHERE id = ?', [videoId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'Video deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// List user's videos
router.get('/videos', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const videos = await new Promise<any[]>((resolve, reject) => {
      db.all(
        `SELECT id, original_filename, file_size, mime_type, duration, width, height, status, created_at 
         FROM videos 
         WHERE user_id = ? 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [userId, limit, offset],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });

    const totalCount = await new Promise<number>((resolve, reject) => {
      db.get('SELECT COUNT(*) as count FROM videos WHERE user_id = ?', [userId], (err, row: any) => {
        if (err) reject(err);
        else resolve(row?.count || 0);
      });
    });

    res.json({
      videos: videos.map(v => ({
        id: v.id,
        originalName: v.original_filename,
        size: v.file_size,
        type: v.mime_type,
        duration: v.duration,
        width: v.width,
        height: v.height,
        status: v.status,
        uploadedAt: v.created_at,
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
      },
    });
  } catch (error) {
    next(error);
  }
});

export { router as uploadRoutes };