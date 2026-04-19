import React, { useState, useEffect } from 'react';
import { HardHat, Paperclip, X, ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Request } from '../types';
import { foremanAgent, snipSearchAgent } from '../services/api';
import { SNIP_SUGGESTIONS } from '../constants';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ExpandableText } from '../components/ui/ExpandableText';
import { FileUploadModal } from '../components/FileUploadModal';

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

const UNITS = ['шт', 'м²', 'м³', 'мп', 'кг', 'тонн', 'комплект', 'рулон', 'паллет', 'услуга'];

export const ForemanView = ({ requests, onNewRequest, currentProjectId }: { requests: Request[], onNewRequest: (title: string, desc: string, qty: number, unit: string) => void, currentProjectId: number | null }) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('шт');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<{title: string, description: string}[]>([]);
  const [searchingSnips, setSearchingSnips] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  // Cache for AI search results to avoid repeated API calls
  const aiCacheRef = React.useRef<Record<string, {title: string, description: string}[]>>({});
  const abortRef = React.useRef<AbortController | null>(null);
  const justSelectedRef = React.useRef(false);

  // Phase 1: INSTANT local search (0ms delay)
  useEffect(() => {
    // Skip reopening suggestions if user just selected one
    if (justSelectedRef.current) {
      justSelectedRef.current = false;
      return;
    }
    if (title.length > 1) {
      const q = title.toLowerCase();
      const words = q.split(/\s+/).filter(w => w.length > 1);
      const localResults = SNIP_SUGGESTIONS.filter(s => {
        const haystack = (s.title + ' ' + s.description).toLowerCase();
        return words.every(w => haystack.includes(w)) || words.some(w => s.title.toLowerCase().includes(w));
      }).slice(0, 8);
      setAiSuggestions(localResults);
      if (localResults.length > 0) setShowSuggestions(true);
    } else {
      setAiSuggestions([]);
      setShowSuggestions(false);
    }
  }, [title]);

  // Phase 2: AI search ONLY if local results < 3 (3s delay, with abort + cache)
  useEffect(() => {
    if (title.length < 3) return;

    const timer = setTimeout(async () => {
      // Check if local already has enough results
      const q = title.toLowerCase();
      const words = q.split(/\s+/).filter(w => w.length > 1);
      const localCount = SNIP_SUGGESTIONS.filter(s => {
        const haystack = (s.title + ' ' + s.description).toLowerCase();
        return words.every(w => haystack.includes(w)) || words.some(w => s.title.toLowerCase().includes(w));
      }).length;
      
      if (localCount >= 3) return; // Enough local results, skip AI

      // Check cache first
      const cacheKey = title.trim().toLowerCase();
      if (aiCacheRef.current[cacheKey]) {
        const cached = aiCacheRef.current[cacheKey];
        setAiSuggestions(prev => {
          const combined = [...prev, ...cached];
          return Array.from(new Map(combined.map(item => [item.title, item])).values());
        });
        return;
      }

      // Abort previous request
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      setSearchingSnips(true);
      try {
        const results = await snipSearchAgent(title);
        if (Array.isArray(results) && results.length > 0) {
          aiCacheRef.current[cacheKey] = results;
          setAiSuggestions(prev => {
            const combined = [...prev, ...results];
            return Array.from(new Map(combined.map(item => [item.title, item])).values());
          });
          setShowSuggestions(true);
        }
      } catch (e: any) {
        if (e?.name !== 'AbortError') console.error('AI SNIP search error:', e);
      } finally {
        setSearchingSnips(false);
      }
    }, 3000);

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
      onNewRequest(result.title, result.description, quantity, unit);
      setTitle(''); setDescription(''); setQuantity(1); setUnit('шт');
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
    onNewRequest(title, description, quantity, unit);
    setTitle(''); setDescription(''); setQuantity(1); setUnit('шт');
    setShowSuggestions(false);
  };

  const useSuggestion = (suggestion: {title: string, description: string}) => {
    justSelectedRef.current = true;
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

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Количество</label>
                <input 
                  type="number" 
                  min="0.01" 
                  step="0.01"
                  placeholder="1"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5 font-mono"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(0.01, parseFloat(e.target.value) || 1))}
                />
              </div>
              <div className="w-40">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Единица</label>
                <select 
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                >
                  {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>
            
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
