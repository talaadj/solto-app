import React, { useState, useEffect } from 'react';
import { Calculator, Download } from 'lucide-react';
import { Request, Transaction, ProcurementOffer } from '../types';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { ExpandableText } from '../components/ui/ExpandableText';
import { api } from '../services/api';

export const AccountantView = ({ transactions, requests, onProcessPayment }: { transactions: Transaction[], requests: Request[], onProcessPayment: (requestId: number) => void }) => {
  const pendingPayments = requests.filter(r => r.status === 'payment_pending');
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [offersMap, setOffersMap] = useState<Record<number, ProcurementOffer[]>>({});

  // Load offers for pending payments to show full details
  useEffect(() => {
    const loadOffers = async () => {
      const newMap: Record<number, ProcurementOffer[]> = {};
      for (const req of pendingPayments) {
        try {
          const offers = await api.getOffers(req.id);
          newMap[req.id] = offers;
        } catch {}
      }
      setOffersMap(newMap);
    };
    if (pendingPayments.length > 0) loadOffers();
  }, [requests]);

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
          <h3 className="font-semibold text-gray-500 uppercase text-xs tracking-widest">Ожидают проведения в 1С ({pendingPayments.length})</h3>
          {pendingPayments.map(req => {
            const approvedOffer = (offersMap[req.id] || []).find(o => o.status === 'approved');
            return (
              <Card key={req.id} className="border-l-4 border-l-indigo-500 bg-indigo-50/30 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h4 className="font-bold">{req.title}</h4>
                      <Badge color="bg-indigo-100 text-indigo-700">Одобрено директором</Badge>
                    </div>
                    <ExpandableText text={req.description} className="text-sm text-gray-600 whitespace-pre-wrap" />
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span>📦 {req.quantity || 1} {req.unit || 'шт'}</span>
                    </div>
                  </div>
                </div>

                {approvedOffer && (
                  <div className="bg-white rounded-xl border border-indigo-100 p-4 space-y-3">
                    <div className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Данные поставщика</div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Компания</span>
                        <span className="font-bold text-gray-800">{approvedOffer.supplier_name}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Телефон</span>
                        <span className="text-gray-700">{approvedOffer.supplier_phone}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Email</span>
                        <span className="text-gray-700">{approvedOffer.supplier_email}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Адрес</span>
                        <span className="text-gray-700">{approvedOffer.supplier_address}</span>
                      </div>
                    </div>

                    <div className="border-t border-indigo-100 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Количество</span>
                        <span className="font-mono font-bold text-indigo-700 text-lg">{approvedOffer.approved_quantity || req.quantity || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Сумма</span>
                        <span className="font-mono font-bold text-indigo-700 text-lg">{(approvedOffer.approved_amount || 0).toLocaleString()} сом</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Способ оплаты</span>
                        <span className="font-bold text-gray-700">{approvedOffer.payment_method || 'Не указан'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-400 uppercase font-bold block">Комментарий</span>
                        <span className="text-gray-600 text-xs">{approvedOffer.payment_notes || '—'}</span>
                      </div>
                    </div>
                  </div>
                )}

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
                    `Провести оплату ${approvedOffer?.approved_amount ? `(${approvedOffer.approved_amount.toLocaleString()} сом)` : ''}`
                  )}
                </button>
              </Card>
            );
          })}
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
