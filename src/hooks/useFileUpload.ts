import { useState, useCallback } from 'react';
import { apiClient } from '../services/api';
import { useAppStore } from '../store/appStore';

interface UseFileUploadOptions {
  onSuccess?: (result: any) => void;
  onError?: (error: Error) => void;
}

export function useFileUpload(options: UseFileUploadOptions = {}) {
  const { onSuccess, onError } = options;
  const { setError, setLoading } = useAppStore();
  
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = useCallback(
    async (file: File): Promise<any> => {
      if (!file) {
        throw new Error('파일이 선택되지 않았습니다.');
      }

      // Validate file type
      const allowedTypes = ['video/mp4', 'video/mpeg', 'video/quicktime', 'video/x-msvideo', 'video/x-ms-wmv'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('지원되지 않는 파일 형식입니다. MP4, MOV, AVI, WMV 파일만 업로드 가능합니다.');
      }

      // Validate file size (500MB max)
      const maxSize = 500 * 1024 * 1024; // 500MB in bytes
      if (file.size > maxSize) {
        throw new Error('파일 크기가 너무 큽니다. 최대 500MB까지 업로드 가능합니다.');
      }

      setIsUploading(true);
      setUploadProgress(0);
      setError(null);
      setLoading(true);

      try {
        const result = await apiClient.uploadVideo(file, (progress) => {
          setUploadProgress(progress);
        });

        setUploadProgress(100);
        
        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('업로드 중 오류가 발생했습니다.');
        setError(errorObj.message);
        
        if (onError) {
          onError(errorObj);
        }
        
        throw errorObj;
      } finally {
        setIsUploading(false);
        setLoading(false);
        setTimeout(() => setUploadProgress(0), 1000);
      }
    },
    [onSuccess, onError, setError, setLoading]
  );

  const uploadFromUrl = useCallback(
    async (url: string): Promise<any> => {
      if (!url) {
        throw new Error('URL이 입력되지 않았습니다.');
      }

      // Basic URL validation
      try {
        new URL(url);
      } catch {
        throw new Error('올바른 URL을 입력해주세요.');
      }

      // Check if it's a YouTube URL
      const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
      if (!isYouTube) {
        throw new Error('현재는 YouTube URL만 지원됩니다.');
      }

      setIsUploading(true);
      setError(null);
      setLoading(true);

      try {
        const result = await apiClient.downloadFromUrl(url);
        console.log('API downloadFromUrl result:', result);
        
        if (onSuccess) {
          onSuccess(result);
        }

        return result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error('URL 다운로드 중 오류가 발생했습니다.');
        setError(errorObj.message);
        
        if (onError) {
          onError(errorObj);
        }
        
        throw errorObj;
      } finally {
        setIsUploading(false);
        setLoading(false);
      }
    },
    [onSuccess, onError, setError, setLoading]
  );

  const reset = useCallback(() => {
    setIsUploading(false);
    setUploadProgress(0);
    setError(null);
    setLoading(false);
  }, [setError, setLoading]);

  return {
    uploadFile,
    uploadFromUrl,
    isUploading,
    uploadProgress,
    reset,
  };
}