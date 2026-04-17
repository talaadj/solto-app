import { supabase } from './supabase';

// Base URL for API calls — empty for local dev, set VITE_API_URL for mobile APK
const API_BASE = import.meta.env.VITE_API_URL || '';

// --- Auth-aware fetch helper ---

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return fetch(API_BASE + url, { ...options, headers });
}

// --- AI Agent Proxies (server-side) ---

export const foremanAgent = async (prompt: string) => {
  const res = await fetchWithAuth('/api/ai/foreman', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(err.error || 'Ошибка при обращении к ИИ');
  }
  return res.json();
};

export const snipSearchAgent = async (query: string) => {
  const res = await fetchWithAuth('/api/ai/snip-search', {
    method: 'POST',
    body: JSON.stringify({ query }),
  });
  if (!res.ok) return [];
  return res.json();
};

export const procurementAgent = async (requestTitle: string, requestDescription: string, projectAddress: string) => {
  const res = await fetchWithAuth('/api/ai/procurement', {
    method: 'POST',
    body: JSON.stringify({ requestTitle, requestDescription, projectAddress }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Ошибка сервера' }));
    throw new Error(err.error || 'Ошибка при обращении к ИИ');
  }
  return res.json();
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
  getProjects: () => fetchWithAuth('/api/projects').then(r => r.json()),
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
    return fetchWithAuth(url).then(r => r.json());
  },
  createRequest: (projectId: number, title: string, description: string, quantity?: number, unit?: string) =>
    fetchWithAuth('/api/requests', {
      method: 'POST',
      body: JSON.stringify({ project_id: projectId, title, description, foreman_id: 'foreman-1', quantity: quantity || 1, unit: unit || 'шт' }),
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
    fetchWithAuth(`/api/procurement/${requestId}`).then(r => r.json()),
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
  getInventory: () => fetchWithAuth('/api/inventory').then(r => r.json()),
  updateInventory: (item_name: string, quantity: number, unit: string) =>
    fetchWithAuth('/api/inventory/update', {
      method: 'POST',
      body: JSON.stringify({ item_name, quantity, unit }),
    }).then(r => r.json()),

  // Transactions
  getTransactions: () => fetchWithAuth('/api/transactions').then(r => r.json()),
  createTransaction: (type: string, amount: number, description: string) =>
    fetchWithAuth('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ type, amount, description }),
    }).then(r => r.json()),

  // Profile
  getProfile: () => fetchWithAuth('/api/profile').then(r => r.json()),
  updateProfile: (data: { full_name?: string }) =>
    fetchWithAuth('/api/profile', { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.json()),

  // Team (Director only)
  getTeam: () => fetchWithAuth('/api/team').then(r => r.json()),
  updateTeamMember: (userId: string, data: { role?: string; project_ids?: number[] }) =>
    fetchWithAuth(`/api/team/${userId}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.json()),
  removeTeamMember: (userId: string) =>
    fetchWithAuth(`/api/team/${userId}`, { method: 'DELETE' }).then(r => r.json()),

  // Notifications
  getNotifications: () => fetchWithAuth('/api/notifications').then(r => r.json()),
  markNotificationRead: (id: number) =>
    fetchWithAuth(`/api/notifications/${id}/read`, { method: 'PATCH' }).then(r => r.json()),
  markAllNotificationsRead: () =>
    fetchWithAuth('/api/notifications/read-all', { method: 'POST' }).then(r => r.json()),

  // Schedule / Gantt
  getSchedule: (projectId: number) =>
    fetchWithAuth(`/api/schedule/${projectId}`).then(r => r.json()),
  createScheduleTask: (data: { project_id: number; title: string; start_date: string; end_date: string; parent_id?: number; color?: string }) =>
    fetchWithAuth('/api/schedule', { method: 'POST', body: JSON.stringify(data) }).then(r => r.json()),
  updateScheduleTask: (id: number, data: Record<string, any>) =>
    fetchWithAuth(`/api/schedule/${id}`, { method: 'PATCH', body: JSON.stringify(data) }).then(r => r.json()),
  deleteScheduleTask: (id: number) =>
    fetchWithAuth(`/api/schedule/${id}`, { method: 'DELETE' }).then(r => r.json()),
};
