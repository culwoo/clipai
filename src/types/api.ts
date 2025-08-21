// Frontend API types - shared with backend

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// User types
export interface User {
  id: number;
  email: string;
  name: string;
  credits: number;
  isSubscribed: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile extends User {
  subscription?: {
    id: string;
    status: string;
    currentPeriodEnd: string;
    plan: string;
  };
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  message: string;
}

// Video types
export interface Video {
  id: number;
  userId?: number;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  duration: number;
  width: number;
  height: number;
  status: 'uploading' | 'uploaded' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  updatedAt: string;
}

export interface UploadResponse {
  video: Video;
  message: string;
}

export interface UrlDownloadResponse {
  downloadId: number;
  videoInfo: {
    id: number;
    title: string;
    description: string;
    duration: number;
    thumbnail: string;
  };
  message: string;
}

// Processing types
export interface HighlightClip {
  id: number;
  title: string;
  duration: number;
  startTime: number;
  endTime: number;
  confidence: number;
  thumbnail?: string;
  downloadUrl?: string;
}

export interface Thumbnail {
  id: number;
  timestamp: number;
  width: number;
  height: number;
  downloadUrl: string;
}

export interface Caption {
  id: number;
  platform: 'youtube' | 'tiktok' | 'instagram' | 'twitter';
  content: string;
  hashtags: string[];
}

export interface ProcessingResult {
  id: number;
  videoId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  errorMessage?: string;
  video: {
    originalName: string;
    size: number;
    type: string;
  };
  highlights: HighlightClip[];
  thumbnails: Thumbnail[];
  captions: Caption[];
  createdAt: string;
  updatedAt: string;
}

export interface ProcessingStartResponse {
  message: string;
  processingId: number;
}

// History types
export interface HistoryItem {
  id: number;
  video: {
    id: number;
    originalName: string;
    duration: number;
    fileSize: number;
  };
  stats: {
    highlights: number;
    thumbnails: number;
    captions: number;
  };
  createdAt: string;
}

export interface HistoryResponse {
  history: HistoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Subscription types
export interface SubscriptionInfo {
  id: string;
  status: 'active' | 'cancelled' | 'past_due' | 'unpaid';
  currentPeriodEnd: string;
  plan: {
    id: string;
    name: string;
    price: number;
    interval: 'month' | 'year';
    features: string[];
  };
}

// Payment types
export interface CreditPackage {
  credits: number;
  price: number;
  priceId: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  credits: number;
  priceId: string;
  features: string[];
}

export interface PaymentIntentResponse {
  clientSecret: string;
  amount: number;
  credits: number;
}

export interface SubscriptionResponse {
  clientSecret: string;
  subscriptionId: string;
  plan: SubscriptionPlan;
}

export interface PaymentPackagesResponse {
  packages: CreditPackage[];
}

export interface PaymentPlansResponse {
  plans: SubscriptionPlan[];
}

export interface PricingPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  popular?: boolean;
}

// Component prop types
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export interface SectionTitleProps {
  icon: React.FC<{ size?: number }>;
  title: string;
  subtitle?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

// Tab types
export type Tab = "home" | "history" | "billing" | "account";

// App state types
export interface AppState {
  currentTab: Tab;
  currentPhase: 'idle' | 'processing' | 'result';
  remainingCredits: number;
  isLoading: boolean;
  error: string | null;
  processingHistory: any[];
}

// Hook types
export interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => void;
  refreshCredits: () => Promise<void>;
  refetch: () => Promise<void>;
}

export interface UseFileUploadReturn {
  uploadFile: (file: File) => Promise<UploadResponse>;
  uploadFromUrl: (url: string) => Promise<UrlDownloadResponse>;
  isUploading: boolean;
  uploadProgress: number;
}

// API Client types
export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  headers?: Record<string, string>;
}

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
}