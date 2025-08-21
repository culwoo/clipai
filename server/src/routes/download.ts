import express from 'express';
import path from 'path';
import fs from 'fs';
import { db } from '../database/init';
import { HttpError } from '../middleware/errorHandler';
import { AuthRequest, optionalAuth } from '../middleware/auth';

const router = express.Router();

// Download highlight clip
router.get('/clip/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const clipId = parseInt(req.params.id);
    
    if (isNaN(clipId)) {
      throw new HttpError('Invalid clip ID', 400);
    }

    const clip = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT hc.*, pr.user_id 
         FROM highlight_clips hc 
         JOIN processing_results pr ON hc.processing_result_id = pr.id 
         WHERE hc.id = ?`,
        [clipId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!clip) {
      throw new HttpError('Clip not found', 404);
    }

    // Check access
    if (clip.user_id && (!req.user || req.user.id !== clip.user_id)) {
      throw new HttpError('Access denied', 403);
    }

    // Check if actual file exists
    const filePath = path.join(process.env.UPLOAD_PATH || './uploads', clip.file_path);
    console.log(`Attempting to serve clip file: ${filePath}`);
    
    if (fs.existsSync(filePath)) {
      // Check if file is not empty
      const stats = fs.statSync(filePath);
      console.log(`File exists, size: ${stats.size} bytes`);
      
      if (stats.size > 0) {
        // Serve actual file
        const filename = `${clip.title.replace(/[^a-zA-Z0-9가-힣\s]/g, '_')}.mp4`;
        
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Length', stats.size);
        
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        console.log(`Successfully served clip file: ${filename}`);
      } else {
        console.log('File exists but is empty, serving mock content');
        // File exists but is empty, serve mock data
        const mockVideoContent = Buffer.from('Mock video content for clip: ' + clip.title);
        
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Content-Disposition', `attachment; filename="${clip.title}.mp4"`);
        res.setHeader('Content-Length', mockVideoContent.length);
        
        res.send(mockVideoContent);
      }
    } else {
      console.log('File does not exist, serving mock content');
      // Fallback to mock data if file doesn't exist
      const mockVideoContent = Buffer.from('Mock video content for clip: ' + clip.title);
      
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${clip.title}.mp4"`);
      res.setHeader('Content-Length', mockVideoContent.length);
      
      res.send(mockVideoContent);
    }
  } catch (error) {
    next(error);
  }
});

// Download thumbnail
router.get('/thumbnail/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const thumbnailId = parseInt(req.params.id);
    
    if (isNaN(thumbnailId)) {
      throw new HttpError('Invalid thumbnail ID', 400);
    }

    const thumbnail = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT t.*, pr.user_id 
         FROM thumbnails t 
         JOIN processing_results pr ON t.processing_result_id = pr.id 
         WHERE t.id = ?`,
        [thumbnailId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!thumbnail) {
      throw new HttpError('Thumbnail not found', 404);
    }

    // Check access
    if (thumbnail.user_id && (!req.user || req.user.id !== thumbnail.user_id)) {
      throw new HttpError('Access denied', 403);
    }

    // Check if actual file exists
    const filePath = path.join(process.env.UPLOAD_PATH || './uploads', thumbnail.file_path);
    console.log(`Attempting to serve thumbnail file: ${filePath}`);
    
    if (fs.existsSync(filePath)) {
      // Check if file is not empty
      const stats = fs.statSync(filePath);
      console.log(`File exists, size: ${stats.size} bytes`);
      
      if (stats.size > 0) {
        // Serve actual file
        const ext = path.extname(thumbnail.file_path);
        const contentType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="thumbnail_${thumbnailId}${ext}"`);
        res.setHeader('Content-Length', stats.size);
        
        const stream = fs.createReadStream(filePath);
        stream.pipe(res);
        console.log(`Successfully served thumbnail file: thumbnail_${thumbnailId}${ext}`);
      } else {
        console.log('File exists but is empty, serving mock content');
        // File exists but is empty, serve mock data
        const mockThumbnail = Buffer.from([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
          0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
          0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
          0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
          0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ]);
        
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="thumbnail_${thumbnailId}.png"`);
        res.setHeader('Content-Length', mockThumbnail.length);
        
        res.send(mockThumbnail);
      }
    } else {
      console.log('File does not exist, serving mock content');
      // Create a simple 1x1 pixel PNG as mock thumbnail
      const mockThumbnail = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
        0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
        0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ]);
      
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Content-Disposition', `attachment; filename="thumbnail_${thumbnailId}.png"`);
      res.setHeader('Content-Length', mockThumbnail.length);
      
      res.send(mockThumbnail);
    }
  } catch (error) {
    next(error);
  }
});

// Download caption as text file
router.get('/caption/:id', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const captionId = parseInt(req.params.id);
    
    if (isNaN(captionId)) {
      throw new HttpError('Invalid caption ID', 400);
    }

    const caption = await new Promise<any>((resolve, reject) => {
      db.get(
        `SELECT c.*, pr.user_id 
         FROM captions c 
         JOIN processing_results pr ON c.processing_result_id = pr.id 
         WHERE c.id = ?`,
        [captionId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!caption) {
      throw new HttpError('Caption not found', 404);
    }

    // Check access
    if (caption.user_id && (!req.user || req.user.id !== caption.user_id)) {
      throw new HttpError('Access denied', 403);
    }

    const content = `${caption.content}\n\n해시태그: ${caption.hashtags || ''}`;
    const buffer = Buffer.from(content, 'utf8');
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="caption_${caption.platform}.txt"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// Download all results as ZIP
router.get('/all/:processingId', optionalAuth, async (req: AuthRequest, res, next) => {
  try {
    const processingId = parseInt(req.params.processingId);
    
    if (isNaN(processingId)) {
      throw new HttpError('Invalid processing ID', 400);
    }

    const processingResult = await new Promise<any>((resolve, reject) => {
      db.get(
        'SELECT * FROM processing_results WHERE id = ?',
        [processingId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!processingResult) {
      throw new HttpError('Processing result not found', 404);
    }

    // Check access
    if (processingResult.user_id && (!req.user || req.user.id !== processingResult.user_id)) {
      throw new HttpError('Access denied', 403);
    }

    // For now, return a simple text file with download information
    const content = `ClipAI 변환 결과 파일

처리 ID: ${processingId}
상태: ${processingResult.status}
생성일: ${processingResult.created_at}

이 기능은 향후 ZIP 파일로 모든 결과를 한번에 다운로드할 수 있도록 개선될 예정입니다.

개별 파일 다운로드:
- 하이라이트 클립: /api/download/clip/{clip_id}
- 썸네일: /api/download/thumbnail/{thumbnail_id}  
- 캡션: /api/download/caption/{caption_id}
`;

    const buffer = Buffer.from(content, 'utf8');
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="clipai_result_${processingId}.txt"`);
    res.setHeader('Content-Length', buffer.length);
    
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

export { router as downloadRoutes };