import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, HardHat, ShoppingBag, Calculator, Warehouse, 
  UserCircle, Plus, X, Menu, LogOut, Users, CalendarDays, Shield
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { UserRole, Request, InventoryItem, Transaction, Project } from './types';
import { api, accountantAgent } from './services/api';
import { useAuth } from './hooks/useAuth';
import { AuthGuard } from './components/AuthGuard';
import { NotificationBell } from './components/NotificationBell';

// --- Views ---
import { ForemanView } from './views/ForemanView';
import { DirectorView } from './views/DirectorView';
import { ProcurementView } from './views/ProcurementView';
import { AccountantView } from './views/AccountantView';
import { StorekeeperView } from './views/StorekeeperView';
import { TeamManagementView } from './views/TeamManagementView';
import { GanttView } from './views/GanttView';

// Error Boundary to prevent view crashes from killing the app
interface EBProps { children: React.ReactNode; viewName: string; }
interface EBState { hasError: boolean; error?: Error; }
class ViewErrorBoundary extends React.Component<EBProps, EBState> {
  constructor(props: EBProps) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error: Error): EBState { return { hasError: true, error }; }
  componentDidCatch(error: Error) { console.error(`[${this.props.viewName}] Error:`, error); }
  componentDidUpdate(prevProps: EBProps) { if (prevProps.viewName !== this.props.viewName) this.setState({ hasError: false }); }
  render() {
    if (this.state.hasError) return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">Ошибка загрузки модуля</h3>
        <p className="text-sm text-gray-500 mb-4 max-w-md">{this.state.error?.message || 'Неизвестная ошибка'}</p>
        <button onClick={() => this.setState({ hasError: false })} className="px-6 py-2 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700">
          Попробовать снова
        </button>
      </div>
    );
    return this.props.children;
  }
}

interface UserProfile {
  user_id: string;
  email: string;
  full_name: string;
  role: string;
  project_ids: string;
  is_owner: number;
}

// --- Main App Content (authenticated) ---
function AppContent() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<string>('loading');
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectAddress, setNewProjectAddress] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Load profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const p = await api.getProfile();
      setProfile(p);
      setActiveView(p.role || 'director');
    } catch (e) {
      console.error('Failed to load profile:', e);
      setActiveView('director');
    }
  };

  const role = (profile?.role || 'director') as UserRole;

  const fetchData = async () => {
    const [projs, inv, trans] = await Promise.all([
      api.getProjects(),
      api.getInventory(),
      api.getTransactions()
    ]);
    setProjects(projs);
    setInventory(inv);
    setTransactions(trans);
    
    if (projs.length > 0 && !currentProject) {
      setCurrentProject(projs[0]);
    }
  };

  const fetchRequests = async () => {
    const reqs = await api.getRequests(currentProject?.id, role);
    setRequests(reqs);
  };

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (activeView !== 'loading') fetchRequests(); }, [currentProject, activeView]);

  const handleNewProject = async () => {
    if (!newProjectName) return;
    await api.createProject(newProjectName, newProjectAddress);
    setShowNewProjectModal(false);
    setNewProjectName('');
    setNewProjectAddress('');
    fetchData();
  };

  const handleNewRequest = async (title: string, description: string, quantity: number = 1, unit: string = 'шт') => {
    if (!currentProject) return;
    await api.createRequest(currentProject.id, title, description, quantity, unit);
    fetchRequests();
  };

  const handleApproveRequest = async (id: number) => {
    await api.updateRequestStatus(id, 'approved');
    fetchRequests();
  };

  const handleRejectRequest = async (id: number) => {
    try {
      await api.deleteRequest(id);
      fetchRequests();
    } catch (e) { console.error(e); }
  };

  const handleApproveOffer = async (offerId: number, requestId: number, paymentData?: { approved_quantity: number; approved_amount: number; payment_method: string; payment_notes: string }) => {
    try {
      await api.updateOfferStatus(offerId, 'approved', paymentData);
      await api.updateRequestStatus(requestId, 'payment_pending');
      fetchRequests();
      alert(`Предложение утверждено!
Количество: ${paymentData?.approved_quantity || '?'}
Сумма: ${paymentData?.approved_amount?.toLocaleString() || '?'} сом
Способ оплаты: ${paymentData?.payment_method || '?'}
Отправлено в бухгалтерию!`);
    } catch (e) {
      console.error(e);
      alert("Ошибка при утверждении предложения.");
    }
  };

  const handleProcessPayment = async (requestId: number) => {
    try {
      const offers = await api.getOffers(requestId);
      const offer = offers.find((o: any) => o.status === 'approved');
      if (!offer) throw new Error("Approved offer not found");

      const request = requests.find(r => r.id === requestId);
      const priceNum = typeof offer.price === 'number' ? offer.price : parseFloat(offer.price) || 0;
      const actionDesc = `Оплата поставщику ${offer.supplier_name} за ${offer.details} (Проект: ${currentProject?.name})`;
      const accountingDetails = await accountantAgent('Оплата поставщику', priceNum, actionDesc);

      await api.createTransaction('expense', priceNum, accountingDetails);
      await api.updateRequestStatus(requestId, 'purchased');

      const itemName = offer.details || request?.title || 'Материал';
      await api.updateInventory(itemName, 1, 'шт');

      fetchData();
      fetchRequests();
      alert("Оплата проведена успешно!");
    } catch (e) {
      console.error(e);
      alert("Ошибка при обработке оплаты.");
    }
  };

  const handleAddItem = async (name: string, quantity: number, unit: string) => {
    await api.updateInventory(name, quantity, unit);
    const inv = await api.getInventory();
    setInventory(inv);
  };

  // Build navigation based on user's role
  const getNavItems = () => {
    const allItems = [
      { id: 'director', label: 'Директор', icon: UserCircle, roles: ['director'] },
      { id: 'foreman', label: 'Прораб', icon: HardHat, roles: ['director', 'foreman'] },
      { id: 'procurement', label: 'Снабжение', icon: ShoppingBag, roles: ['director', 'procurement'] },
      { id: 'accountant', label: 'Бухгалтер', icon: Calculator, roles: ['director', 'accountant'] },
      { id: 'storekeeper', label: 'Склад', icon: Warehouse, roles: ['director', 'storekeeper'] },
      { id: 'gantt', label: 'График', icon: CalendarDays, roles: ['director', 'foreman'] },
      { id: 'team', label: 'Команда', icon: Users, roles: ['director'] },
    ];
    return allItems.filter(item => item.roles.includes(role));
  };

  const navItems = getNavItems();
  const currentLabel = navItems.find(n => n.id === activeView)?.label || 'Загрузка...';

  const ROLE_LABELS: Record<string, { label: string; badge: string }> = {
    director: { label: 'Директор', badge: 'bg-purple-100 text-purple-700' },
    foreman: { label: 'Прораб', badge: 'bg-amber-100 text-amber-700' },
    procurement: { label: 'Снабженец', badge: 'bg-blue-100 text-blue-700' },
    accountant: { label: 'Бухгалтер', badge: 'bg-green-100 text-green-700' },
    storekeeper: { label: 'Кладовщик', badge: 'bg-orange-100 text-orange-700' },
  };

  // Lock body scroll when mobile menu is open (MUST be before any early return)
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
    } else {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    }
    return () => {
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
    };
  }, [mobileMenuOpen]);

  if (activeView === 'loading') {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Загрузка профиля...</p>
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 font-sans overflow-x-hidden">
      {/* Mobile Header */}
      <div className="lg:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <LayoutDashboard className="text-white w-5 h-5" />
          </div>
          <h1 className="font-bold text-lg tracking-tight">SOLTO</h1>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <button 
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Sidebar Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-200 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 overflow-y-auto ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`} style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="p-6 flex flex-col min-h-full">
        <div className="flex items-center justify-between mb-8 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center">
              <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            <h1 className="font-bold text-xl tracking-tight">SOLTO</h1>
          </div>
          <button className="lg:hidden p-2 hover:bg-gray-100 rounded-lg" onClick={() => setMobileMenuOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Role Badge */}
        <div className="mb-4 px-2">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${ROLE_LABELS[role]?.badge || 'bg-gray-100 text-gray-600'}`}>
            <Shield size={12} />
            {ROLE_LABELS[role]?.label || role}
          </div>
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
            {role === 'director' && (
              <button 
                onClick={() => setShowNewProjectModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-gray-300 rounded-xl text-xs text-gray-500 hover:bg-gray-50 transition-colors"
              >
                <Plus className="w-3 h-3" /> Добавить объект
              </button>
            )}
          </div>
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => { setActiveView(item.id); setMobileMenuOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                activeView === item.id 
                ? 'bg-black text-white shadow-lg shadow-black/10' 
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 space-y-4">
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

          {/* User info + Sign out */}
          <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                {user?.email?.charAt(0).toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-gray-700 truncate">{profile?.full_name || user?.user_metadata?.full_name || user?.email}</p>
                <p className="text-[10px] text-gray-400 truncate">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Выйти
            </button>
          </div>

          <div className="px-2 space-y-2 pb-4">
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
      </div>

      {/* Main Content */}
      <main className="lg:ml-64 p-4 lg:p-8 pb-20 lg:pb-8" style={{ WebkitOverflowScrolling: 'touch' }}>
        <header className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 lg:mb-10">
          <div>
            <h2 className="text-2xl lg:text-3xl font-bold tracking-tight">
              {currentLabel}
            </h2>
            <p className="text-sm lg:text-base text-gray-500 mt-1">Управление строительными процессами в реальном времени</p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto">
            <div className="hidden lg:block">
              <NotificationBell />
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] lg:text-xs font-bold text-gray-400 uppercase tracking-widest">Проект</p>
              <p className="font-bold text-sm lg:text-base">{currentProject?.name || 'Не выбран'}</p>
            </div>
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0">
              {user?.email?.charAt(0).toUpperCase() || '?'}
            </div>
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <ViewErrorBoundary viewName={activeView}>
              {activeView === 'foreman' && <ForemanView requests={requests} onNewRequest={handleNewRequest} currentProjectId={currentProject?.id || null} />}
              {activeView === 'director' && <DirectorView projects={projects} requests={requests} onApproveRequest={handleApproveRequest} onRejectRequest={handleRejectRequest} onApproveOffer={handleApproveOffer} onRefresh={fetchRequests} currentProjectId={currentProject?.id || null} />}
              {activeView === 'procurement' && <ProcurementView requests={requests} onSearch={fetchRequests} projectAddress={currentProject?.address || 'Кыргызстан'} />}
              {activeView === 'accountant' && <AccountantView transactions={transactions} requests={requests} onProcessPayment={handleProcessPayment} />}
              {activeView === 'storekeeper' && <StorekeeperView inventory={inventory} onAddItem={handleAddItem} />}
              {activeView === 'team' && <TeamManagementView projects={projects} />}
              {activeView === 'gantt' && <GanttView projects={projects} selectedProject={currentProject} />}
            </ViewErrorBoundary>
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

// --- App with AuthGuard ---
export default function App() {
  return (
    <AuthGuard>
      <AppContent />
    </AuthGuard>
  );
}
