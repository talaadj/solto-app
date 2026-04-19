import React, { useState, useEffect } from 'react';
import { 
  User, Building2, Copy, Check, Edit3, Save, X, Share2, 
  Shield, BookOpen, Mail, Phone, MapPin, ChevronRight, ChevronDown,
  LogOut, HelpCircle, FileText, Key, Users, Zap, Search, 
  Calculator, Package, ClipboardList, BarChart3, Calendar,
  Bell, Smartphone, Globe, Lock, Sparkles, ArrowRight
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

// Documentation sections
const DOC_SECTIONS = [
  {
    id: 'overview',
    icon: Sparkles,
    title: 'О платформе SOLTO',
    color: 'from-indigo-500 to-violet-500',
    content: `SOLTO — интеллектуальная платформа для управления строительными проектами. Объединяет все ключевые роли: от директора до кладовщика в единую экосистему с ИИ-агентами.`,
    features: [
      '🤖 5 ИИ-агентов для автоматизации рутины',
      '📊 Реальный контроль финансов и складов',
      '🔍 Поиск поставщиков через Google в реальном времени',
      '📱 Работает на телефоне и компьютере',
    ]
  },
  {
    id: 'director',
    icon: Shield,
    title: 'Директор',
    color: 'from-blue-500 to-indigo-600',
    content: 'Полный контроль над всеми проектами, финансами и командой.',
    features: [
      '✅ Одобрение и отклонение заявок на материалы',
      '💰 Утверждение оплаты с выбором поставщика',
      '👥 Управление командой и ролями сотрудников',
      '📈 Финансовая аналитика и отчёты',
      '🏗️ Создание и управление проектами',
    ]
  },
  {
    id: 'foreman',
    icon: ClipboardList,
    title: 'Прораб',
    color: 'from-orange-500 to-red-500',
    content: 'Подача заявок с помощью ИИ-ассистента, который подбирает СНиПы и ГОСТы.',
    features: [
      '📝 Создание заявок на материалы с ТЗ',
      '🤖 ИИ подсказывает СНиП и ГОСТ',
      '📐 Автоматический расчёт количества',
      '📋 Отслеживание статуса заявок',
    ]
  },
  {
    id: 'procurement',
    icon: Search,
    title: 'Снабженец',
    color: 'from-amber-500 to-orange-500',
    content: 'ИИ агент ищет реальных поставщиков через Google Search Grounding.',
    features: [
      '🌐 Live-поиск поставщиков в Google',
      '📊 Сравнение цен от 5+ поставщиков',
      '📞 Контакты, адреса, рейтинги',
      '⚡ Оценка надёжности (1-100)',
    ]
  },
  {
    id: 'accountant',
    icon: Calculator,
    title: 'Бухгалтер',
    color: 'from-green-500 to-emerald-600',
    content: 'ИИ формирует проводки по НСБУ, рассчитывает НДС и ведёт главную книгу.',
    features: [
      '📊 Автоматические проводки (Дт/Кт)',
      '🧾 Расчёт НДС (12%), НДФЛ (10%)',
      '📈 Баланс в реальном времени',
      '📥 Экспорт в CSV для 1С',
    ]
  },
  {
    id: 'storekeeper',
    icon: Package,
    title: 'Кладовщик',
    color: 'from-teal-500 to-cyan-600',
    content: 'Управление складом: приём, выдача, остатки и отчёты.',
    features: [
      '📦 Приём товаров на склад',
      '📤 Выдача — кому, когда, сколько',
      '📊 Контроль остатков в реальном времени',
      '📄 Акт выдачи ТМЦ (PDF отчёт)',
    ]
  },
  {
    id: 'invite',
    icon: Users,
    title: 'Как пригласить команду',
    color: 'from-violet-500 to-purple-600',
    content: 'Простой процесс подключения сотрудников за 4 шага.',
    features: [
      '1️⃣ Директор копирует код приглашения',
      '2️⃣ Отправляет сотруднику (WhatsApp, Telegram)',
      '3️⃣ Сотрудник скачивает SOLTO и регистрируется',
      '4️⃣ Вводит код → попадает в команду',
    ]
  },
];

export default function ProfileView({ profile, onProfileUpdate }: ProfileViewProps) {
  const { user, signOut } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(profile?.full_name || '');
  const [editCompanyName, setEditCompanyName] = useState('');
  const [editingCompany, setEditingCompany] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [teamCount, setTeamCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [expandedDoc, setExpandedDoc] = useState<string | null>(null);

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

  const handleSaveCompanyName = async () => {
    if (!editCompanyName.trim() || !company) return;
    setSavingCompany(true);
    try {
      const updated = await api.updateCompany(editCompanyName.trim());
      if (updated && !updated.error) {
        setCompany({ ...company, name: editCompanyName.trim() });
        setEditingCompany(false);
      } else {
        alert(updated?.error || 'Ошибка при обновлении');
      }
    } catch (e: any) {
      alert(e.message || 'Ошибка при обновлении');
    }
    setSavingCompany(false);
  };

  const handleCopyCode = () => {
    if (!company?.invite_code) return;
    navigator.clipboard.writeText(company.invite_code).catch(() => {
      // Fallback for mobile
      const ta = document.createElement('textarea');
      ta.value = company.invite_code;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
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
    
    try {
      if (navigator.share) {
        await navigator.share({ title: 'SOLTO — Код приглашения', text });
        return;
      }
    } catch { /* share cancelled or unsupported */ }
    
    // Fallback: copy to clipboard
    handleCopyCode();
    alert(`Код скопирован: ${company.invite_code}\n\nОтправьте его сотрудникам через WhatsApp или Telegram.`);
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
              <button onClick={() => { setEditingCompany(true); setEditCompanyName(company.name); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
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
                placeholder="Название компании"
              />
              <button 
                onClick={handleSaveCompanyName} 
                disabled={savingCompany || !editCompanyName.trim()}
                className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
              >
                {savingCompany ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
              </button>
              <button onClick={() => { setEditingCompany(false); setEditCompanyName(company.name); }} className="p-1.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                <X size={14} />
              </button>
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
                  title="Копировать код"
                >
                  {codeCopied ? <Check size={16} /> : <Copy size={16} />}
                </button>
                <button 
                  onClick={handleShareCode}
                  className="p-2 bg-white text-gray-500 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                  title="Поделиться кодом"
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

      {/* Documentation — Premium */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
        <button 
          onClick={() => setShowDocs(!showDocs)}
          className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-sm">
              <BookOpen size={18} className="text-white" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-800">Документация</p>
              <p className="text-[10px] text-gray-400">Руководство по всем разделам</p>
            </div>
          </div>
          <ChevronRight size={16} className={`text-gray-300 transition-transform duration-300 ${showDocs ? 'rotate-90' : ''}`} />
        </button>

        {showDocs && (
          <div className="px-4 pb-4 border-t border-gray-100">
            <div className="mt-3 space-y-2">
              {DOC_SECTIONS.map((section) => {
                const Icon = section.icon;
                const isExpanded = expandedDoc === section.id;
                return (
                  <div key={section.id} className="overflow-hidden rounded-2xl border border-gray-100">
                    <button
                      onClick={() => setExpandedDoc(isExpanded ? null : section.id)}
                      className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                    >
                      <div className={`w-8 h-8 bg-gradient-to-br ${section.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}>
                        <Icon size={14} className="text-white" />
                      </div>
                      <span className="text-sm font-bold text-gray-800 flex-1 text-left">{section.title}</span>
                      <ChevronDown size={14} className={`text-gray-300 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    {isExpanded && (
                      <div className="px-3 pb-3 border-t border-gray-50">
                        <p className="text-xs text-gray-500 mt-2 mb-3 leading-relaxed">{section.content}</p>
                        <div className="space-y-1.5">
                          {section.features.map((feature, i) => (
                            <div key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-2">
                              <span className="leading-relaxed">{feature}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Tech Stack */}
            <div className="mt-4 p-3 bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Технологии</p>
              <div className="flex flex-wrap gap-1.5">
                {['React', 'TypeScript', 'Gemini AI', 'Google Search', 'Supabase', 'Capacitor'].map(tech => (
                  <span key={tech} className="text-[10px] px-2 py-1 bg-white/10 text-gray-300 rounded-md font-mono">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-gray-100" />

        <button className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center">
              <Smartphone size={18} className="text-gray-500" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold text-gray-800">Версия</p>
              <p className="text-[10px] text-gray-400">SOLTO v2.1.0 • Build 2026.04.19</p>
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
