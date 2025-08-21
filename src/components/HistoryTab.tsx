import React, { useState, useEffect } from 'react';
import { Film, Image as ImageIcon, Calendar, Clock, Download, Trash2, Play, Filter, Search, RefreshCw, Type, ArrowLeft, Copy, X } from 'lucide-react';
import { apiClient } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface HistoryItem {
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
  stats: {
    highlights: number;
    thumbnails: number;
    captions: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface HistoryResponse {
  history: HistoryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface ProcessingResult {
  id: number;
  videoId: number;
  status: string;
  progress: number;
  errorMessage?: string;
  video: {
    originalName: string;
    size: number;
    type: string;
  };
  highlights: Array<{
    id: number;
    title: string;
    duration: number;
    startTime: number;
    endTime: number;
    confidence: number;
    thumbnail?: string;
  }>;
  thumbnails: Array<{
    id: number;
    timestamp: number;
    width: number;
    height: number;
  }>;
  captions: Array<{
    id: number;
    platform: string;
    content: string;
    hashtags: string[];
  }>;
  createdAt: string;
  updatedAt: string;
}

const statusConfig = {
  pending: { label: '대기 중', color: 'bg-gray-100 text-gray-700', icon: Clock },
  processing: { label: '처리 중', color: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  completed: { label: '완료', color: 'bg-green-100 text-green-700', icon: Film },
  failed: { label: '실패', color: 'bg-red-100 text-red-700', icon: Trash2 },
};

interface HistoryTabProps {
  autoSelectId?: number;
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ autoSelectId }) => {
  const { isAuthenticated } = useAuth();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedResult, setSelectedResult] = useState<ProcessingResult | null>(null);
  const [resultLoading, setResultLoading] = useState(false);

  const fetchHistory = async (page = 1) => {
    if (!isAuthenticated) {
      setHistory([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response: HistoryResponse = await apiClient.getUserHistory(page, 10);
      
      setHistory(response.history);
      setTotalPages(response.pagination.pages);
      
      // Auto-select specific item if autoSelectId is provided
      if (autoSelectId && response.history.length > 0) {
        const targetItem = response.history.find(item => item.id === autoSelectId);
        if (targetItem && targetItem.status === 'completed') {
          viewProcessingResult(targetItem.id);
        }
      }
      setCurrentPage(response.pagination.page);
    } catch (error) {
      setError(error instanceof Error ? error.message : '히스토리를 불러오는데 실패했습니다.');
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [isAuthenticated]);

  const viewProcessingResult = async (processingId: number) => {
    try {
      setResultLoading(true);
      const result = await apiClient.getProcessingStatus(processingId);
      setSelectedResult(result);
    } catch (error) {
      setError('결과를 불러오는데 실패했습니다.');
      console.error('Failed to fetch processing result:', error);
    } finally {
      setResultLoading(false);
    }
  };

  // Clear autoSelectId after it's been used
  useEffect(() => {
    if (autoSelectId && selectedResult) {
      // Reset the autoSelectId by calling a callback (we'll need to add this)
    }
  }, [autoSelectId, selectedResult]);

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
      console.log('Text copied to clipboard');
    } catch (error) {
      console.error('Copy error:', error);
      setError('클립보드 복사 중 오류가 발생했습니다.');
    }
  };

  const downloadAllResults = async (processingId: number, fileName: string) => {
    try {
      const response = await fetch(`http://localhost:3002/api/download/all/${processingId}`, {
        headers: {
          ...(apiClient.getToken() && { Authorization: `Bearer ${apiClient.getToken()}` }),
        },
      });
      
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}_results.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download error:', error);
      setError('다운로드 중 오류가 발생했습니다.');
    }
  };

  const deleteProcessingResult = async (processingId: number) => {
    if (!confirm('정말로 이 변환 결과를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      return;
    }

    try {
      await apiClient.deleteProcessingResult(processingId);
      // Refresh the history list
      fetchHistory(currentPage);
      setSuccess('변환 결과가 삭제되었습니다.');
    } catch (error) {
      console.error('Delete error:', error);
      setError('삭제 중 오류가 발생했습니다.');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `오늘 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
      return `어제 ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
      return `${diffDays}일 전`;
    } else {
      return date.toLocaleDateString('ko-KR');
    }
  };

  const formatFileSize = (bytes: number) => {
    const MB = bytes / (1024 * 1024);
    return `${MB.toFixed(1)}MB`;
  };

  const filteredHistory = history.filter(item => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesSearch = searchTerm === '' || 
      item.video.originalName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (!isAuthenticated) {
    return (
      <div className="text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Film className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">로그인이 필요합니다</h3>
        <p className="text-gray-600">변환 히스토리를 확인하려면 로그인해주세요.</p>
      </div>
    );
  }

  // Show detailed result view when selectedResult is set
  if (selectedResult) {
    return (
      <div className="space-y-6">
        {/* Header with back button */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedResult(null)}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">변환 결과</h1>
            <p className="text-gray-600">{selectedResult.video.originalName}</p>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between p-4">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
              <X size={18} />
            </button>
          </div>
        )}

        {/* Highlights Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Film size={18} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">하이라이트 클립</h3>
          </div>
          
          <div className="grid sm:grid-cols-2 gap-4">
            {selectedResult.highlights && selectedResult.highlights.length > 0 ? (
              selectedResult.highlights.map((highlight) => (
                <div key={highlight.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 mb-3">
                    <Play />
                  </div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-600">
                      {highlight.title} · {Math.round(highlight.duration)}s
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm transition-colors">
                      미리보기
                    </button>
                    <button 
                      onClick={() => downloadClip(highlight.id, highlight.title)}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm transition-colors flex items-center gap-1"
                    >
                      <Download size={14} />
                      다운로드
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-2 text-center py-8 text-gray-500">
                생성된 하이라이트 클립이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* Thumbnails Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-green-50 text-green-600">
              <ImageIcon size={18} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">썸네일</h3>
          </div>
          
          <div className="grid grid-cols-3 gap-3">
            {selectedResult.thumbnails && selectedResult.thumbnails.length > 0 ? (
              selectedResult.thumbnails.map((thumbnail) => (
                <div 
                  key={thumbnail.id}
                  className="relative group w-full h-28 bg-gray-100 rounded-xl border border-gray-100 flex items-center justify-center cursor-pointer hover:border-indigo-300 transition-colors"
                  onClick={() => downloadThumbnail(thumbnail.id)}
                >
                  <ImageIcon size={24} className="text-gray-400" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
                    <button className="px-3 py-1 bg-white text-gray-700 rounded-lg text-sm flex items-center gap-1">
                      <Download size={14} />
                      다운로드
                    </button>
                  </div>
                  <div className="absolute bottom-2 left-2 text-xs text-gray-500 bg-white px-2 py-1 rounded">
                    {Math.round(thumbnail.timestamp)}s
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-8 text-gray-500">
                생성된 썸네일이 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* Captions Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <Type size={18} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">캡션</h3>
          </div>
          
          <div className="space-y-4">
            {selectedResult.captions && selectedResult.captions.length > 0 ? (
              selectedResult.captions.map((caption) => (
                <div key={caption.id} className="border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm text-gray-500 capitalize">
                      {caption.platform} · SEO 키워드 포함
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => copyToClipboard(caption.content)}
                        className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center gap-1 transition-colors"
                      >
                        <Copy size={14} />
                        복사
                      </button>
                      <button 
                        onClick={() => downloadCaption(caption.id, caption.platform)}
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm flex items-center gap-1 transition-colors"
                      >
                        <Download size={14} />
                        TXT 저장
                      </button>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-gray-800 mb-3">
                    {caption.content}
                  </p>
                  {caption.hashtags && caption.hashtags.length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <div className="text-xs text-gray-500 mb-1">해시태그:</div>
                      <div className="flex flex-wrap gap-1">
                        {caption.hashtags.map((tag, index) => (
                          <span key={index} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded">
                            #{tag.replace('#', '')}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                생성된 캡션이 없습니다.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">내 변환</h1>
          <p className="text-gray-600">변환한 영상들의 기록과 결과를 확인하세요</p>
        </div>
        <button
          onClick={() => fetchHistory(currentPage)}
          className="px-4 py-2 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors flex items-center gap-2"
        >
          <RefreshCw size={16} />
          새로고침
        </button>
      </div>

      {/* 필터 및 검색 */}
      <div className="bg-white rounded-2xl border border-gray-100 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* 상태 필터 */}
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="all">모든 상태</option>
              <option value="completed">완료됨</option>
              <option value="processing">처리 중</option>
              <option value="pending">대기 중</option>
              <option value="failed">실패</option>
            </select>
          </div>

          {/* 검색 */}
          <div className="flex items-center gap-2 flex-1">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              placeholder="파일명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
        </div>
      </div>

      {/* 성공 메시지 */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
          <p className="text-green-700">{success}</p>
          <button
            onClick={() => setSuccess(null)}
            className="mt-3 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-xl transition-colors"
          >
            확인
          </button>
        </div>
      )}

      {/* 히스토리 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex items-center gap-2 text-gray-600">
            <RefreshCw className="w-5 h-5 animate-spin" />
            로딩 중...
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => fetchHistory()}
            className="mt-3 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl transition-colors"
          >
            다시 시도
          </button>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Film className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {searchTerm || statusFilter !== 'all' ? '검색 결과가 없습니다' : '변환 기록이 없습니다'}
          </h3>
          <p className="text-gray-600">
            {searchTerm || statusFilter !== 'all' ? '다른 조건으로 검색해보세요.' : '첫 번째 영상을 변환해보세요!'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredHistory.map((item) => {
            const statusInfo = statusConfig[item.status];
            const StatusIcon = statusInfo.icon;
            
            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border border-gray-100 p-6 hover:border-gray-200 transition-colors ${item.status === 'completed' ? 'cursor-pointer' : ''}`}
                onClick={() => item.status === 'completed' ? viewProcessingResult(item.id) : null}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-4">
                    <div className="w-20 h-14 rounded-lg bg-gray-100 flex items-center justify-center">
                      <Film className="w-6 h-6 text-gray-400" />
                    </div>
                    
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">
                        {item.video.originalName}
                      </h3>
                      <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
                        <span>{formatFileSize(item.video.size)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Calendar size={14} />
                          {formatDate(item.createdAt)}
                        </span>
                      </div>
                      
                      {/* 상태 */}
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${statusInfo.color}`}>
                          <StatusIcon size={12} className={item.status === 'processing' ? 'animate-spin' : ''} />
                          {statusInfo.label}
                          {item.status === 'processing' && ` (${item.progress}%)`}
                        </span>
                        
                        {item.status === 'failed' && item.errorMessage && (
                          <span className="text-xs text-red-600">• {item.errorMessage}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* 액션 버튼 */}
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {item.status === 'completed' && (
                      <button 
                        onClick={() => downloadAllResults(item.id, item.video.originalName)}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                        title="모든 결과 다운로드"
                      >
                        <Download size={18} />
                      </button>
                    )}
                    <button 
                      onClick={() => deleteProcessingResult(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                      title="변환 결과 삭제"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* 결과 통계 */}
                {item.status === 'completed' && (
                  <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Film size={16} className="text-indigo-500" />
                      <span>클립 {item.stats.highlights}개</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <ImageIcon size={16} className="text-green-500" />
                      <span>썸네일 {item.stats.thumbnails}개</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Type size={16} className="text-purple-500" />
                      <span>캡션 {item.stats.captions}개</span>
                    </div>
                    
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        viewProcessingResult(item.id);
                      }}
                      disabled={resultLoading}
                      className="ml-auto px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors text-sm flex items-center gap-2 disabled:opacity-50"
                    >
                      {resultLoading ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                      결과 보기
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-6">
          <button
            onClick={() => fetchHistory(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            이전
          </button>
          
          <span className="px-4 py-2 text-sm text-gray-600">
            {currentPage} / {totalPages}
          </span>
          
          <button
            onClick={() => fetchHistory(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            다음
          </button>
        </div>
      )}
    </div>
  );
};