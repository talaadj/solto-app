import React, { useState, useEffect } from 'react';
import { Users, Shield, Trash2, ChevronDown, UserPlus, Crown, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../services/api';
import { Project } from '../types';

interface TeamMember {
  id: number;
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  project_ids: string;
  is_owner: number;
  created_at: string;
}

const ROLE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  director: { label: 'Директор', color: 'bg-purple-100 text-purple-700', icon: '👔' },
  foreman: { label: 'Прораб', color: 'bg-amber-100 text-amber-700', icon: '🏗️' },
  procurement: { label: 'Снабженец', color: 'bg-blue-100 text-blue-700', icon: '🛒' },
  accountant: { label: 'Бухгалтер', color: 'bg-green-100 text-green-700', icon: '📊' },
  storekeeper: { label: 'Кладовщик', color: 'bg-orange-100 text-orange-700', icon: '📦' },
};

interface Props {
  projects: Project[];
}

export function TeamManagementView({ projects }: Props) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadTeam();
  }, []);

  const loadTeam = async () => {
    setLoading(true);
    try {
      const data = await api.getTeam();
      setMembers(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to load team:', e);
    }
    setLoading(false);
  };

  const updateRole = async (userId: string, role: string) => {
    try {
      await api.updateTeamMember(userId, { role });
      setMembers(prev => prev.map(m => m.user_id === userId ? { ...m, role } : m));
      setEditingId(null);
    } catch (e: any) {
      alert(e.message || 'Ошибка');
    }
  };

  const removeMember = async (userId: string, name: string) => {
    if (!confirm(`Удалить ${name} из команды?`)) return;
    try {
      await api.removeTeamMember(userId);
      setMembers(prev => prev.filter(m => m.user_id !== userId));
    } catch (e: any) {
      alert(e.message || 'Ошибка');
    }
  };

  const filtered = members.filter(m =>
    m.email?.toLowerCase().includes(search.toLowerCase()) ||
    m.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users size={28} className="text-indigo-600" />
            Управление командой
          </h2>
          <p className="text-gray-500 mt-1">
            {members.length} {members.length === 1 ? 'участник' : members.length < 5 ? 'участника' : 'участников'}
          </p>
        </div>
      </div>

      {/* Info */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 border border-indigo-100">
        <p className="text-sm text-indigo-700">
          <strong>💡 Как добавить сотрудника:</strong> Попросите сотрудника зарегистрироваться на странице входа SOLTO.
          После регистрации он появится здесь с ролью "Прораб" по умолчанию. Вы можете изменить его роль.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Поиск по имени или email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
        />
      </div>

      {/* Team List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(member => {
            const roleInfo = ROLE_LABELS[member.role] || ROLE_LABELS.foreman;
            return (
              <motion.div
                key={member.user_id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {(member.full_name || member.email)?.[0]?.toUpperCase() || '?'}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {member.full_name || 'Без имени'}
                      </span>
                      {member.is_owner === 1 && (
                        <Crown size={14} className="text-amber-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">{member.email}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Зарегистрирован: {new Date(member.created_at).toLocaleDateString('ru')}
                    </p>
                  </div>

                  {/* Role Badge */}
                  <div className="relative">
                    <button
                      onClick={() => setEditingId(editingId === member.user_id ? null : member.user_id)}
                      disabled={member.is_owner === 1}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium ${roleInfo.color} ${
                        member.is_owner === 1 ? 'cursor-default' : 'hover:opacity-80 cursor-pointer'
                      }`}
                    >
                      <span>{roleInfo.icon}</span>
                      <span>{roleInfo.label}</span>
                      {member.is_owner !== 1 && <ChevronDown size={14} />}
                    </button>

                    {/* Role Dropdown */}
                    <AnimatePresence>
                      {editingId === member.user_id && member.is_owner !== 1 && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute right-0 top-12 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-10 overflow-hidden"
                        >
                          {Object.entries(ROLE_LABELS).map(([key, info]) => (
                            <button
                              key={key}
                              onClick={() => updateRole(member.user_id, key)}
                              className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 ${
                                member.role === key ? 'bg-indigo-50 font-medium' : ''
                              }`}
                            >
                              <span>{info.icon}</span>
                              <span>{info.label}</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Delete */}
                  {member.is_owner !== 1 && (
                    <button
                      onClick={() => removeMember(member.user_id, member.full_name || member.email)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
