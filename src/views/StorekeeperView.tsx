import React, { useState } from 'react';
import { Package, Plus, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { InventoryItem } from '../types';
import { Card } from '../components/ui/Card';

export const StorekeeperView = ({ inventory, onAddItem }: { inventory: InventoryItem[], onAddItem: (name: string, quantity: number, unit: string) => Promise<void> }) => {
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
