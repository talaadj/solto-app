import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, Check, X, Search, Clock, MapPin, Phone, Mail, 
  ExternalLink, AlertTriangle, Star, StarHalf, CheckSquare, Square 
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Request, ProcurementOffer, Project } from '../types';
import { api } from '../services/api';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ExpandableText } from '../components/ui/ExpandableText';

export const DirectorView = ({ projects, requests, onApproveRequest, onRejectRequest, onApproveOffer, onRefresh, currentProjectId }: { 
  projects: Project[],
  requests: Request[], 
  onApproveRequest: (id: number) => void,
  onRejectRequest: (id: number) => void,
  onApproveOffer: (id: number, requestId: number, paymentData: { approved_quantity: number; approved_amount: number; payment_method: string; payment_notes: string }) => Promise<void>,
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

  // Payment modal state
  const [paymentModal, setPaymentModal] = useState<{ offerId: number; requestId: number; offer: ProcurementOffer; request: Request } | null>(null);
  const [payQuantity, setPayQuantity] = useState(1);
  const [payAmount, setPayAmount] = useState(0);
  const [payMethod, setPayMethod] = useState('Банковский перевод');
  const [payNotes, setPayNotes] = useState('');

  const openPaymentModal = (offerId: number, requestId: number, offer: ProcurementOffer, request: Request) => {
    const qty = request.quantity || 1;
    const unitPrice = Number(offer.price) || 0;
    setPayQuantity(qty);
    setPayAmount(unitPrice * qty);
    setPayMethod('Банковский перевод');
    setPayNotes('');
    setPaymentModal({ offerId, requestId, offer, request });
  };

  const handlePaymentSubmit = async () => {
    if (!paymentModal) return;
    setApprovingOffer(paymentModal.offerId);
    try {
      await onApproveOffer(paymentModal.offerId, paymentModal.requestId, {
        approved_quantity: payQuantity,
        approved_amount: payAmount,
        payment_method: payMethod,
        payment_notes: payNotes,
      });
      setPaymentModal(null);
    } finally {
      setApprovingOffer(null);
    }
  };

  const handleApprove = async (offerId: number, requestId: number) => {
    setApprovingOffer(offerId);
    try {
      await onApproveOffer(offerId, requestId, { approved_quantity: 1, approved_amount: 0, payment_method: 'Не указан', payment_notes: '' });
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
        const data = await api.getOffers(r.id);
        newOffers[r.id] = data;
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
                            const r = Number(offer.rating) || 0;
                            if (r >= ratingValue) {
                              return <Star key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />;
                            } else if (r >= ratingValue - 0.5) {
                              return <StarHalf key={i} className="w-3 h-3 fill-yellow-400 text-yellow-400" />;
                            } else {
                              return <Star key={i} className="w-3 h-3 text-gray-300" />;
                            }
                          })}
                          <span className="text-[10px] font-bold text-gray-500 ml-1">{(Number(offer.rating) || 0).toFixed(1)}</span>
                        </div>
                        {offer.supplier_address && (
                          <div className="flex items-start gap-1 mt-1.5 text-[10px] text-gray-500" title={offer.supplier_address}>
                            <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                            <span className="line-clamp-2 leading-tight">{offer.supplier_address}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-indigo-600 font-mono font-black text-sm">{typeof offer.price === 'number' ? offer.price.toLocaleString() : (offer.price || 'Цена не указана')}</div>
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
                        onClick={() => openPaymentModal(offer.id, req.id, offer, req)}
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
                          'ОФОРМИТЬ ОПЛАТУ'
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
                      <div key={i} className={`w-3 h-3 rounded-full ${i < Math.floor(Number(selectedOffer.rating) || 0) ? 'bg-yellow-400' : 'bg-gray-200'}`} />
                    ))}
                    <span className="text-xs font-bold text-gray-500 ml-2">{(Number(selectedOffer.rating) || 0).toFixed(1)} / 5.0</span>
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
                      <div className="bg-white p-2 rounded-lg shadow-sm"><MapPin className="w-4 h-4 text-indigo-600" /></div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Адрес</div>
                        <div className="text-sm font-medium text-gray-900">{selectedOffer.supplier_address}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-white p-2 rounded-lg shadow-sm"><Phone className="w-4 h-4 text-indigo-600" /></div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Телефон</div>
                        <div className="text-sm font-medium text-gray-900">{selectedOffer.supplier_phone}</div>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="bg-white p-2 rounded-lg shadow-sm"><Mail className="w-4 h-4 text-indigo-600" /></div>
                      <div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Email</div>
                        <div className="text-sm font-medium text-gray-900">{selectedOffer.supplier_email}</div>
                      </div>
                    </div>
                    {selectedOffer.source_url && (
                      <div className="flex items-start gap-3">
                        <div className="bg-white p-2 rounded-lg shadow-sm"><ExternalLink className="w-4 h-4 text-indigo-600" /></div>
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
                    <span className="text-lg font-black text-indigo-700 font-mono">{typeof selectedOffer.price === 'number' ? selectedOffer.price.toLocaleString() : (selectedOffer.price || 'Не указана')} сом</span>
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
      {/* Payment Modal */}
      <AnimatePresence>
        {paymentModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
                <h3 className="text-lg font-black">💰 Оформление оплаты</h3>
                <p className="text-sm text-white/80 mt-1">{paymentModal.offer.supplier_name}</p>
              </div>

              <div className="p-6 space-y-4">
                {/* Supplier info */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                  <div className="text-[10px] font-bold text-gray-400 uppercase">Поставщик</div>
                  <div className="text-sm font-bold text-gray-800">{paymentModal.offer.supplier_name}</div>
                  <div className="text-xs text-gray-500">{paymentModal.offer.supplier_phone} • {paymentModal.offer.supplier_email}</div>
                  <div className="text-xs text-gray-500">{paymentModal.offer.supplier_address}</div>
                </div>

                {/* Quantity + Unit price */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                      Количество ({paymentModal.request.unit || 'шт'})
                    </label>
                    <input 
                      type="number" min="0.01" step="0.01"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono text-lg"
                      value={payQuantity}
                      onChange={(e) => {
                        const q = Math.max(0.01, parseFloat(e.target.value) || 1);
                        setPayQuantity(q);
                        setPayAmount(q * (Number(paymentModal.offer.price) || 0));
                      }}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Цена за ед.</label>
                    <div className="w-full bg-gray-100 border border-gray-200 rounded-xl px-4 py-2.5 font-mono text-lg text-gray-500">
                      {(Number(paymentModal.offer.price) || 0).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Total amount */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Итого к оплате (сом)</label>
                  <input 
                    type="number" min="0" step="1"
                    className="w-full bg-indigo-50 border-2 border-indigo-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono text-2xl font-black text-indigo-700"
                    value={payAmount}
                    onChange={(e) => setPayAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </div>

                {/* Payment method */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Способ оплаты</label>
                  <select 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                    value={payMethod}
                    onChange={(e) => setPayMethod(e.target.value)}
                  >
                    <option>Банковский перевод</option>
                    <option>Наличные</option>
                    <option>Мбанк / О!Деньги</option>
                    <option>Международный перевод (SWIFT)</option>
                    <option>Бартер</option>
                    <option>Отсрочка платежа</option>
                  </select>
                </div>

                {/* Notes */}
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Комментарий / реквизиты</label>
                  <textarea 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 min-h-[60px] resize-y text-sm"
                    placeholder="Номер счёта, банковские реквизиты, условия..."
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setPaymentModal(null)} 
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button 
                  onClick={handlePaymentSubmit}
                  disabled={payAmount <= 0 || approvingOffer === paymentModal.offerId}
                  className="flex-1 py-3 rounded-xl text-sm font-black bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {approvingOffer === paymentModal.offerId ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Обработка...
                    </>
                  ) : (
                    `Подтвердить ${payAmount.toLocaleString()} сом`
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
