import { useState, useCallback } from 'react';
import { useAppStore } from '../store/appStore';

interface UseAsyncOperationOptions<T> {
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
  showGlobalError?: boolean;
}

interface AsyncOperationState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useAsyncOperation<T = any>(
  options: UseAsyncOperationOptions<T> = {}
) {
  const { onSuccess, onError, showGlobalError = true } = options;
  const { setError: setGlobalError } = useAppStore();
  
  const [state, setState] = useState<AsyncOperationState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (asyncFunction: () => Promise<T>): Promise<T | null> => {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      if (showGlobalError) {
        setGlobalError(null);
      }

      try {
        const result = await asyncFunction();
        setState(prev => ({ ...prev, data: result, loading: false }));
        
        if (onSuccess) {
          onSuccess(result);
        }
        
        return result;
      } catch (error) {
        const errorObj = error instanceof Error ? error : new Error(String(error));
        
        setState(prev => ({ ...prev, error: errorObj, loading: false }));
        
        if (showGlobalError) {
          setGlobalError(errorObj.message);
        }
        
        if (onError) {
          onError(errorObj);
        }
        
        return null;
      }
    },
    [onSuccess, onError, showGlobalError, setGlobalError]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
    if (showGlobalError) {
      setGlobalError(null);
    }
  }, [showGlobalError, setGlobalError]);

  return {
    ...state,
    execute,
    reset,
  };
}