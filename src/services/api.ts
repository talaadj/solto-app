import { supabase } from './supabase';

// Smart API base URL:
// - localhost/127.0.0.1 → same origin (dev server handles API)
// - Capacitor (capacitor://, https://localhost on mobile) → Render cloud
// - Everywhere else → use env variable or Render
const isLocalDev = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
  window.location.protocol === 'http:';
const API_BASE = isLocalDev ? '' : (import.meta.env.VITE_API_URL || 'https://solto-app.onrender.com');

// --- Auth-aware fetch helper ---

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  // Get fresh session (auto-refreshes expired tokens)
  let { data: { session } } = await supabase.auth.getSession();
  
  // If no session or token looks expired, force refresh
  if (!session?.access_token) {
    const { data } = await supabase.auth.refreshSession();
    session = data.session;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  
  // Add timeout for Render cold starts (up to 60s)
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  
  try {
    let res = await fetch(API_BASE + url, { ...options, headers, signal: controller.signal });
    
    // If 401, try refreshing token once and retry
    if (res.status === 401 && session) {
      const { data } = await supabase.auth.refreshSession();
      if (data.session?.access_token) {
        headers['Authorization'] = `Bearer ${data.session.access_token}`;
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 60000);
        res = await fetch(API_BASE + url, { ...options, headers, signal: controller2.signal });
        clearTimeout(timeout2);
      } else {
        // Stale token from a different Supabase project — force sign out
        console.warn('⚠️ Token refresh failed — forcing sign out (stale session)');
        await supabase.auth.signOut();
        window.location.href = '/';
        throw new Error('Session expired — please sign in again');
      }
    }
    
    clearTimeout(timeout);
    return res;
  } catch (e: any) {
    clearTimeout(timeout);
    throw e;
  }
}

// Safe JSON parse helpers — prevent .map() crash on error objects
async function jsonArray(res: Response): Promise<any[]> {
  try {
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

async function jsonObj(res: Response): Promise<any> {
  try {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
      throw new Error(err.error || `HTTP ${res.status}`);
    }
    return await res.json();
  } catch (e) { throw e; }
}

// --- AI Agent Proxies (server-side) ---

export const foremanAgent = async (prompt: string) => {
  const res = await fetchWithAuth('/api/ai/foreman', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
  return jsonObj(res);
};

export const snipSearchAgent = async (query: string) => {
  const res = await fetchWithAuth('/api/ai/snip-search', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
  return jsonArray(res);
};

export const procurementAgent = async (requestTitle: string, requestDescription: string, projectAddress: string) => {
  const res = await fetchWithAuth('/api/ai/procurement', {
    method: 'POST',
    body: JSON.stringify({ requestTitle, requestDescription, projectAddress }),
  });
  return jsonObj(res);
};

export const accountantAgent = async (action: string, amount: number, description: string) => {
  const res = await fetchWithAuth('/api/ai/accountant', {
    method: 'POST',
    body: JSON.stringify({ action, amount, description }),
  });
  if (!res.ok) return 'Ошибка при обращении к ИИ';
  const data = await res.json();
  return data.text;
};

export const storekeeperAgent = async (itemName: string, quantity: number, action: 'issue' | 'receive') => {
  const res = await fetchWithAuth('/api/ai/storekeeper', {
    method: 'POST',
    body: JSON.stringify({ itemName, quantity, action }),
  });
  if (!res.ok) return 'Ошибка при обращении к ИИ';
  const data = await res.json();
  return data.text;
};

// --- Data API helpers ---

export const api = {
  // Projects
  getProjects: () => fetchWithAuth('/api/projects').then(jsonArray),
  createProject: (name: string, address: string) =>
    fetchWithAuth('/api/projects', {
      method: 'POST',
      body: JSON.stringify({ name, address }),
    }).then(r => r.json()),

  // Requests
  getRequests: (projectId?: number | null, role?: string) => {
    let url = '/api/requests';
    if (role !== 'director' && projectId) {
      url += `?project_id=${projectId}`;
    }
    return fetchWithAuth(url).then(jsonArray);
  },
  createRequest: (projectId: number, title: string, description: string, quantity?: number, unit?: string) =>
    fetchWithAuth('/api/requests', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, title, description, quantity: quantity || 1, unit: unit || 'шт' }),
    }).then(r => r.json()),
  updateRequestStatus: (id: number, status: string) =>
    fetchWithAuth(`/api/requests/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }).then(r => r.json()),
  deleteRequest: (id: number) =>
    fetchWithAuth(`/api/requests/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Procurement
  getOffers: (requestId: number) =>
    fetchWithAuth(`/api/procurement/${requestId}`).then(jsonArray),
  updateOfferStatus: (id: number, status: string, paymentData?: { approved_quantity?: number; approved_amount?: number; payment_method?: string; payment_notes?: string }) =>
    fetchWithAuth(`/api/procurement/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...paymentData }),
    }).then(r => r.json()),
  createOffer: (offer: Record<string, any>) =>
    fetchWithAuth('/api/procurement', {
      method: 'POST',
      body: JSON.stringify(offer),
    }).then(r => r.json()),

  // Inventory
  getInventory: () => fetchWithAuth('/api/inventory').then(jsonArray),
  updateInventory: (item_name: string, quantity: number, unit: string) =>
    fetchWithAuth('/api/inventory/update', {
      method: 'POST',
      body: JSON.stringify({ item_name, quantity, unit }),
    }).then(r => r.json()),

  // Transactions
  getTransactions: () => fetchWithAuth('/api/transactions').then(jsonArray),
  createTransaction: (type: string, amount: number, description: string) =>
    fetchWithAuth('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ type, amount, description }),
    }).then(r => r.json()),

  // Profile
  getProfile: async () => {
    try {
      const res = await fetchWithAuth('/api/profile');
      if (!res.ok) return { role: 'director', full_name: '', email: '', user_id: '', project_ids: '', is_owner: 0 };
      const data = await res.json();
      return data && data.user_id ? data : { role: 'director', full_name: '', email: '', user_id: '', project_ids: '', is_owner: 0 };
    } catch {
      return { role: 'director', full_name: '', email: '', user_id: '', project_ids: '', is_owner: 0 };
    }
  },
  updateProfile: (data: { full_name?: string }) =>
    fetchWithAuth('/api/profile', { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.json()),

  // Team (Director only)
  getTeam: () => fetchWithAuth('/api/team').then(jsonArray),
  updateTeamMember: (userId: string, data: { role?: string; project_ids?: number[] }) =>
    fetchWithAuth(`/api/team/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.json()),
  removeTeamMember: (userId: string) =>
    fetchWithAuth(`/api/team/${userId}`, { method: 'DELETE' }).then(r => r.json()),

  // Notifications
  getNotifications: () => fetchWithAuth('/api/notifications').then(jsonArray),
  markNotificationRead: (id: number) =>
    fetchWithAuth(`/api/notifications/${id}/read`, { method: 'PATCH' }).then(r => r.json()),
  markAllNotificationsRead: () =>
    fetchWithAuth('/api/notifications/read-all', { method: 'POST' }).then(r => r.json()),

  // Schedule / Gantt
  getSchedule: (projectId: number) =>
    fetchWithAuth(`/api/schedule/${projectId}`).then(jsonArray),
  createScheduleTask: (data: { project_id: number; title: string; start_date: string; end_date: string; parent_id?: number; color?: string }) =>
    fetchWithAuth('/api/schedule', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
  updateScheduleTask: (id: number, data: Record<string, any>) =>
    fetchWithAuth(`/api/schedule/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.json()),
  deleteScheduleTask: (id: number) =>
    fetchWithAuth(`/api/schedule/${id}`, { method: 'DELETE' }).then(r => r.json()),

  // Company
  getCompany: async () => {
    try {
      const res = await fetchWithAuth('/api/company');
      if (!res.ok) return null;
      return await res.json();
    } catch { return null; }
  },
  createCompany: (name: string) =>
    fetchWithAuth('/api/company/create', { method: 'POST', body: JSON.stringify({ name }) }).then(r => r.json()),
  joinCompany: (invite_code: string) =>
    fetchWithAuth('/api/company/join', { method: 'POST', body: JSON.stringify({ invite_code }) }).then(r => r.json()),
};
