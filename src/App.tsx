import React, { useRef, useState, useEffect, useCallback } from "react";
import { Upload, Film, Image as ImageIcon, Type, Play, Loader2, Download, Copy, CreditCard, User, History, ChevronRight, AlertCircle, X, LogOut, LogIn, Share2, ExternalLink, Eye } from "lucide-react";
import { useAppStore, Tab } from "./store/appStore";
import { useFileUpload } from "./hooks/useFileUpload";
import { useAuth } from "./hooks/useAuth";
import { useToast } from "./hooks/useToast";
import { AuthModal } from "./components/AuthModal";
import { HistoryTab } from "./components/HistoryTab";
import { BillingTab } from "./components/BillingTab";
import { ProfileTab } from "./components/ProfileTab";
import ToastContainer from "./components/ToastContainer";
import { apiClient } from "./services/api";
import { ButtonProps, CardProps, SectionTitleProps, ProcessingResult, HistoryItem } from "./types/api";

const Button: React.FC<ButtonProps> = ({ children, className = "", ...props }) => (
  <button className={"px-4 py-2 rounded-2xl shadow-sm text-sm font-medium transition active:scale-[0.99] bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed " + className} {...props}>{children}</button>
);

const GhostButton: React.FC<ButtonProps> = ({ children, className = "", ...props }) => (
  <button className={"px-4 py-2 rounded-2xl text-sm font-medium transition active:scale-[0.99] bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed " + className} {...props}>{children}</button>
);

const Card: React.FC<CardProps> = ({ children, className = "" }) => (
  <div className={"rounded-2xl bg-white shadow-sm border border-gray-100 " + className}>{children}</div>
);

const SectionTitle: React.FC<SectionTitleProps> = ({ icon: Icon, title, subtitle }) => (
  <div className="flex items-center gap-3 mb-3">
    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600"><Icon size={18} /></div>
    <div>
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  </div>
);

export default function App() {
  const {
    currentTab,
    currentPhase,
    remainingCredits,
    isLoading,
    error,
    setCurrentTab,
    setCurrentPhase,
    decrementCredits,
    setError,
  } = useAppStore();
  
  const fileRef = useRef<HTMLInputElement>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const [urlInput, setUrlInput] = useState("");
  const [currentVideoId, setCurrentVideoId] = useState<number | null>(null);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [previewModal, setPreviewModal] = useState<{ type: 'clip' | 'thumbnail'; data: any } | null>(null);
  const [shareModal, setShareModal] = useState<{ type: 'clip' | 'caption'; data: any } | null>(null);
  const [recentHistory, setRecentHistory] = useState<HistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null);

  const { user, isAuthenticated, logout: originalLogout, refreshCredits, refetch } = useAuth();
  const { toasts, addToast, removeToast } = useToast();

  // Cleanup function for polling and resources
  const cleanupPolling = useCallback(() => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      cleanupPolling();
    };
  }, [cleanupPolling]);

  // Handle logout with navigation to home
  const handleLogout = () => {
    originalLogout();
    navigateToTab("home");
    addToast.info('로그아웃되었습니다');
  };

  // Navigation helper function to keep tab and URL in sync
  const navigateToTab = (tab: Tab, historyId?: number) => {
    console.log(`Navigating to tab: ${tab}${historyId ? ` with historyId: ${historyId}` : ''}`);
    setCurrentTab(tab);
    
    if (tab === "history" && historyId) {
      window.location.hash = `history/detail/${historyId}`;
      setSelectedHistoryId(historyId);
    } else {
      window.location.hash = tab;
      if (tab !== "history") {
        setSelectedHistoryId(null);
      }
    }
    
    // Update localStorage
    localStorage.setItem('currentTab', tab);
  };

  // Handle navigation initialization and hash changes
  useEffect(() => {
    const validTabs: Tab[] = ['home', 'history', 'billing', 'account'];
    
    // Parse hash and extract tab and potential historyId
    const parseHash = (hash: string) => {
      const cleanHash = hash.replace('#', '') || '';
      const parts = cleanHash.split('/');
      const tab = parts[0];
      
      if (tab === 'history' && parts[1] === 'detail' && parts[2]) {
        const historyId = parseInt(parts[2]);
        if (!isNaN(historyId)) {
          return { tab: 'history' as Tab, historyId };
        }
      }
      
      return { tab: validTabs.includes(tab as Tab) ? tab as Tab : 'home', historyId: null };
    };
    
    // Handle hash change events (back/forward, manual URL change)
    const handleHashChange = () => {
      const hash = window.location.hash;
      console.log('Hash changed to:', hash);
      
      const { tab, historyId } = parseHash(hash);
      console.log('Parsed tab:', tab, 'historyId:', historyId);
      
      setCurrentTab(tab);
      if (historyId) {
        setSelectedHistoryId(historyId);
      } else if (tab !== 'history') {
        setSelectedHistoryId(null);
      }
    };
    
    // Initialize on mount
    handleHashChange();
    
    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []); // Only run once on mount

  // Fetch recent history when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      fetchRecentHistory();
    } else {
      setRecentHistory([]);
    }
  }, [isAuthenticated]);

  // Clear selectedHistoryId when switching tabs
  useEffect(() => {
    if (currentTab !== "history") {
      setSelectedHistoryId(null);
    }
  }, [currentTab]);

  const fetchRecentHistory = async () => {
    try {
      const response = await apiClient.getUserHistory(1, 3);
      setRecentHistory(response.history || []);
    } catch (error) {
      console.error('Failed to fetch recent history:', error);
      setRecentHistory([]);
    }
  };

  const handleRecentHistoryClick = (item: HistoryItem) => {
    // Navigate to history tab with specific item detail
    navigateToTab("history", item.id);
  };

  const { uploadFile, uploadFromUrl, isUploading, uploadProgress } = useFileUpload({
    onSuccess: (result) => {
      console.log('Upload successful:', result);
      
      // Handle file upload response
      if (result.video && result.video.id) {
        setCurrentVideoId(result.video.id);
        addToast.success('파일 업로드가 완료되었습니다!', '처리를 시작합니다');
        // Auto-start processing after successful upload
        setTimeout(() => startProcessing(), 500);
      }
      // Handle URL download response  
      else if (result.videoInfo && result.videoInfo.id) {
        setCurrentVideoId(result.videoInfo.id);
        addToast.success('YouTube 비디오 처리가 시작되었습니다!');
        // Auto-start processing after successful URL download
        setTimeout(() => startProcessing(), 500);
      }
      // Fallback
      else if (result.downloadId) {
        setCurrentVideoId(result.downloadId);
        addToast.success('비디오 업로드가 완료되었습니다!');
        // Auto-start processing after successful download
        setTimeout(() => startProcessing(), 500);
      }
    },
    onError: (error) => {
      console.error('Upload failed:', error);
      addToast.error(error.message || '업로드에 실패했습니다', '업로드 오류');
    }
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        await uploadFile(file);
      } catch (error) {
        console.error('File upload error:', error);
        addToast.error('파일 선택 중 오류가 발생했습니다', '파일 오류');
      }
    }
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file) {
      try {
        await uploadFile(file);
      } catch (error) {
        console.error('File drop error:', error);
        addToast.error('파일 드롭 중 오류가 발생했습니다', '파일 오류');
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleUrlSubmit = async () => {
    if (!urlInput.trim()) {
      addToast.warning('YouTube URL을 입력해주세요');
      return;
    }
    
    // Check credits before starting - unified logic
    const credits = isAuthenticated ? (user?.credits || 0) : remainingCredits;
    const isSubscribed = isAuthenticated && user?.isSubscribed;
    
    if (!isAuthenticated && credits <= 0) {
      setError("크레딧이 부족합니다. 로그인 후 크레딧을 충전해주세요.");
      return;
    }
    
    if (isAuthenticated && !isSubscribed && credits <= 0) {
      setError("크레딧이 부족합니다. 충전하거나 프리미엄 구독을 이용해주세요.");
      return;
    }
    
    try {
      await uploadFromUrl(urlInput.trim());
      // Processing will start automatically in onSuccess callback
    } catch (error) {
      console.error('URL download error:', error);
      addToast.error('YouTube URL 처리 중 오류가 발생했습니다', 'URL 오류');
    }
  };

  const startProcessing = async () => {
    const credits = isAuthenticated ? (user?.credits || 0) : remainingCredits;
    const isSubscribed = isAuthenticated && user?.isSubscribed;
    
    if (!currentVideoId) {
      return;
    }
    
    // Check credits with unified logic
    if (!isAuthenticated && credits <= 0) {
      setError("크레딧이 부족합니다. 로그인 후 크레딧을 충전해주세요.");
      return;
    }
    
    if (isAuthenticated && !isSubscribed && credits <= 0) {
      setError("크레딧이 부족합니다. 충전하거나 프리미엄 구독을 이용해주세요.");
      return;
    }
    
    try {
      setCurrentPhase("processing");
      const result = await apiClient.processVideo(currentVideoId);
      if (isAuthenticated) {
        // Only refresh credits if not subscribed (no need to decrement for subscribers)
        if (!user?.isSubscribed) {
          refreshCredits();
        }
      } else {
        decrementCredits();
      }
      
      // Improved polling with abort control and timeout limits
      let pollCount = 0;
      const maxPollAttempts = 300; // 5 minutes max (2s * 150 attempts)
      
      const pollStatus = async () => {
        // Check if polling should be aborted
        if (abortControllerRef.current?.signal.aborted) {
          console.log('Polling aborted');
          return;
        }
        
        // Check poll count limit
        if (pollCount >= maxPollAttempts) {
          setError("처리 시간이 너무 길어졌습니다. 잠시 후 다시 시도해주세요.");
          setCurrentPhase("idle");
          return;
        }
        
        pollCount++;
        
        try {
          // Create AbortController for this request if not exists
          if (!abortControllerRef.current) {
            abortControllerRef.current = new AbortController();
          }

          // Note: apiClient.getProcessingStatus should support AbortSignal
          // For now, this is a placeholder - the API client needs to be updated
          const status = await apiClient.getProcessingStatus(result.processingId);
          
          if (status.status === 'completed') {
            cleanupPolling();
            setCurrentPhase("result");
            setProcessingResult(status);
            // Refresh recent history after successful processing
            if (isAuthenticated) {
              fetchRecentHistory();
            }
            return;
          } else if (status.status === 'failed') {
            cleanupPolling();
            setError(status.errorMessage || "처리 중 오류가 발생했습니다.");
            setCurrentPhase("idle");
            return;
          }
          
          // Continue polling with cleanup-aware timeout
          pollingTimeoutRef.current = setTimeout(pollStatus, 2000);
        } catch (error) {
          console.error('Status polling error:', error);
          cleanupPolling();
          setError("처리 상태 확인 중 오류가 발생했습니다.");
          setCurrentPhase("idle");
        }
      };
      
      // Start polling with initial delay
      pollingTimeoutRef.current = setTimeout(pollStatus, 2000);
      
    } catch (error) {
      console.error('Processing error:', error);
      setCurrentPhase("idle");
    }
  };

  const downloadClip = async (clipId: number, title: string) => {
    try {
      const response = await fetch(`http://localhost:3002/api/download/clip/${clipId}`, {
        headers: {
          ...(apiClient.getToken() && { Authorization: `Bearer ${apiClient.getToken()}` }),
        },
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setError('다운로드 중 오류가 발생했습니다.');
    }
  };

  const downloadThumbnail = async (thumbnailId: number) => {
    try {
      const response = await fetch(`http://localhost:3002/api/download/thumbnail/${thumbnailId}`, {
        headers: {
          ...(apiClient.getToken() && { Authorization: `Bearer ${apiClient.getToken()}` }),
        },
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `thumbnail_${thumbnailId}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setError('다운로드 중 오류가 발생했습니다.');
    }
  };

  const downloadCaption = async (captionId: number, platform: string) => {
    try {
      const response = await fetch(`http://localhost:3002/api/download/caption/${captionId}`, {
        headers: {
          ...(apiClient.getToken() && { Authorization: `Bearer ${apiClient.getToken()}` }),
        },
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `caption_${platform}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setError('다운로드 중 오류가 발생했습니다.');
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Simple success indication - you could improve this with a toast notification
      console.log('Text copied to clipboard');
    } catch (error) {
      console.error('Copy error:', error);
      setError('클립보드 복사 중 오류가 발생했습니다.');
    }
  };

  const shareToSocialMedia = (platform: string, content: string, url?: string) => {
    const encodedContent = encodeURIComponent(content);
    const encodedUrl = url ? encodeURIComponent(url) : '';
    
    let shareUrl = '';
    
    switch (platform) {
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${encodedContent}${url ? `&url=${encodedUrl}` : ''}`;
        break;
      case 'facebook':
        shareUrl = url ? `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` : `https://www.facebook.com/sharer/sharer.php?quote=${encodedContent}`;
        break;
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl || 'https://clipai.com'}&summary=${encodedContent}`;
        break;
      case 'kakao':
        // KakaoTalk sharing would require Kakao SDK integration
        copyToClipboard(content);
        return;
      default:
        copyToClipboard(content);
        return;
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=400');
  };

  const generateShareableLink = (type: 'clip' | 'caption', id: number) => {
    // In a real app, this would generate a proper shareable link
    return `https://clipai.com/share/${type}/${id}`;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-10 backdrop-blur bg-white/70 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => {
            console.log('Logo clicked - navigating to home');
            setCurrentTab("home");
            setCurrentPhase("idle");
            setCurrentVideoId(null);
            setProcessingResult(null);
            setUrlInput("");
            setError(null);
          }}>
            <div className="w-8 h-8 rounded-xl bg-indigo-600" />
            <span className="font-semibold text-gray-900">ClipAI</span>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <GhostButton onClick={() => navigateToTab("history")}>
              <History size={16} className="inline mr-1" />내 변환
            </GhostButton>
            <GhostButton onClick={() => navigateToTab("billing")}>
              <CreditCard size={16} className="inline mr-1" />결제/구독
            </GhostButton>
            
            {isAuthenticated ? (
              <>
                <GhostButton onClick={() => navigateToTab("account")}>
                  <User size={16} className="inline mr-1" />{user?.name || user?.email}
                </GhostButton>
                <GhostButton onClick={handleLogout}><LogOut size={16} className="inline mr-1" />로그아웃</GhostButton>
              </>
            ) : (
              <Button onClick={() => setShowAuthModal(true)}><LogIn size={16} className="inline mr-1" />로그인</Button>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X size={18} />
            </button>
          </div>
        )}
        
        {currentTab === "home" && (
          <div className={`grid grid-cols-1 gap-6 ${currentPhase === "idle" ? 'lg:grid-cols-5' : 'lg:grid-cols-1'}`}>
            {/* 왼쪽 업로드 카드 */}
            <Card className={`p-6 overflow-hidden ${currentPhase === "idle" ? 'lg:col-span-3' : 'lg:col-span-1'}`}>
              <SectionTitle icon={Upload} title="영상 업로드 또는 링크 입력" subtitle="드래그 앤 드롭하거나, 유튜브/틱톡 URL을 붙여넣으세요" />
              
              {currentPhase === "idle" && (
                <div 
                  className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center bg-gray-50 flex flex-col items-center justify-center min-h-[400px]"
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                >
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3">
                    <Upload />
                  </div>
                  
                  {isUploading ? (
                    <div className="w-full max-w-md">
                      <p className="text-gray-700 font-medium mb-4">업로드 중... {uploadProgress}%</p>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        ></div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="text-gray-700 font-medium">여기로 파일을 끌어다 놓거나 클릭해서 선택</p>
                      <p className="text-xs text-gray-500 mt-1">MP4, MOV, AVI, WMV · 최대 500MB</p>
                      <div className="mt-4 flex flex-col items-center gap-3 w-full max-w-md">
                        <GhostButton 
                          onClick={() => fileRef.current?.click()}
                          disabled={isUploading || isLoading}
                        >
                          파일 선택
                        </GhostButton>
                        <input 
                          type="file" 
                          ref={fileRef} 
                          className="hidden"
                          accept="video/*"
                          onChange={handleFileSelect}
                        />
                        
                        <div className="flex items-center gap-2 w-full">
                          <span className="text-xs text-gray-400">또는</span>
                        </div>
                        
                        <div className="flex gap-2 w-full">
                          <input 
                            placeholder="https://youtube.com/..." 
                            className="px-3 py-2 rounded-xl border border-gray-200 text-sm flex-1 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            disabled={isUploading || isLoading}
                          />
                          <Button 
                            onClick={handleUrlSubmit}
                            disabled={isUploading || isLoading || !urlInput.trim()}
                          >
                            변환 시작
                          </Button>
                        </div>
                        
                      </div>
                    </>
                  )}
                </div>
              )}

              {currentPhase === "processing" && (
                <div className="p-8 text-indigo-700 font-medium flex items-center gap-2 justify-center min-h-[400px]">
                  <Loader2 className="animate-spin" /> 분석 중... 잠시만요
                </div>
              )}

              {currentPhase === "result" && processingResult && (
                <div className="space-y-6">
                  <SectionTitle icon={Film} title="하이라이트 클립" subtitle="자동 추출된 30~60초 클립" />
                  <div className="grid sm:grid-cols-2 gap-4">
                    {processingResult.highlights && processingResult.highlights.length > 0 ? (
                      processingResult.highlights.map((highlight: any) => (
                        <Card key={highlight.id} className="p-3">
                          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                            <Play />
                          </div>
                          <div className="flex items-center justify-between mt-3">
                            <div className="text-xs text-gray-600">
                              {highlight.title} · {Math.round(highlight.duration)}s
                            </div>
                            <div className="flex gap-2">
                              <GhostButton 
                                className="px-3 py-1"
                                onClick={() => setPreviewModal({ type: 'clip', data: highlight })}
                              >
                                <Play size={14} className="inline mr-1" />미리보기
                              </GhostButton>
                              <GhostButton 
                                className="px-3 py-1"
                                onClick={() => setShareModal({ type: 'clip', data: highlight })}
                              >
                                <Share2 size={14} className="inline mr-1" />공유
                              </GhostButton>
                              <Button 
                                className="px-3 py-1"
                                onClick={() => downloadClip(highlight.id, highlight.title)}
                              >
                                <Download size={14} className="inline mr-1" />다운로드
                              </Button>
                            </div>
                          </div>
                        </Card>
                      ))
                    ) : (
                      <div className="col-span-2 text-center py-8 text-gray-500">
                        하이라이트 클립을 생성하지 못했습니다.
                      </div>
                    )}
                  </div>

                  <SectionTitle icon={ImageIcon} title="썸네일 제안" subtitle="가장 역동적인 프레임에서 캡처" />
                  <div className="grid grid-cols-3 gap-3">
                    {processingResult.thumbnails && processingResult.thumbnails.length > 0 ? (
                      processingResult.thumbnails.map((thumbnail: any) => (
                        <div 
                          key={thumbnail.id} 
                          className="relative group w-full h-28 bg-gray-100 rounded-xl border border-gray-100 flex items-center justify-center cursor-pointer hover:border-indigo-300 transition-colors"
                        >
                          <div className="text-gray-400">
                            <ImageIcon size={24} />
                          </div>
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                            <div className="flex gap-2">
                              <GhostButton 
                                className="px-3 py-1"
                                onClick={() => setPreviewModal({ type: 'thumbnail', data: thumbnail })}
                              >
                                <Eye size={14} className="inline mr-1" />미리보기
                              </GhostButton>
                              <Button 
                                className="px-3 py-1"
                                onClick={() => downloadThumbnail(thumbnail.id)}
                              >
                                <Download size={14} className="inline mr-1" />다운로드
                              </Button>
                            </div>
                          </div>
                          <div className="absolute bottom-2 left-2 text-xs text-gray-500 bg-white px-2 py-1 rounded">
                            {Math.round(thumbnail.timestamp)}s
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="col-span-3 text-center py-8 text-gray-500">
                        썸네일을 생성하지 못했습니다.
                      </div>
                    )}
                  </div>

                  <SectionTitle icon={Type} title="자동 캡션/설명문" subtitle="플랫폼별로 바로 붙여넣기" />
                  <div className="space-y-4">
                    {processingResult.captions && processingResult.captions.length > 0 ? (
                      processingResult.captions.map((caption: any) => (
                        <Card key={caption.id} className="p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs text-gray-500 capitalize">
                              {caption.platform} · SEO 키워드 포함
                            </div>
                            <div className="flex gap-2">
                              <GhostButton 
                                className="px-3 py-1"
                                onClick={() => copyToClipboard(caption.content)}
                              >
                                <Copy size={14} className="inline mr-1" />복사
                              </GhostButton>
                              <GhostButton 
                                className="px-3 py-1"
                                onClick={() => setShareModal({ type: 'caption', data: caption })}
                              >
                                <Share2 size={14} className="inline mr-1" />공유
                              </GhostButton>
                              <Button 
                                className="px-3 py-1"
                                onClick={() => downloadCaption(caption.id, caption.platform)}
                              >
                                <Download size={14} className="inline mr-1" />TXT 저장
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm leading-6 text-gray-800">
                            {caption.content}
                          </p>
                          {caption.hashtags && caption.hashtags.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-gray-100">
                              <div className="text-xs text-gray-500 mb-1">해시태그:</div>
                              <div className="flex flex-wrap gap-1">
                                {caption.hashtags.map((tag: string, index: number) => (
                                  <span key={index} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
                                    #{tag.replace('#', '')}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </Card>
                      ))
                    ) : (
                      <Card className="p-4">
                        <div className="text-center py-8 text-gray-500">
                          캡션을 생성하지 못했습니다.
                        </div>
                      </Card>
                    )}
                  </div>
                </div>
              )}
            </Card>

            {/* 오른쪽 사이드 - idle 상태일 때만 표시 */}
            {currentPhase === "idle" && (
              <div className="space-y-6 lg:col-span-2">
              {/* 최근 변환 */}
              <Card className="p-6">
                  <SectionTitle icon={History} title="최근 변환" subtitle="오늘 · 어제" />
                <div className="space-y-3">
                  {recentHistory.length > 0 ? (
                    recentHistory.map((item) => (
                      <div 
                        key={item.id} 
                        className="flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => handleRecentHistoryClick(item)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-14 h-10 rounded-lg bg-gray-200" />
                          <div>
                            <div className="text-sm font-medium text-gray-800">{item.video.originalName}</div>
                            <div className="text-xs text-gray-500">클립 {item.stats.highlights} · 썸네일 {item.stats.thumbnails} · 캡션 {item.stats.captions}</div>
                          </div>
                        </div>
                        <ChevronRight className="text-gray-300" />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      <p className="text-sm">아직 변환한 영상이 없습니다</p>
                    </div>
                  )}
                </div>
                </Card>

              {/* 크레딧 & 구독 */}
              <Card className="p-6">
                  <SectionTitle 
                    icon={CreditCard} 
                    title="크레딧 & 구독" 
                  subtitle={
                    isAuthenticated 
                      ? (user?.isSubscribed ? '프리미엄 구독 중' : '무료 5회 남음')
                      : '무료 5회 남음'
                  } 
                />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-2xl font-semibold text-gray-900">
                      {isAuthenticated 
                        ? (user?.isSubscribed ? '∞' : (user?.credits || 0))
                        : remainingCredits
                      }
                    </div>
                    <div className="text-xs text-gray-500">
                      {isAuthenticated 
                        ? (user?.isSubscribed ? '무제한 크레딧' : '/ 크레딧')
                        : '/ 월 5회 무료'
                      }
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!isAuthenticated || !user?.isSubscribed ? (
                      <>
                        <GhostButton onClick={() => setCurrentTab("billing")}>크레딧 충전</GhostButton>
                        <Button onClick={() => setCurrentTab("billing")}>프리미엄 구독</Button>
                      </>
                    ) : (
                      <GhostButton onClick={() => setCurrentTab("billing")}>구독 관리</GhostButton>
                    )}
                  </div>
                </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {currentTab === "history" && (
          <div className="max-w-6xl mx-auto">
            <HistoryTab autoSelectId={selectedHistoryId || undefined} />
          </div>
        )}
        {currentTab === "billing" && (
          <div className="max-w-6xl mx-auto">
            <BillingTab />
          </div>
        )}
        {currentTab === "account" && (
          <div className="max-w-6xl mx-auto">
            <ProfileTab onLogout={() => setCurrentTab("home")} />
          </div>
        )}
      </main>

      <footer className="border-t border-gray-100 py-8 text-center text-xs text-gray-500">© 2025 ClipAI · 영상 자동 리사이클링</footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          refetch();
        }}
      />

      {/* Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900">
                {previewModal.type === 'clip' ? '클립 미리보기' : '썸네일 미리보기'}
              </h3>
              <button
                onClick={() => setPreviewModal(null)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              {previewModal.type === 'clip' ? (
                <div className="space-y-4">
                  <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
                    <div className="text-center">
                      <Play size={48} className="text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">클립 미리보기</p>
                      <p className="text-sm text-gray-500 mt-2">
                        {previewModal.data.title} · {Math.round(previewModal.data.duration)}초
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-center gap-3">
                    <GhostButton onClick={() => setPreviewModal(null)}>
                      닫기
                    </GhostButton>
                    <Button onClick={() => downloadClip(previewModal.data.id, previewModal.data.title)}>
                      <Download size={16} className="inline mr-2" />
                      다운로드
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="aspect-video bg-gray-100 rounded-xl flex items-center justify-center">
                    <div className="text-center">
                      <ImageIcon size={48} className="text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">썸네일 미리보기</p>
                      <p className="text-sm text-gray-500 mt-2">
                        {Math.round(previewModal.data.timestamp)}초 지점
                      </p>
                    </div>
                  </div>
                  <div className="flex justify-center gap-3">
                    <GhostButton onClick={() => setPreviewModal(null)}>
                      닫기
                    </GhostButton>
                    <Button onClick={() => downloadThumbnail(previewModal.data.id)}>
                      <Download size={16} className="inline mr-2" />
                      다운로드
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {shareModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900">공유하기</h3>
              <button
                onClick={() => setShareModal(null)}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {shareModal.type === 'caption' ? (
                <>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-sm text-gray-800">{shareModal.data.content}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => shareToSocialMedia('twitter', shareModal.data.content)}
                      className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-center"
                    >
                      <div className="text-lg mb-1">🐦</div>
                      <div className="text-sm font-medium">Twitter</div>
                    </button>
                    
                    <button
                      onClick={() => shareToSocialMedia('facebook', shareModal.data.content)}
                      className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-center"
                    >
                      <div className="text-lg mb-1">📘</div>
                      <div className="text-sm font-medium">Facebook</div>
                    </button>
                    
                    <button
                      onClick={() => shareToSocialMedia('linkedin', shareModal.data.content)}
                      className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-center"
                    >
                      <div className="text-lg mb-1">💼</div>
                      <div className="text-sm font-medium">LinkedIn</div>
                    </button>
                    
                    <button
                      onClick={() => shareToSocialMedia('kakao', shareModal.data.content)}
                      className="p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors text-center"
                    >
                      <div className="text-lg mb-1">💬</div>
                      <div className="text-sm font-medium">KakaoTalk</div>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-gray-50 rounded-xl p-4 text-center">
                    <Play size={32} className="text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-800">{shareModal.data.title}</p>
                    <p className="text-xs text-gray-500">{Math.round(shareModal.data.duration)}초 클립</p>
                  </div>
                  
                  <div className="space-y-3">
                    <button
                      onClick={() => copyToClipboard(generateShareableLink('clip', shareModal.data.id))}
                      className="w-full p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Copy size={16} />
                      링크 복사
                    </button>
                    
                    <button
                      onClick={() => {
                        const shareText = `${shareModal.data.title} - ClipAI로 만든 하이라이트 클립`;
                        shareToSocialMedia('twitter', shareText, generateShareableLink('clip', shareModal.data.id));
                      }}
                      className="w-full p-3 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <ExternalLink size={16} />
                      소셜 미디어에 공유
                    </button>
                  </div>
                </>
              )}
              
              <div className="pt-4 border-t border-gray-100">
                <GhostButton className="w-full" onClick={() => setShareModal(null)}>
                  닫기
                </GhostButton>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}