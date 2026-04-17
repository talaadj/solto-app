import React, { useState, useEffect } from 'react';
import { 
  User, Building2, Copy, Check, Edit3, Save, X, Share2, 
  Shield, BookOpen, Mail, Phone, MapPin, ChevronRight, 
  LogOut, HelpCircle, FileText, Key, Users
} from 'lucide-react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

interface Company {
  id: number;
  name: string;
  invite_code: string;
  owner_id: string;
  created_at: string;
}

interface ProfileViewProps {
  profile: {
    user_id: string;
    email: string;
    full_name: string;
    role: string;
    is_owner: number;
    company_id: number | null;
  };
  onProfileUpdate: (profile: any) => void;
}

const ROLE_LABELS: Record<string, string> = {
  director: 'Директор',
  foreman: 'Прораб',
  procurement: 'Снабженец',
  accountant: 'Бухгалтер',
  storekeeper: 'Кладовщик',
  viewer: 'Наблюдатель',
};

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-rose-500', 'bg-emerald-500', 'bg-amber-500',
  'bg-violet-500', 'bg-cyan-500', 'bg-pink-500', 'bg-teal-500',
];

function getAvatarColor(name: string): string {
  const hash = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string, email: string): string {
  if (name && name.trim()) {
    const parts = name.trim().split(' ');
    return parts.length > 1 
      ? (parts[0][0] + parts[1][0]).toUpperCase()
      : parts[0].substring(0, 2).toUpperCase();
  }
  return email ? email.charAt(0).toUpperCase() : '?';
}

export default function ProfileView({ profile, onProfileUpdate }: ProfileViewProps) {
  const { user, signOut } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(profile?.full_name || '');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editingCompany, setEditingCompany] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [teamCount, setTeamCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showDocs, setShowDocs] = useState(false);

  useEffect(() => {
    loadCompany();
    if (profile?.role === 'director') loadTeamCount();
  }, []);

  const loadCompany = async () => {
    try {
      const c = await api.getCompany();
      if (c) {
        setCompany(c);
        setEditCompanyName(c.name);
      }
    } catch { /* ignore */ }
  };

  const loadTeamCount = async () => {
    try {
      const team = await api.getTeam();
      setTeamCount(Array.isArray(team) ? team.length : 0);
    } catch { setTeamCount(0); }
  };

  const handleSaveName = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      const updated = await api.updateProfile({ full_name: editName.trim() });
      onProfileUpdate(updated);
      setEditing(false);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleCopyCode = () => {
    if (!company?.invite_code) return;
    navigator.clipboard.writeText(company.invite_code).catch(() => {
      // Fallback for mobile
      const ta = document.createElement('textarea');
      ta.value = company.invite_code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleShareCode = async () => {
    if (!company) return;
    const text = `Присоединяйся к компании "${company.name}" в SOLTO!\n\nКод приглашения: ${company.invite_code}\n\n1. Скачай приложение SOLTO\n2. Зарегистрируйся\n3. Нажми "Присоединиться по коду"\n4. Введи код: ${company.invite_code}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'SOLTO — Код приглашения', text });
      } catch { /* cancelled */ }
    } else {
      handleCopyCode();
    }
  };

  const initials = getInitials(profile?.full_name || '', user?.email || '');
  const avatarColor = getAvatarColor(profile?.full_name || user?.email || '');
  const isOwner = profile?.is_owner === 1 || profile?.is_owner === true as any;

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Avatar & Name Card */}
      <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-16 h-16 ${avatarColor} rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            {!editing ? (
              <>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-gray-900 truncate">
                    {profile?.full_name || 'Без имени'}
                  </h2>
                  <button onClick={() => { setEditing(true); setEditName(profile?.full_name || ''); }} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                    <Edit3 size={14} className="text-gray-400" />
                  </button>
                </div>
                <p className="text-sm text-gray-400 truncate">{user?.email}</p>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                  placeholder="Ваше имя"
                />
                <button onClick={handleSaveName} disabled={saving} className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  <Save size={14} />
                </button>
                <button onClick={() => setEditing(false)} className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Role & Status */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold">
            <Shield size={12} />
            {ROLE_LABELS[profile?.role] || profile?.role}
          </span>
          {isOwner && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-bold">
              <Key size={10} /> Владелец
            </span>
          )}
        </div>
      </div>

      {/* Company Card */}
      {company && (
        <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-gray-700" />
              <h3 className="font-bold text-gray-900">Компания</h3>
            </div>
            {isOwner && !editingCompany && (
              <button onClick={() => setEditingCompany(true)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <Edit3 size={14} className="text-gray-400" />
              </button>
            )}
          </div>

          {!editingCompany ? (
            <p className="text-base font-medium text-gray-800 mb-4">{company.name}</p>
          ) : (
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                value={editCompanyName}
                onChange={e => setEditCompanyName(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                autoFocus
              />
              <button onClick={() => setEditingCompany(false)} className="p-1.5 bg-indigo-600 text-white rounded-lg"><Save size={14} /></button>
              <button onClick={() => { setEditingCompany(false); setEditCompanyName(company.name); }} className="p-1.5 bg-gray-100 rounded-lg"><X size={14} /></button>
            </div>
          )}

          {/* Team info */}
          {profile?.role === 'director' && (
            <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
              <Users size={14} />
              <span>{teamCount} {teamCount === 1 ? 'участник' : teamCount < 5 ? 'участника' : 'участников'}</span>
            </div>
          )}

          {/* Invite Code */}
          <div className="bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl p-4 border border-indigo-100">
            <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Код приглашения</p>
            <div className="flex items-center gap-3">
              <code className="flex-1 text-2xl font-mono font-bold text-indigo-700 tracking-[0.3em] text-center py-2">
                {company.invite_code}
              </code>
              <div className="flex flex-col gap-1">
                <button 
                  onClick={handleCopyCode}
                  className={`p-2 rounded-lg transition-all ${codeCopied ? 'bg-green-100 text-green-600' : 'bg-white text-gray-500 hover:bg-gray-100'} border border-gray-200`}
                >
                  {codeCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <button 
                  onClick={handleShareCode}
                  className="p-2 bg-white text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                >
                  <Share2 size={16} />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-indigo-400 mt-2">
              Отправьте этот код сотрудникам для подключения
            </p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <button 
          onClick={() => setShowDocs(!showDocs)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
              <BookOpen size={18} className="text-blue-600" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-800">Документация</p>
              <p className="text-[10px] text-gray-400">Как пользоваться приложением</p>
            </div>
          </div>
          <ChevronRight size={16} className={`text-gray-300 transition-transform ${showDocs ? 'rotate-90' : ''}`} />
        </button>

        {showDocs && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <div className="mt-3 space-y-3 text-xs text-gray-600">
              <div className="p-3 bg-gray-50 rounded-xl">
                <h4 className="font-bold text-gray-800 mb-1">🏗️ Директор</h4>
                <p>Управление объектами, одобрение заявок, контроль финансов, управление командой</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <h4 className="font-bold text-gray-800 mb-1">👷 Прораб</h4>
                <p>Создание заявок на материалы с указанием количества и единиц измерения</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <h4 className="font-bold text-gray-800 mb-1">🛒 Снабженец</h4>
                <p>ИИ поиск поставщиков, сравнение цен, формирование предложений</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <h4 className="font-bold text-gray-800 mb-1">💰 Бухгалтер</h4>
                <p>Проведение оплат, учёт расходов и доходов, финансовые отчёты</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <h4 className="font-bold text-gray-800 mb-1">📦 Кладовщик</h4>
                <p>Учёт материалов на складе, приём и выдача</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <h4 className="font-bold text-gray-800 mb-1">👥 Приглашение команды</h4>
                <p>Директор отправляет код приглашения → сотрудник скачивает SOLTO → вводит код → попадает в команду</p>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-gray-100" />

        <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
              <FileText size={18} className="text-gray-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-800">Версия</p>
              <p className="text-[10px] text-gray-400">SOLTO v2.0.0</p>
            </div>
          </div>
        </button>

        <div className="border-t border-gray-100" />

        <button 
          onClick={signOut}
          className="w-full flex items-center gap-3 p-4 hover:bg-red-50 transition-colors text-red-600"
        >
          <div className="w-9 h-9 bg-red-50 rounded-xl flex items-center justify-center">
            <LogOut size={18} />
          </div>
          <p className="text-sm font-bold">Выйти из аккаунта</p>
        </button>
      </div>
    </div>
  );
}
