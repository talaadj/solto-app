import React, { useState, useEffect } from 'react';
import { Package, Plus, X, ArrowDownRight, ClipboardList, FileDown, History } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { InventoryItem } from '../types';
import { Card } from '../components/ui/Card';
import { api } from '../services/api';

interface InventoryIssue {
  id: number;
  inventory_item_id: number;
  issued_to: string;
  quantity: number;
  notes: string;
  issued_at: string;
  inventory?: { item_name: string; unit: string };
}

export const StorekeeperView = ({ inventory, onAddItem, onRefresh }: { 
  inventory: InventoryItem[], 
  onAddItem: (name: string, quantity: number, unit: string) => Promise<void>,
  onRefresh: () => void
}) => {
  const [showModal, setShowModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState<InventoryItem | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState<InventoryItem | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [loading, setLoading] = useState(false);

  // Issue state
  const [issueTo, setIssueTo] = useState('');
  const [issueQty, setIssueQty] = useState('');
  const [issueNotes, setIssueNotes] = useState('');
  const [issuing, setIssuing] = useState(false);

  // History state
  const [history, setHistory] = useState<InventoryIssue[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // All issues for PDF
  const [allIssues, setAllIssues] = useState<InventoryIssue[]>([]);

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

  const handleIssue = async () => {
    if (!showIssueModal || !issueTo || !issueQty) return;
    const qty = parseFloat(issueQty);
    if (qty <= 0) return alert('Количество должно быть больше 0');
    if (qty > showIssueModal.quantity) return alert(`Недостаточно на складе. Остаток: ${showIssueModal.quantity} ${showIssueModal.unit}`);

    setIssuing(true);
    try {
      const result = await api.issueFromInventory(showIssueModal.id, issueTo, qty, issueNotes);
      if (result.error) {
        alert(result.error);
      } else {
        setShowIssueModal(null);
        setIssueTo('');
        setIssueQty('');
        setIssueNotes('');
        onRefresh();
        alert('Товар выдан со склада!');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Ошибка при выдаче');
    } finally {
      setIssuing(false);
    }
  };

  const openHistory = async (item: InventoryItem) => {
    setShowHistoryModal(item);
    setLoadingHistory(true);
    try {
      const data = await api.getInventoryIssues(item.id);
      setHistory(data);
    } catch (e) {
      console.error(e);
      setHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  const downloadPDF = async () => {
    try {
      const issues = await api.getAllIssues();
      
      // Generate PDF as HTML table that can be printed
      const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Складской отчёт - Выдача ТМЦ</title>
<style>
  body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
  h1 { text-align: center; font-size: 18px; margin-bottom: 5px; }
  h2 { text-align: center; font-size: 14px; color: #666; margin-bottom: 20px; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th, td { border: 1px solid #333; padding: 6px 8px; text-align: left; }
  th { background: #f0f0f0; font-weight: bold; font-size: 11px; text-transform: uppercase; }
  .sign-area { margin-top: 40px; display: flex; justify-content: space-between; }
  .sign-box { text-align: center; width: 200px; }
  .sign-line { border-top: 1px solid #000; margin-top: 40px; padding-top: 5px; }
  @media print { body { padding: 0; } }
</style>
</head><body>
<h1>АКТ ВЫДАЧИ ТМЦ СО СКЛАДА</h1>
<h2>Дата формирования: ${new Date().toLocaleDateString('ru-RU')}</h2>
<table>
<thead><tr>
  <th>№</th><th>Наименование</th><th>Ед.изм.</th><th>Кол-во</th><th>Получатель</th><th>Примечание</th><th>Дата выдачи</th>
</tr></thead>
<tbody>
${issues.map((issue: InventoryIssue, idx: number) => `<tr>
  <td>${idx + 1}</td>
  <td>${issue.inventory?.item_name || '—'}</td>
  <td>${issue.inventory?.unit || 'шт'}</td>
  <td>${issue.quantity}</td>
  <td>${issue.issued_to}</td>
  <td>${issue.notes || '—'}</td>
  <td>${new Date(issue.issued_at).toLocaleDateString('ru-RU')} ${new Date(issue.issued_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</td>
</tr>`).join('')}
</tbody>
</table>
<p style="margin-top: 15px; font-weight: bold;">Итого выдано позиций: ${issues.length}</p>
<div class="sign-area">
  <div class="sign-box"><div class="sign-line">Зав. складом</div></div>
  <div class="sign-box"><div class="sign-line">Получатель</div></div>
</div>
</body></html>`;

      const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `warehouse_report_${new Date().toISOString().split('T')[0]}.html`;
      link.click();
      URL.revokeObjectURL(link.href);
      alert('Отчёт скачан! Откройте файл и нажмите Ctrl+P для печати в PDF.');
    } catch (e) {
      console.error(e);
      alert('Ошибка при формировании отчёта');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <h2 className="text-2xl font-bold">Складской Учет</h2>
        <button 
          onClick={downloadPDF}
          className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-indigo-50 px-4 py-2 rounded-xl border border-indigo-100 self-start sm:self-auto"
        >
          <FileDown className="w-4 h-4" /> Скачать отчёт выдачи
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {inventory.map(item => (
          <Card key={item.id} id={item.id} className="flex flex-col items-center text-center relative">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
            <h4 className="font-bold mb-1">{item.item_name}</h4>
            <div className="text-2xl font-mono font-bold text-indigo-600">
              {item.quantity} <span className="text-sm text-gray-400 font-normal">{item.unit}</span>
            </div>
            {item.quantity <= 0 && (
              <div className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-md mt-1">ПУСТО</div>
            )}
            <div className="flex gap-2 mt-4 w-full">
              <button 
                onClick={() => {
                  setShowIssueModal(item);
                  setIssueTo('');
                  setIssueQty('');
                  setIssueNotes('');
                }}
                disabled={item.quantity <= 0}
                className="flex-1 py-2 bg-orange-50 text-orange-600 rounded-xl text-xs font-bold hover:bg-orange-100 transition-colors flex items-center justify-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed border border-orange-100"
              >
                <ArrowDownRight className="w-3 h-3" /> Выдать
              </button>
              <button 
                onClick={() => openHistory(item)}
                className="flex-1 py-2 bg-gray-50 text-gray-600 rounded-xl text-xs font-bold hover:bg-gray-100 transition-colors flex items-center justify-center gap-1 border border-gray-100"
              >
                <History className="w-3 h-3" /> История
              </button>
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

      {/* Add Item Modal */}
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
                      type="text" inputMode="numeric"
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-black/5"
                      placeholder="0"
                      value={newItemQuantity}
                      onChange={(e) => setNewItemQuantity(e.target.value.replace(/[^0-9.]/g, '').replace(/^0+(?=\d)/, ''))}
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

      {/* Issue Modal */}
      <AnimatePresence>
        {showIssueModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-6 text-white">
                <h3 className="text-lg font-black flex items-center gap-2">
                  <ArrowDownRight className="w-5 h-5" /> Выдача со склада
                </h3>
                <p className="text-sm text-white/80 mt-1">{showIssueModal.item_name}</p>
                <p className="text-xs text-white/60 mt-0.5">На складе: {showIssueModal.quantity} {showIssueModal.unit}</p>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Кому выдать</label>
                  <input 
                    type="text"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
                    placeholder="ФИО или бригада/участок"
                    value={issueTo}
                    onChange={(e) => setIssueTo(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                    Количество ({showIssueModal.unit})
                  </label>
                  <input 
                    type="text" inputMode="numeric"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/30 font-mono text-lg"
                    placeholder="0"
                    value={issueQty}
                    onChange={(e) => setIssueQty(e.target.value.replace(/[^0-9.]/g, '').replace(/^0+(?=\d)/, ''))}
                  />
                  {parseFloat(issueQty) > showIssueModal.quantity && (
                    <p className="text-xs text-red-500 mt-1 font-bold">⚠ Превышает остаток на складе!</p>
                  )}
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Примечание</label>
                  <textarea 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500/30 min-h-[60px] resize-y text-sm"
                    placeholder="Для какого объекта, участка..."
                    value={issueNotes}
                    onChange={(e) => setIssueNotes(e.target.value)}
                  />
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={() => setShowIssueModal(null)} 
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  Отмена
                </button>
                <button 
                  onClick={handleIssue}
                  disabled={issuing || !issueTo || !issueQty || parseFloat(issueQty) <= 0 || parseFloat(issueQty) > showIssueModal.quantity}
                  className="flex-1 py-3 rounded-xl text-sm font-black bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {issuing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Выдача...
                    </>
                  ) : (
                    `Выдать ${issueQty || 0} ${showIssueModal.unit}`
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistoryModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden max-h-[85vh] flex flex-col"
            >
              <div className="bg-gradient-to-r from-gray-800 to-gray-900 p-6 text-white">
                <h3 className="text-lg font-black flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" /> Журнал выдачи
                </h3>
                <p className="text-sm text-white/80 mt-1">{showHistoryModal.item_name}</p>
              </div>

              <div className="p-4 overflow-y-auto flex-1">
                {loadingHistory ? (
                  <div className="py-10 text-center">
                    <div className="w-8 h-8 border-4 border-gray-100 border-t-gray-500 rounded-full animate-spin mx-auto mb-2" />
                    <div className="text-xs text-gray-400">Загрузка...</div>
                  </div>
                ) : history.length === 0 ? (
                  <div className="py-10 text-center border-2 border-dashed border-gray-100 rounded-2xl">
                    <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Нет записей о выдаче</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {history.map((issue) => (
                      <div key={issue.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                        <div className="flex justify-between items-start mb-1">
                          <div className="font-bold text-sm text-gray-800">{issue.issued_to}</div>
                          <div className="text-orange-600 font-mono font-bold text-sm">-{issue.quantity} {showHistoryModal.unit}</div>
                        </div>
                        {issue.notes && (
                          <p className="text-xs text-gray-500 mb-1">{issue.notes}</p>
                        )}
                        <div className="text-[10px] text-gray-400">
                          {new Date(issue.issued_at).toLocaleDateString('ru-RU')} в {new Date(issue.issued_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => setShowHistoryModal(null)} 
                  className="w-full py-3 rounded-xl text-sm font-bold bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
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
