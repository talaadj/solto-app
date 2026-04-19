import React, { useState } from 'react';
import { Search, ShoppingBag, Zap } from 'lucide-react';
import { Request } from '../types';
import { procurementAgent } from '../services/api';
import { api } from '../services/api';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ExpandableText } from '../components/ui/ExpandableText';

export const ProcurementView = ({ requests, onSearch, projectAddress }: { requests: Request[], onSearch: (req: Request) => void, projectAddress: string }) => {
  const [searching, setSearching] = useState<number | null>(null);

  const handleSearch = async (req: Request) => {
    setSearching(req.id);
    try {
      const result = await procurementAgent(req.title, req.description, projectAddress);
      
      // Ensure offers is always an array (handle {offers: [...]} or [...] or other)
      const offers = Array.isArray(result) ? result : 
                     Array.isArray(result?.offers) ? result.offers : [];
      
      if (offers.length === 0) {
        alert("ИИ не смог найти подходящих предложений. Попробуйте уточнить техзадание или повторить поиск позже.");
        return;
      }

      for (const offer of offers) {
        await api.createOffer({ ...offer, request_id: req.id });
      }
      await api.updateRequestStatus(req.id, 'procurement');
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
