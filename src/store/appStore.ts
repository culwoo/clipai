import { create } from 'zustand';

export type Tab = "home" | "history" | "billing" | "account";
export type Phase = "idle" | "processing" | "result";

export interface UploadedFile {
  id: string;
  name: string;
  url?: string;
  type: 'file' | 'youtube' | 'tiktok';
  file?: File;
}

export interface HighlightClip {
  id: string;
  title: string;
  duration: number;
  thumbnail?: string;
  videoUrl?: string;
}

export interface Thumbnail {
  id: string;
  url: string;
  timestamp: number;
}

export interface GeneratedCaption {
  id: string;
  platform: 'youtube' | 'tiktok' | 'instagram';
  content: string;
}

export interface ProcessingResult {
  id: string;
  originalFile: UploadedFile;
  highlights: HighlightClip[];
  thumbnails: Thumbnail[];
  captions: GeneratedCaption[];
  createdAt: Date;
}

interface AppStore {
  // UI State
  currentTab: Tab;
  currentPhase: Phase;
  
  // Processing State
  uploadedFile: UploadedFile | null;
  processingResult: ProcessingResult | null;
  isLoading: boolean;
  error: string | null;
  
  // History
  processingHistory: ProcessingResult[];
  
  // Credits & Subscription
  remainingCredits: number;
  isSubscribed: boolean;
  
  // Actions
  setCurrentTab: (tab: Tab) => void;
  setCurrentPhase: (phase: Phase) => void;
  setUploadedFile: (file: UploadedFile | null) => void;
  setProcessingResult: (result: ProcessingResult | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  addToHistory: (result: ProcessingResult) => void;
  decrementCredits: () => void;
  resetProcessing: () => void;
}

// Helper function to get initial tab from URL hash or localStorage
const getInitialTab = (): Tab => {
  const validTabs: Tab[] = ['home', 'history', 'billing', 'account'];
  
  // Check URL hash first (URL has priority over localStorage)
  const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
  if (hash) {
    // Check for history detail URL (e.g., history/detail/123)
    const parts = hash.split('/');
    const baseTab = parts[0];
    
    if (baseTab === 'history' && parts[1] === 'detail' && parts[2]) {
      return 'history';
    }
    
    // Check for regular tab
    if (validTabs.includes(baseTab as Tab)) {
      return baseTab as Tab;
    }
    
    // Invalid hash found - use default instead of checking localStorage
    return 'home';
  }
  
  // No hash in URL - check localStorage
  if (typeof window !== 'undefined') {
    const savedTab = localStorage.getItem('currentTab') as Tab;
    if (savedTab && validTabs.includes(savedTab)) {
      return savedTab;
    }
  }
  
  // Default to home
  return 'home';
};

export const useAppStore = create<AppStore>((set, get) => ({
  // Initial State
  currentTab: getInitialTab(),
  currentPhase: "idle",
  uploadedFile: null,
  processingResult: null,
  isLoading: false,
  error: null,
  processingHistory: [],
  remainingCredits: 5,
  isSubscribed: false,
  
  // Actions
  setCurrentTab: (tab) => set({ currentTab: tab }),
  setCurrentPhase: (phase) => set({ currentPhase: phase }),
  setUploadedFile: (file) => set({ uploadedFile: file }),
  setProcessingResult: (result) => set({ processingResult: result }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  
  addToHistory: (result) => set((state) => ({ 
    processingHistory: [result, ...state.processingHistory] 
  })),
  
  decrementCredits: () => set((state) => ({ 
    remainingCredits: Math.max(0, state.remainingCredits - 1) 
  })),
  
  resetProcessing: () => set({
    currentPhase: "idle",
    uploadedFile: null,
    processingResult: null,
    isLoading: false,
    error: null,
  }),
}));