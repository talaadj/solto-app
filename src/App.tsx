import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  HardHat, 
  ShoppingBag, 
  Calculator, 
  Warehouse, 
  UserCircle,
  CheckCircle2,
  Clock,
  AlertCircle,
  Send,
  Plus,
  Search,
  Check,
  X,
  CreditCard,
  Package,
  MapPin,
  Phone,
  Zap,
  Mail,
  ExternalLink,
  Download,
  AlertTriangle,
  Menu,
  Star,
  StarHalf,
  CheckSquare,
  Square,
  ChevronDown,
  ChevronUp,
  Paperclip,
  Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserRole, Request, ProcurementOffer, InventoryItem, Transaction, Project } from './types';
import { foremanAgent, procurementAgent, accountantAgent, storekeeperAgent, snipSearchAgent } from './services/geminiService';
import { SNIP_SUGGESTIONS } from './constants';
import { supabase } from './services/supabase';

// --- Components ---

const Badge = ({ children, color }: { children: React.ReactNode, color: string }) => (
  <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${color}`}>
    {children}
  </span>
);

const Card = ({ children, className = "", onClick }: { children: React.ReactNode, className?: string, id?: string | number, key?: React.Key, onClick?: () => void }) => (
  <div onClick={onClick} className={`bg-white border border-black/5 rounded-2xl shadow-sm p-6 ${className}`}>
    {children}
  </div>
);

const ExpandableText = ({ text, className = "", limit = 100 }: { text: string, className?: string, limit?: number }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const shouldTruncate = text.length > limit;

  if (!shouldTruncate) return <p className={className}>{text}</p>;

  return (
    <div className={className}>
      <div className={isExpanded ? "" : "line-clamp-2"}>
        {text}
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
        className="text-[10px] font-bold text-indigo-600 hover:underline mt-1 flex items-center gap-1"
      >
        {isExpanded ? "Скрыть" : "Подробнее..."}
        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
    </div>
  );
};

const FileUploadModal = ({ isOpen, onClose, onUpload }: { isOpen: boolean, onClose: () => void, onUpload: (files: File[]) => void }) => {
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      setFiles(prev => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    onUpload(files);
    setFiles([]);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Прикрепить файлы</h3>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-colors ${
                isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <Upload className="w-10 h-10 text-gray-300 mx-auto mb-4" />
              <p className="text-sm text-gray-500 mb-2">Перетащите файлы сюда или</p>
              <label className="cursor-pointer text-indigo-600 font-bold hover:underline">
                выберите на компьютере
                <input type="file" multiple className="hidden" onChange={handleFileChange} />
              </label>
            </div>

            {files.length > 0 && (
              <div className="mt-6 space-y-2 max-h-40 overflow-y-auto">
                {files.map((file, i) => (
                  <div key={i} className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-xs font-medium truncate">{file.name}</span>
                    </div>
                    <button onClick={() => removeFile(i)} className="p-1 hover:bg-gray-200 rounded-md">
                      <X className="w-3 h-3 text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 flex gap-3">
              <button 
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              >
                Отмена
              </button>
              <button 
                onClick={handleUpload}
                disabled={files.length === 0}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-sm bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                Прикрепить ({files.length})
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// --- Role Views ---

const WORK_CATEGORIES = [
  "Бетонные работы",
  "Арматурные работы",
  "Каменные работы",
  "Кровельные работы",
  "Отделочные работы",
  "Земляные работы",
  "Электромонтажные работы",
  "Сантехнические работы"
];

const ForemanView = ({ requests, onNewRequest, currentProjectId }: { requests: Request[], onNewRequest: (title: string, desc: string) => void, currentProjectId: number | null }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{title: string, description: string}[]>([]);
  const [searchingSnips, setSearchingSnips] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (title.length > 2) {
        setSearchingSnips(true);
        try {
          const staticSuggestions = SNIP_SUGGESTIONS.filter(s => 
            s.title.toLowerCase().includes(title.toLowerCase()) || 
            s.description.toLowerCase().includes(title.toLowerCase())
          );
          const results = await snipSearchAgent(title);
          
          const combined = [...staticSuggestions, ...results];
          const unique = Array.from(new Map(combined.map(item => [item.title, item])).values());
          
          setAiSuggestions(unique);
          setShowSuggestions(true);
        } catch (e) {
          console.error(e);
        } finally {
          setSearchingSnips(false);
        }
      } else {
        setAiSuggestions([]);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [title]);

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(category);
    setTitle(category);
  };

  const handleAgentRequest = async () => {
    if (!title || !currentProjectId) return;
    setLoading(true);
    try {
      const result = await foremanAgent(title + (description ? ' ' + description : ''));
      onNewRequest(result.title, result.description);
      setTitle('');
      setDescription('');
      setShowSuggestions(false);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Произошла ошибка при обращении к ИИ.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (!title || !description || !currentProjectId) return;
    onNewRequest(title, description);
    setTitle('');
    setDescription('');
    setShowSuggestions(false);
  };

  const useSuggestion = (suggestion: {title: string, description: string}) => {
    setTitle(suggestion.title);
    setDescription(suggestion.description);
    setShowSuggestions(false);
  };

  if (!currentProjectId) return <div className="text-center p-10 text-gray-400">Выберите объект строительства для начала работы</div>;

  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <HardHat className="w-5 h-5" /> Заявка от Прораба (ИИ по СНиП)
        </h3>
        <div className="relative">
          <div className="flex flex-col gap-3">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Название заявки (например: арматура 12мм для фундамента по СНиП)"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setShowSuggestions(e.target.value.length > 0);
                }}
                onFocus={() => title.length > 0 && setShowSuggestions(true)}
              />
              <AnimatePresence>
                {showSuggestions && (aiSuggestions.length > 0 || searchingSnips) && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute z-20 left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[320px]"
                  >
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Подходящие нормы СНиП / ГОСТ</span>
                      <button 
                        onClick={() => setShowSuggestions(false)}
                        className="p-1 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>
                    <div className="overflow-y-auto custom-scrollbar">
                      {searchingSnips && (
                        <div className="px-4 py-3 text-xs text-gray-400 flex items-center gap-2">
                          <div className="w-3 h-3 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
                          Поиск в базе СНиП...
                        </div>
                      )}
                      {aiSuggestions.length === 0 && !searchingSnips && (
                        <div className="px-4 py-8 text-center text-xs text-gray-400">
                          Ничего не найдено. Попробуйте другой запрос.
                        </div>
                      )}
                      {aiSuggestions.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => useSuggestion(s)}
                          className="w-full text-left px-4 py-3 hover:bg-indigo-50 border-b border-gray-100 last:border-0 transition-colors group"
                        >
                          <div className="font-bold text-sm group-hover:text-indigo-600 transition-colors">{s.title}</div>
                          <div className="text-xs text-gray-500 line-clamp-2 mt-0.5">{s.description}</div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            <textarea
              placeholder="Описание и технические требования..."
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5 min-h-[100px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="w-full sm:w-auto bg-white text-indigo-600 border border-indigo-100 px-6 py-2 rounded-xl font-medium hover:bg-indigo-50 transition-colors flex items-center justify-center gap-2"
              >
                <Paperclip className="w-4 h-4" /> 
                {attachedFiles.length > 0 ? `Файлы (${attachedFiles.length})` : 'Прикрепить файл'}
              </button>
              <button 
                onClick={handleAgentRequest}
                disabled={loading || !title}
                className="w-full sm:w-auto bg-white text-black border border-gray-200 px-6 py-2 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {loading ? 'Анализ СНиП...' : 'Сгенерировать ИИ'}
              </button>
              <button 
                onClick={handleSubmit}
                disabled={loading || !title || !description}
                className="w-full sm:w-auto bg-black text-white px-6 py-2 rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Отправить заявку
              </button>
            </div>

            <FileUploadModal 
              isOpen={isUploadModalOpen} 
              onClose={() => setIsUploadModalOpen(false)} 
              onUpload={(files) => setAttachedFiles(prev => [...prev, ...files])} 
            />
          </div>
          
          <div className="mt-4">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Тип работ (авто-подбор СНиП):</span>
            <div className="flex flex-wrap gap-2">
              {WORK_CATEGORIES.map((cat, i) => (
                <button 
                  key={i}
                  onClick={() => handleCategoryClick(cat)}
                  className={`text-[10px] px-3 py-1.5 rounded-lg transition-all border ${
                    selectedCategory === cat 
                    ? 'bg-black text-white border-black' 
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {requests.map(req => (
          <Card key={req.id} id={req.id} className="relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
              <h4 className="font-bold text-gray-900">{req.title}</h4>
              <div className="self-start sm:self-auto">
                <Badge color={
                  req.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                  req.status === 'payment_pending' ? 'bg-indigo-100 text-indigo-700' :
                  'bg-green-100 text-green-700'
                }>
                  {req.status === 'payment_pending' ? 'Ожидает оплаты' : req.status}
                </Badge>
              </div>
            </div>
            <ExpandableText text={req.description} className="text-sm text-gray-600 mb-4 whitespace-pre-wrap" />
            <div className="text-[10px] text-gray-400 font-mono">
              ID: {req.id} | {new Date(req.created_at).toLocaleString()}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};

const DirectorView = ({ projects, requests, onApproveRequest, onRejectRequest, onApproveOffer, onRefresh, currentProjectId }: { 
  projects: Project[],
  requests: Request[], 
  onApproveRequest: (id: number) => void,
  onRejectRequest: (id: number) => void,
  onApproveOffer: (id: number, requestId: number) => Promise<void>,
  onRefresh: () => void,
  currentProjectId: number | null
}) => {
  const [offers, setOffers] = useState<Record<number, ProcurementOffer[]>>({});
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [approvingOffer, setApprovingOffer] = useState<number | null>(null);
  const [filterByProject, setFilterByProject] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<ProcurementOffer | null>(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState<number[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const handleApprove = async (offerId: number, requestId: number) => {
    setApprovingOffer(offerId);
    try {
      await onApproveOffer(offerId, requestId);
    } finally {
      setApprovingOffer(null);
    }
  };

  const toggleRequestSelection = (id: number) => {
    setSelectedRequestIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = (pendingReqs: Request[]) => {
    if (selectedRequestIds.length === pendingReqs.length) {
      setSelectedRequestIds([]);
    } else {
      setSelectedRequestIds(pendingReqs.map(r => r.id));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedRequestIds.length === 0) return;
    setIsBulkProcessing(true);
    try {
      for (const id of selectedRequestIds) {
        await onApproveRequest(id);
      }
      setSelectedRequestIds([]);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkReject = async () => {
    if (selectedRequestIds.length === 0) return;
    if (!window.confirm(`Вы уверены, что хотите отклонить ${selectedRequestIds.length} заявок?`)) return;
    setIsBulkProcessing(true);
    try {
      for (const id of selectedRequestIds) {
        await onRejectRequest(id);
      }
      setSelectedRequestIds([]);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const fetchOffers = async () => {
    setLoadingOffers(true);
    const procurementRequests = requests.filter(r => r.status === 'procurement');
    const newOffers: Record<number, ProcurementOffer[]> = {};
    
    for (const r of procurementRequests) {
      try {
        const res = await fetch(`/api/procurement/${r.id}`);
        if (res.ok) {
          const data = await res.json();
          newOffers[r.id] = data;
        } else {
          newOffers[r.id] = [];
        }
      } catch (e) {
        console.error(`Error fetching offers for request ${r.id}:`, e);
        newOffers[r.id] = [];
      }
    }
    setOffers(newOffers);
    setLoadingOffers(false);
  };

  useEffect(() => {
    if (requests.length > 0) {
      fetchOffers();
    }
  }, [requests]);

  const filteredRequests = filterByProject && currentProjectId 
    ? requests.filter(r => r.project_id === currentProjectId)
    : requests;

  const pendingRequests = filteredRequests.filter(r => r.status === 'pending');
  const procurementRequests = filteredRequests.filter(r => r.status === 'procurement');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Панель Утверждения</h2>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm hover:bg-gray-50 transition-colors self-start sm:self-auto">
          <input 
            type="checkbox" 
            className="rounded text-black focus:ring-black w-4 h-4"
            checked={filterByProject}
            onChange={(e) => setFilterByProject(e.target.checked)}
            disabled={!currentProjectId}
          />
          Только текущий объект
        </label>
      </div>
      
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-gray-500 uppercase text-xs tracking-widest">Новые заявки ({pendingRequests.length})</h3>
          {pendingRequests.length > 0 && (
            <button 
              onClick={() => toggleSelectAll(pendingRequests)}
              className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              {selectedRequestIds.length === pendingRequests.length ? 'Снять выделение' : 'Выделить все'}
            </button>
          )}
        </div>

        <AnimatePresence>
          {selectedRequestIds.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg flex items-center justify-between gap-4 sticky top-4 z-30"
            >
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-xl">
                  <CheckSquare className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold opacity-80 uppercase tracking-tighter">Массовые действия</div>
                  <div className="text-sm font-bold">Выбрано: {selectedRequestIds.length}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleBulkReject}
                  disabled={isBulkProcessing}
                  className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
                >
                  Отклонить
                </button>
                <button 
                  onClick={handleBulkApprove}
                  disabled={isBulkProcessing}
                  className="px-4 py-2 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl text-xs font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
                >
                  {isBulkProcessing ? (
                    <div className="w-3 h-3 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin" />
                  ) : (
                    <Check className="w-3 h-3" />
                  )}
                  Утвердить все
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {pendingRequests.length === 0 && <p className="text-sm text-gray-400">Нет новых заявок для утверждения</p>}
        {pendingRequests.map(req => (
          <Card 
            key={req.id} 
            id={req.id} 
            className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${selectedRequestIds.includes(req.id) ? 'border-indigo-500 bg-indigo-50/30 ring-1 ring-indigo-500' : ''}`}
          >
            <div className="flex items-start gap-4 flex-1">
              <button 
                onClick={() => toggleRequestSelection(req.id)}
                className={`mt-1 p-1 rounded-md transition-colors ${selectedRequestIds.includes(req.id) ? 'text-indigo-600' : 'text-gray-300 hover:text-gray-400'}`}
              >
                {selectedRequestIds.includes(req.id) ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold">{req.title}</h4>
                  {!filterByProject && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-md font-medium">
                      {projects.find(p => p.id === req.project_id)?.name || 'Объект не указан'}
                    </span>
                  )}
                </div>
                <ExpandableText text={req.description} className="text-sm text-gray-600 whitespace-pre-wrap" />
              </div>
            </div>
            <div className="flex gap-2 shrink-0 self-end sm:self-auto ml-9 sm:ml-0">
              <button 
                onClick={() => onApproveRequest(req.id)} 
                className="p-3 bg-green-50 text-green-600 rounded-xl hover:bg-green-100 transition-colors"
                title="Утвердить заявку"
              >
                <Check className="w-5 h-5" />
              </button>
              <button 
                onClick={() => onRejectRequest(req.id)}
                className="p-3 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-colors"
                title="Отклонить"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0">
          <h3 className="font-semibold text-gray-500 uppercase text-xs tracking-widest flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" /> Предложения снабжения ({procurementRequests.length})
          </h3>
          <button 
            onClick={() => { onRefresh(); fetchOffers(); }}
            className="text-[10px] sm:text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 self-start sm:self-auto"
          >
            <Clock className={`w-3 h-3 ${loadingOffers ? 'animate-spin' : ''}`} /> Обновить данные
          </button>
        </div>
        <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl mb-4">
          <p className="text-[10px] text-indigo-700 leading-relaxed">
            <span className="font-bold">Совет Директору:</span> Снабженец уже нашел варианты. 
            Выберите наиболее подходящий по цене, адресу и рейтингу, чтобы инициировать оплату бухгалтерией.
          </p>
        </div>
        {procurementRequests.length === 0 && (
          <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-2xl">
            <p className="text-sm text-gray-400">Пока нет готовых предложений от снабжения</p>
          </div>
        )}
        {procurementRequests.map(req => (
          <div key={req.id} className="space-y-2 p-5 bg-white rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-tighter mb-1">
                  Заявка №{req.id} 
                  {!filterByProject && ` • ${projects.find(p => p.id === req.project_id)?.name || 'Объект не указан'}`}
                </div>
                <h4 className="font-bold text-gray-900 flex items-center gap-2">
                  {req.title}
                </h4>
              </div>
              <div className="self-start sm:self-auto">
                <Badge color="bg-blue-100 text-blue-700">Выбор поставщика</Badge>
              </div>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {offers[req.id] === undefined ? (
                <div className="col-span-3 py-10 text-center">
                  <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto mb-2" />
                  <div className="text-xs text-gray-400">Загрузка предложений...</div>
                </div>
              ) : offers[req.id].length === 0 ? (
                <div className="col-span-3 py-10 text-center bg-gray-50 rounded-2xl">
                  <Search className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <div className="text-xs text-gray-400">Снабженец еще не запустил ИИ-поиск для этой заявки</div>
                </div>
              ) : (
                offers[req.id].map((offer, idx) => (
                  <Card key={offer.id} id={offer.id} className={`relative border-2 transition-all hover:scale-[1.02] ${idx === 1 ? 'border-indigo-500 shadow-indigo-100 shadow-lg' : 'border-gray-200 bg-gray-50/50 opacity-90'}`}>
                    {idx === 1 && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-bold px-3 py-1 rounded-full shadow-sm">
                        РЕКОМЕНДАЦИЯ ИИ
                      </div>
                    )}
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <button 
                          onClick={() => setSelectedOffer(offer)}
                          className="font-bold text-sm text-indigo-600 hover:text-indigo-800 hover:underline text-left transition-colors"
                        >
                          {offer.supplier_name}
                        </button>
                        <div className="flex items-center gap-0.5 mt-1">
                          {[...Array(5)].map((_, i) => {
                            const ratingValue = i + 1;
                            if (offer.rating >= ratingValue) {
                              return <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />;
                            } else if (offer.rating >= ratingValue - 0.5) {
                              return <StarHalf key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />;
                            } else {
                              return <Star key={i} className="w-3 h-3 text-gray-300" />;
                            }
                          })}
                          <span className="text-[10px] font-bold text-gray-500 ml-1">{offer.rating.toFixed(1)}</span>
                        </div>
                        {offer.supplier_address && (
                          <div className="flex items-start gap-1 mt-1.5 text-[10px] text-gray-500" title={offer.supplier_address}>
                            <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-tight">
                              {offer.supplier_address}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-indigo-600 font-mono font-black text-sm">{offer.price.toLocaleString()}</div>
                        <div className="text-[8px] text-gray-400 uppercase font-bold">сом</div>
                      </div>
                    </div>
                    
                    <ExpandableText text={offer.details} className="text-[11px] text-gray-600 mb-4 italic leading-relaxed" limit={80} />
                    
                    {(offer.reliability_score !== undefined || offer.risk_assessment) && (
                      <div className="mb-4 space-y-2 bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                        {offer.reliability_score !== undefined && (
                          <div>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[10px] font-bold text-gray-500 uppercase">Надежность</span>
                              <span className={`text-[10px] font-bold ${offer.reliability_score >= 80 ? 'text-green-600' : offer.reliability_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {offer.reliability_score}/100
                              </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-1.5">
                              <div 
                                className={`h-1.5 rounded-full ${offer.reliability_score >= 80 ? 'bg-green-500' : offer.reliability_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                                style={{ width: `${offer.reliability_score}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                        {offer.risk_assessment && (
                          <div>
                            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Оценка рисков</span>
                            <ExpandableText text={offer.risk_assessment} className="text-[10px] text-gray-600 leading-relaxed" limit={60} />
                          </div>
                        )}
                      </div>
                    )}

                    <button 
                      onClick={() => setSelectedOffer(offer)}
                      className="w-full py-2.5 mb-4 rounded-xl text-[10px] font-bold transition-all shadow-sm flex items-center justify-center gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-100 uppercase tracking-wider"
                    >
                      <Phone className="w-3 h-3" /> Связаться с поставщиком
                    </button>

                    <div className="space-y-2 mb-6 border-t border-gray-100 pt-3">
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <MapPin className="w-3 h-3 text-gray-400" /> {offer.supplier_address}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <Phone className="w-3 h-3 text-gray-400" /> {offer.supplier_phone}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500">
                        <Mail className="w-3 h-3 text-gray-400" /> {offer.supplier_email}
                      </div>
                      {offer.source_url && (
                        <a 
                          href={offer.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[10px] text-indigo-600 hover:underline mt-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Открыть источник
                        </a>
                      )}
                    </div>

                    <div className="flex gap-2 mt-4">
                      <button 
                        onClick={() => setSelectedOffer(offer)}
                        className="flex-1 py-3 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                      >
                        <ExternalLink className="w-3 h-3" /> ПОДРОБНЕЕ
                      </button>
                      <button 
                        onClick={() => handleApprove(offer.id, req.id)}
                        disabled={approvingOffer === offer.id}
                        className={`flex-1 py-3 rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-2 ${
                          idx === 1 
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
                          : 'bg-black text-white hover:bg-gray-800'
                        } ${approvingOffer === offer.id ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {approvingOffer === offer.id ? (
                          <>
                            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ОПЛАТА...
                          </>
                        ) : (
                          'ОПЛАТИТЬ'
                        )}
                      </button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Supplier Details Modal */}
      <AnimatePresence>
        {selectedOffer && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto flex flex-col"
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">{selectedOffer.supplier_name}</h3>
                  <div className="flex items-center gap-1 mt-2">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`w-3 h-3 rounded-full ${i < Math.floor(selectedOffer.rating) ? 'bg-yellow-400' : 'bg-gray-200'}`} />
                    ))}
                    <span className="text-xs font-bold text-gray-500 ml-2">{selectedOffer.rating} / 5.0</span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedOffer(null)}
                  className="p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Контактная информация</h4>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="bg-white p-2 rounded-lg shadow-sm">
                        <MapPin className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Адрес</div>
                        <div className="text-sm font-medium text-gray-900">{selectedOffer.supplier_address}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-white p-2 rounded-lg shadow-sm">
                        <Phone className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Телефон</div>
                        <div className="text-sm font-medium text-gray-900">{selectedOffer.supplier_phone}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-white p-2 rounded-lg shadow-sm">
                        <Mail className="w-4 h-4 text-indigo-600" />
                      </div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Email</div>
                        <div className="text-sm font-medium text-gray-900">{selectedOffer.supplier_email}</div>
                      </div>
                    </div>
                    {selectedOffer.source_url && (
                      <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded-lg shadow-sm">
                          <ExternalLink className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <div className="text-[10px] text-gray-400 uppercase font-bold">Веб-сайт / Источник</div>
                          <a href={selectedOffer.source_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-600 hover:underline break-all">
                            {selectedOffer.source_url}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">Оценка надежности</h4>
                  
                  {selectedOffer.reliability_score !== undefined && (
                    <div className="mb-4">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-sm font-bold text-gray-700">Индекс доверия ИИ</span>
                        <span className={`text-xl font-black ${selectedOffer.reliability_score >= 80 ? 'text-green-600' : selectedOffer.reliability_score >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                          {selectedOffer.reliability_score}/100
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${selectedOffer.reliability_score}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={`h-2.5 rounded-full ${selectedOffer.reliability_score >= 80 ? 'bg-green-500' : selectedOffer.reliability_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                        />
                      </div>
                    </div>
                  )}

                  {selectedOffer.risk_assessment && (
                    <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                      <span className="text-[10px] font-bold text-gray-400 uppercase block mb-2 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-amber-500" /> Анализ рисков
                      </span>
                      <p className="text-sm text-gray-700 leading-relaxed">{selectedOffer.risk_assessment}</p>
                    </div>
                  )}
                </div>

                <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Детали предложения</h4>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-medium text-indigo-900">Стоимость:</span>
                    <span className="text-lg font-black text-indigo-700 font-mono">{selectedOffer.price.toLocaleString()} сом</span>
                  </div>
                  <p className="text-sm text-indigo-800 italic leading-relaxed">"{selectedOffer.details}"</p>
                </div>
              </div>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <a 
                  href={`tel:${selectedOffer.supplier_phone}`}
                  className="flex-1 bg-white border border-gray-200 text-gray-700 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <Phone className="w-4 h-4" /> Позвонить
                </a>
                <a 
                  href={`mailto:${selectedOffer.supplier_email}?subject=${encodeURIComponent(`Запрос по заявке: ${requests.find(r => r.id === selectedOffer.request_id)?.title || selectedOffer.request_id}`)}&body=${encodeURIComponent(`Здравствуйте, ${selectedOffer.supplier_name}!\n\nМеня интересует ваше предложение по поставке материалов для нашего объекта.\n\nДетали предложения: ${selectedOffer.details}\nЦена: ${selectedOffer.price} сом\n\nБудем ждать вашего ответа.`)}`}
                  className="flex-1 bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                >
                  <Mail className="w-4 h-4" /> Написать email
                </a>
                <button 
                  onClick={() => setSelectedOffer(null)}
                  className="px-6 py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ProcurementView = ({ requests, onSearch, projectAddress }: { requests: Request[], onSearch: (req: Request) => void, projectAddress: string }) => {
  const [searching, setSearching] = useState<number | null>(null);

  const handleSearch = async (req: Request) => {
    setSearching(req.id);
    try {
      const offers = await procurementAgent(req.title, req.description, projectAddress);
      
      if (!offers || offers.length === 0) {
        alert("ИИ не смог найти подходящих предложений. Попробуйте уточнить техзадание или повторить поиск позже.");
        return;
      }

      for (const offer of offers) {
        await fetch('/api/procurement', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...offer, request_id: req.id })
        });
      }
      await fetch(`/api/requests/${req.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'procurement' })
      });
      onSearch(req);
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Произошла ошибка при поиске. Проверьте соединение или API ключ.");
    } finally {
      setSearching(null);
    }
  };

  const activeRequests = requests.filter(r => r.status === 'approved' || r.status === 'procurement');
  const pendingRequests = requests.filter(r => r.status === 'pending');

  return (
    <div className="space-y-6">
      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex gap-3 items-start">
        <div className="bg-amber-100 p-2 rounded-lg">
          <Search className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-amber-900">Интеллектуальный Поиск (Live)</h4>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">
            Наш агент использует <span className="font-bold">Google Search Grounding</span> для анализа реального рынка Кыргызстана в режиме реального времени. 
            Он находит не только материалы, но и услуги мастеров, аренду техники и строительные работы.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2">Активные заявки ({activeRequests.length})</h3>
        {activeRequests.length === 0 && (
          <div className="text-center py-10 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
            <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-400">Нет активных заявок для снабжения</p>
            <p className="text-[10px] text-gray-400 mt-2 italic">Одобренные директором заявки появятся здесь автоматически.</p>
          </div>
        )}
        {activeRequests.map(req => (
          <Card key={req.id} className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-l-4 border-l-amber-500">
            <div className="flex-1 w-full">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h4 className="font-bold text-gray-900">{req.title}</h4>
                <Badge color={req.status === 'procurement' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}>
                  {req.status === 'procurement' ? 'Поиск завершен' : 'Одобрено директором'}
                </Badge>
              </div>
              <ExpandableText text={req.description} className="text-sm text-gray-500" limit={100} />
            </div>
            <button 
              onClick={() => handleSearch(req)}
              disabled={searching === req.id}
              className={`w-full md:w-auto justify-center px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm shrink-0 ${
                req.status === 'procurement' 
                ? 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50' 
                : 'bg-amber-500 text-white hover:bg-amber-600'
              }`}
            >
              {searching === req.id ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Live-поиск в Google...
                </>
              ) : req.status === 'procurement' ? (
                <>
                  <Search className="w-4 h-4" /> Обновить Live-поиск
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" /> Запустить Live-поиск
                </>
              )}
            </button>
          </Card>
        ))}
      </div>

      {pendingRequests.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest px-2 mb-4">Ожидают одобрения директора ({pendingRequests.length})</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
            {pendingRequests.map(req => (
              <div key={req.id} className="bg-white border border-gray-100 p-4 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="font-bold text-sm text-gray-700">{req.title}</h5>
                  <Badge color="bg-gray-100 text-gray-400">В очереди</Badge>
                </div>
                <ExpandableText text={req.description} className="text-xs text-gray-400" limit={50} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ... (AccountantView and StorekeeperView remain similar but can be updated if needed)

const AccountantView = ({ transactions, requests, onProcessPayment }: { transactions: Transaction[], requests: Request[], onProcessPayment: (requestId: number) => void }) => {
  const pendingPayments = requests.filter(r => r.status === 'payment_pending');
  const [processingId, setProcessingId] = useState<number | null>(null);

  const handleProcess = async (id: number) => {
    setProcessingId(id);
    await onProcessPayment(id);
    setProcessingId(null);
  };

  const exportToCSV = () => {
    const headers = ['Дата', 'Описание', 'Тип', 'Сумма (сом)'];
    const rows = transactions.map(t => [
      new Date(t.created_at).toLocaleDateString(),
      `"${t.description.replace(/"/g, '""')}"`,
      t.type === 'income' ? 'Доход' : 'Расход',
      t.amount
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `transactions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPendingPaymentsToCSV = () => {
    const headers = ['ID Заявки', 'Название', 'Описание', 'Дата создания'];
    const rows = pendingPayments.map(p => [
      p.id,
      `"${p.title.replace(/"/g, '""')}"`,
      `"${p.description.replace(/"/g, '""')}"`,
      new Date(p.created_at).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `pending_payments_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, t) => acc + t.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, t) => acc + t.amount, 0);
  const balance = totalIncome - totalExpense;

  return (
    <div className="space-y-6">
      <div className="bg-green-50 border border-green-200 p-4 rounded-2xl flex gap-3 items-start">
        <div className="bg-green-100 p-2 rounded-lg">
          <Calculator className="w-5 h-5 text-green-600" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-green-900">ИИ-Бухгалтер (Интеграция с 1С)</h4>
          <p className="text-xs text-green-700 mt-1 leading-relaxed">
            Агент автоматически формирует бухгалтерские проводки (Дт/Кт), определяет налоговые последствия и ведет главную книгу на основе утвержденных директором заявок.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white border-l-4 border-l-blue-500">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Поступления</div>
          <div className="text-2xl font-mono font-bold text-blue-600">+{totalIncome.toLocaleString()} <span className="text-sm">сом</span></div>
        </Card>
        <Card className="bg-white border-l-4 border-l-red-500">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Расходы</div>
          <div className="text-2xl font-mono font-bold text-red-600">-{totalExpense.toLocaleString()} <span className="text-sm">сом</span></div>
        </Card>
        <Card className="bg-white border-l-4 border-l-green-500">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Текущий баланс</div>
          <div className="text-2xl font-mono font-bold text-green-600">{balance.toLocaleString()} <span className="text-sm">сом</span></div>
        </Card>
      </div>

      {pendingPayments.length > 0 && (
        <div className="space-y-4 mb-8">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-500 uppercase text-xs tracking-widest">Ожидают проведения в 1С ({pendingPayments.length})</h3>
            <button 
              onClick={exportPendingPaymentsToCSV}
              className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <Download className="w-4 h-4" />
              Экспорт списка в CSV
            </button>
          </div>
          {pendingPayments.map(req => (
            <Card key={req.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 border-l-indigo-500 bg-indigo-50/30">
              <div className="flex-1 w-full">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h4 className="font-bold">{req.title}</h4>
                  <Badge color="bg-indigo-100 text-indigo-700">Одобрено директором</Badge>
                </div>
                <ExpandableText text={req.description} className="text-sm text-gray-600 whitespace-pre-wrap" />
              </div>
              <button 
                onClick={() => handleProcess(req.id)}
                disabled={processingId === req.id}
                className={`w-full sm:w-auto justify-center px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-sm shrink-0 bg-indigo-600 text-white hover:bg-indigo-700 ${processingId === req.id ? 'opacity-70 cursor-not-allowed' : ''}`}
              >
                {processingId === req.id ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Генерация проводок...
                  </>
                ) : (
                  'Провести оплату (1С)'
                )}
              </button>
            </Card>
          ))}
        </div>
      )}
      
      <div className="flex justify-between items-center mt-8 mb-4">
        <h3 className="font-semibold text-gray-500 uppercase text-xs tracking-widest">Главная книга (Журнал операций)</h3>
        <button 
          onClick={exportToCSV}
          className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          <Download className="w-4 h-4" />
          Экспорт в CSV
        </button>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead className="bg-gray-50 border-bottom border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Дата</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Описание</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest">Тип</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-widest text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map(t => (
                <tr key={t.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">{new Date(t.created_at).toLocaleDateString()}</td>
                  <td className="px-6 py-4 text-sm font-medium whitespace-pre-wrap min-w-[200px]">
                    <ExpandableText text={t.description} className="text-sm font-medium" limit={100} />
                  </td>
                  <td className="px-6 py-4">
                    <Badge color={t.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                      {t.type === 'income' ? 'Доход' : 'Расход'}
                    </Badge>
                  </td>
                  <td className={`px-6 py-4 text-sm font-bold text-right ${t.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {t.type === 'income' ? '+' : '-'}{t.amount.toLocaleString()} сом
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const StorekeeperView = ({ inventory, onAddItem }: { inventory: InventoryItem[], onAddItem: (name: string, quantity: number, unit: string) => Promise<void> }) => {
  const [showModal, setShowModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAdd = async () => {
    if (!newItemName || !newItemQuantity || !newItemUnit) return;
    setLoading(true);
    try {
      await onAddItem(newItemName, parseFloat(newItemQuantity), newItemUnit);
      setShowModal(false);
      setNewItemName('');
      setNewItemQuantity('');
      setNewItemUnit('');
    } catch (e) {
      console.error(e);
      alert('Ошибка при добавлении товара');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Складской Учет</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {inventory.map(item => (
          <Card key={item.id} id={item.id} className="flex flex-col items-center text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
            <h4 className="font-bold mb-1">{item.item_name}</h4>
            <div className="text-2xl font-mono font-bold text-indigo-600">
              {item.quantity} <span className="text-sm text-gray-400 font-normal">{item.unit}</span>
            </div>
          </Card>
        ))}
        <Card 
          onClick={() => setShowModal(true)}
          className="border-dashed border-2 flex flex-center justify-center items-center cursor-pointer hover:bg-gray-50 min-h-[160px]"
        >
          <Plus className="w-8 h-8 text-gray-300" />
        </Card>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col"
            >
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-xl font-bold">Добавить товар</h3>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Название</label>
                  <input 
                    type="text" 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5"
                    placeholder="Например: Цемент М500"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Количество</label>
                    <input 
                      type="number" 
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5"
                      placeholder="0"
                      value={newItemQuantity}
                      onChange={(e) => setNewItemQuantity(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Ед. изм.</label>
                    <input 
                      type="text" 
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5"
                      placeholder="шт, кг, т..."
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                    />
                    <div className="flex gap-1 mt-2">
                      {['шт', 'кг', 'т', 'м', 'м2', 'м3'].map(u => (
                        <button
                          key={u}
                          onClick={() => setNewItemUnit(u)}
                          className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
                            newItemUnit === u 
                            ? 'bg-black text-white border-black' 
                            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                          }`}
                        >
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                
                <button 
                  onClick={handleAdd}
                  disabled={loading || !newItemName || !newItemQuantity || !newItemUnit}
                  className="w-full mt-4 py-3 bg-black text-white rounded-2xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Добавление...
                    </>
                  ) : (
                    'Добавить на склад'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [role, setRole] = useState<UserRole>('director');
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectAddress, setNewProjectAddress] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchData = async () => {
    const [projs, inv, trans] = await Promise.all([
      fetch('/api/projects').then(res => res.json()),
      fetch('/api/inventory').then(res => res.json()),
      fetch('/api/transactions').then(res => res.json())
    ]);
    setProjects(projs);
    setInventory(inv);
    setTransactions(trans);
    
    if (projs.length > 0 && !currentProject) {
      setCurrentProject(projs[0]);
    }
  };

  const fetchRequests = async () => {
    let url = '/api/requests';
    // Director can see all requests, others see only current project's requests
    if (role !== 'director' && currentProject) {
      url += `?project_id=${currentProject.id}`;
    }
    const reqs = await fetch(url).then(res => res.json());
    setRequests(reqs);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [currentProject, role]);

  const handleNewProject = async () => {
    if (!newProjectName) return;
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newProjectName, address: newProjectAddress })
    });
    const data = await res.json();
    setShowNewProjectModal(false);
    setNewProjectName('');
    setNewProjectAddress('');
    fetchData();
  };

  const handleNewRequest = async (title: string, description: string) => {
    if (!currentProject) return;
    await fetch('/api/requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        project_id: currentProject.id,
        title, 
        description, 
        foreman_id: 'foreman-1' 
      })
    });
    fetchRequests();
  };

  const handleApproveRequest = async (id: number) => {
    await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' })
    });
    fetchRequests();
  };

  const handleRejectRequest = async (id: number) => {
    try {
      await fetch(`/api/requests/${id}`, {
        method: 'DELETE'
      });
      fetchRequests();
    } catch (e) {
      console.error(e);
    }
  };

  const handleApproveOffer = async (offerId: number, requestId: number) => {
    try {
      await fetch(`/api/procurement/${offerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' })
      });

      await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'payment_pending' })
      });

      fetchRequests();
      alert("Предложение утверждено и отправлено в бухгалтерию на оплату!");
    } catch (e) {
      console.error(e);
      alert("Ошибка при утверждении предложения.");
    }
  };

  const handleProcessPayment = async (requestId: number) => {
    try {
      const res = await fetch(`/api/procurement/${requestId}`);
      if (!res.ok) throw new Error("Failed to fetch offers");
      const offers = await res.json();
      const offer = offers.find((o: any) => o.status === 'approved');
      if (!offer) throw new Error("Approved offer not found");

      const request = requests.find(r => r.id === requestId);

      // Call accountant agent to generate transaction details
      const actionDesc = `Оплата поставщику ${offer.supplier_name} за ${offer.details} (Проект: ${currentProject?.name})`;
      const accountingDetails = await accountantAgent('Оплата поставщику', offer.price, actionDesc);

      await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type: 'expense', 
          amount: offer.price, 
          description: accountingDetails 
        })
      });

      await fetch(`/api/requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'purchased' })
      });

      // Автоматическое добавление приобретенного материала на склад
      const itemName = offer.details || request?.title || 'Материал';

      await fetch('/api/inventory/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          item_name: itemName,
          quantity: 1, // По умолчанию 1 ед., кладовщик может обновить позже
          unit: 'шт'
        })
      });

      fetchData();
      fetchRequests();
      alert("Оплата проведена успешно!");
    } catch (e) {
      console.error(e);
      alert("Ошибка при обработке оплаты.");
    }
  };

  const handleAddItem = async (name: string, quantity: number, unit: string) => {
    await fetch('/api/inventory/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_name: name,
        quantity,
        unit
      })
    });
    const inv = await fetch('/api/inventory').then(res => res.json());
    setInventory(inv);
  };

  const navItems = [
    { id: 'director', label: 'Директор', icon: UserCircle },
    { id: 'foreman', label: 'Прораб', icon: HardHat },
    { id: 'procurement', label: 'Снабжение', icon: ShoppingBag },
    { id: 'accountant', label: 'Бухгалтер', icon: Calculator },
    { id: 'storekeeper', label: 'Склад', icon: Warehouse },
  ];

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 font-sans">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <LayoutDashboard className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">SOLTO</h1>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 p-6 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between mb-10 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">SOLTO</h1>
          </div>
          <button 
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-6 px-2">
          <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 block">Объект</label>
          <div className="space-y-2">
            <select 
              className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:outline-none"
              value={currentProject?.id || ''}
              onChange={(e) => setCurrentProject(projects.find(p => p.id === Number(e.target.value)) || null)}
            >
              <option value="">Выберите объект</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <button 
              onClick={() => setShowNewProjectModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-3 h-3" /> Добавить объект
            </button>
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setRole(item.id as UserRole);
                setMobileMenuOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                role === item.id 
                ? 'bg-black text-white shadow-lg shadow-black/10' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-6 left-6 right-6 space-y-4">
          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
            <h5 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Статус потока</h5>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500">Новые заявки</span>
                <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                  {requests.filter(r => r.status === 'pending').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500">В снабжении</span>
                <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                  {requests.filter(r => r.status === 'approved' || r.status === 'procurement').length}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-gray-500">Завершено</span>
                <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                  {requests.filter(r => r.status === 'purchased' || r.status === 'delivered').length}
                </span>
              </div>
            </div>
          </div>

          <div className="px-2 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">ИИ Агенты Активны</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Supabase Connected</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="lg:ml-64 p-4 lg:p-8">
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 lg:mb-10">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">
              {navItems.find(n => n.id === role)?.label}
            </h2>
            <p className="text-sm lg:text-base text-gray-500 mt-1">Управление строительными процессами в реальном времени</p>
          </div>
          <div className="flex items-center gap-4 self-start sm:self-auto">
            <div className="text-left sm:text-right">
              <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase tracking-widest">Проект</p>
              <p className="font-bold text-sm lg:text-base">{currentProject?.name || 'Не выбран'}</p>
            </div>
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gray-200 rounded-full shrink-0" />
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={role}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {role === 'foreman' && <ForemanView requests={requests} onNewRequest={handleNewRequest} currentProjectId={currentProject?.id || null} />}
            {role === 'director' && <DirectorView projects={projects} requests={requests} onApproveRequest={handleApproveRequest} onRejectRequest={handleRejectRequest} onApproveOffer={handleApproveOffer} onRefresh={fetchRequests} currentProjectId={currentProject?.id || null} />}
            {role === 'procurement' && <ProcurementView requests={requests} onSearch={fetchRequests} projectAddress={currentProject?.address || 'Кыргызстан'} />}
            {role === 'accountant' && <AccountantView transactions={transactions} requests={requests} onProcessPayment={handleProcessPayment} />}
            {role === 'storekeeper' && <StorekeeperView inventory={inventory} onAddItem={handleAddItem} />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto flex flex-col"
          >
            <h3 className="text-xl font-bold mb-6">Новый объект строительства</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Название</label>
                <input 
                  type="text" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5"
                  placeholder="Например: ЖК Ала-Тоо Сити"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Адрес</label>
                <input 
                  type="text" 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5"
                  placeholder="г. Бишкек, ул. ..."
                  value={newProjectAddress}
                  onChange={(e) => setNewProjectAddress(e.target.value)}
                />
              </div>
              <div className="flex gap-3 mt-8">
                <button 
                  onClick={() => setShowNewProjectModal(false)}
                  className="flex-1 py-3 border border-gray-200 rounded-2xl font-medium hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleNewProject}
                  className="flex-1 py-3 bg-black text-white rounded-2xl font-medium hover:bg-gray-800 transition-colors"
                >
                  Создать
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
