import path from 'path';
import fs from 'fs';

export interface FilePathConfig {
  uploadsDir: string;
  videosDir: string;
  clipsDir: string;
  thumbnailsDir: string;
  framesDir: string;
}

export class FileManager {
  private config: FilePathConfig;

  constructor() {
    const uploadsDir = process.env.UPLOAD_PATH || './uploads';
    
    this.config = {
      uploadsDir,
      videosDir: path.join(uploadsDir, 'videos'),
      clipsDir: path.join(uploadsDir, 'clips'),
      thumbnailsDir: path.join(uploadsDir, 'thumbnails'),
      framesDir: path.join(uploadsDir, 'frames'),
    };

    // Ensure all directories exist
    this.ensureDirectories();
  }

  /**
   * Ensure all required directories exist
   */
  private ensureDirectories(): void {
    Object.values(this.config).forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    });
  }

  /**
   * Generate a safe filename from title - Windows safe, no Korean chars
   */
  static sanitizeFilename(filename: string, maxLength: number = 50): string {
    return filename
      .replace(/[가-힣]/g, '') // Remove Korean characters completely
      .replace(/[^a-zA-Z0-9\s.-]/g, '_') // Keep only alphanumeric, spaces, dots, hyphens
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/_{2,}/g, '_') // Replace multiple underscores with single
      .substring(0, maxLength) // Limit length
      .replace(/^_+|_+$/g, '') // Remove leading/trailing underscores
      .toLowerCase(); // Convert to lowercase for consistency
  }

  /**
   * Generate video file path
   */
  getVideoPath(originalFilename: string, videoId?: number): string {
    const sanitized = FileManager.sanitizeFilename(path.parse(originalFilename).name);
    const extension = path.extname(originalFilename) || '.mp4';
    const filename = videoId 
      ? `video_${videoId}_${sanitized}${extension}`
      : `${sanitized}${extension}`;
    
    return path.join(this.config.videosDir, filename);
  }

  /**
   * Generate YouTube download path - shorter to avoid Windows path limits
   */
  getYouTubeVideoPath(title: string, videoId: string): string {
    // Use only videoId to avoid Windows path length issues
    const filename = `yt_${videoId}.mp4`;
    return path.join(this.config.videosDir, filename);
  }

  /**
   * Generate clip file path
   */
  getClipPath(processingResultId: number, highlightIndex: number, title: string): string {
    const sanitizedTitle = FileManager.sanitizeFilename(title, 20);
    const filename = `clip_${processingResultId}_${highlightIndex}_${sanitizedTitle}.mp4`;
    return path.join(this.config.clipsDir, filename);
  }

  /**
   * Generate thumbnail file path
   */
  getThumbnailPath(processingResultId: number, thumbnailIndex: number, timestamp: number): string {
    const filename = `thumb_${processingResultId}_${thumbnailIndex}_${Math.round(timestamp)}s.jpg`;
    return path.join(this.config.thumbnailsDir, filename);
  }

  /**
   * Generate frames directory path for video analysis
   */
  getFramesDir(videoId: number): string {
    const dirName = `frames_video_${videoId}`;
    const framesPath = path.join(this.config.framesDir, dirName);
    
    if (!fs.existsSync(framesPath)) {
      fs.mkdirSync(framesPath, { recursive: true });
    }
    
    return framesPath;
  }

  /**
   * Convert absolute path to relative path for database storage
   */
  getRelativePath(absolutePath: string): string {
    return path.relative(this.config.uploadsDir, absolutePath);
  }

  /**
   * Convert relative path from database to absolute path
   */
  getAbsolutePath(relativePath: string): string {
    return path.join(this.config.uploadsDir, relativePath);
  }

  /**
   * Check if file exists
   */
  fileExists(filePath: string): boolean {
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : this.getAbsolutePath(filePath);
    
    return fs.existsSync(absolutePath);
  }

  /**
   * Delete file safely
   */
  deleteFile(filePath: string): boolean {
    try {
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : this.getAbsolutePath(filePath);
      
      if (fs.existsSync(absolutePath)) {
        fs.unlinkSync(absolutePath);
        console.log(`Deleted file: ${absolutePath}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Failed to delete file ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Clean up frames directory for a video
   */
  cleanupFrames(videoId: number): void {
    const framesDir = path.join(this.config.framesDir, `frames_video_${videoId}`);
    
    try {
      if (fs.existsSync(framesDir)) {
        fs.rmSync(framesDir, { recursive: true, force: true });
        console.log(`Cleaned up frames directory: ${framesDir}`);
      }
    } catch (error) {
      console.error(`Failed to cleanup frames directory ${framesDir}:`, error);
    }
  }

  /**
   * Clean up all files related to a processing result
   */
  async cleanupProcessingFiles(processingResultId: number): Promise<void> {
    try {
      // Get all files from database
      const clips = await this.getProcessingFiles('highlight_clips', processingResultId);
      const thumbnails = await this.getProcessingFiles('thumbnails', processingResultId);

      // Delete clip files - use for...of to properly handle any potential async operations
      for (const clip of clips) {
        if (clip.file_path) {
          this.deleteFile(clip.file_path);
        }
      }

      // Delete thumbnail files - use for...of to properly handle any potential async operations  
      for (const thumbnail of thumbnails) {
        if (thumbnail.file_path) {
          this.deleteFile(thumbnail.file_path);
        }
      }

      console.log(`Cleaned up files for processing result ${processingResultId}`);
    } catch (error) {
      console.error(`Failed to cleanup processing files for ${processingResultId}:`, error);
    }
  }

  /**
   * Get processing files from database (helper method)
   */
  private getProcessingFiles(table: string, processingResultId: number): Promise<any[]> {
    const { db } = require('../database/init');
    
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT file_path FROM ${table} WHERE processing_result_id = ?`,
        [processingResultId],
        (err: any, rows: any[]) => {
          if (err) reject(err);
          else resolve(rows || []);
        }
      );
    });
  }

  /**
   * Get file size
   */
  getFileSize(filePath: string): number {
    try {
      const absolutePath = path.isAbsolute(filePath) 
        ? filePath 
        : this.getAbsolutePath(filePath);
      
      if (fs.existsSync(absolutePath)) {
        return fs.statSync(absolutePath).size;
      }
      return 0;
    } catch (error) {
      console.error(`Failed to get file size for ${filePath}:`, error);
      return 0;
    }
  }

  /**
   * Get configuration
   */
  getConfig(): FilePathConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const fileManager = new FileManager();