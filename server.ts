import dotenv from "dotenv";
// In production (Render), env vars are set via dashboard. Don't override them.
dotenv.config({ path: ".env.local", override: false });
dotenv.config({ path: ".env", override: false });

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Supabase Client (Server-side with service role for bypassing RLS)
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;
const supabase = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey); // For auth operations

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ SUPABASE_URL и SUPABASE_ANON_KEY обязательны! Добавьте в .env.local");
  process.exit(1);
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("⚠️ SUPABASE_SERVICE_ROLE_KEY не установлен! Используется anon key — RLS НЕ будет обходиться!");
} else {
  console.log("✅ Service Role Key загружен");
}
console.log("✅ Supabase подключен:", supabaseUrl);

// Gemini AI Client (Server-side only — key never exposed to client)
const geminiKey = process.env.GEMINI_API_KEY || "";
const isGeminiConfigured = geminiKey && geminiKey !== "MY_GEMINI_API_KEY" && geminiKey.length > 10;
if (!isGeminiConfigured) {
  console.warn("⚠️  GEMINI_API_KEY не настроен! ИИ-агенты не будут работать.");
  console.warn("   Получите ключ на https://aistudio.google.com/apikey и добавьте в .env.local");
}
const ai = isGeminiConfigured ? new GoogleGenAI({ apiKey: geminiKey }) : null;

// ============================================================
// HELPER: Create notification for directors in same company
// ============================================================
async function createNotification(userId: string, companyId: number, type: string, title: string, message: string, link?: string) {
  const { data: directors } = await supabase.from('user_profiles').select('user_id').eq('role', 'director').eq('company_id', companyId);
  if (directors) {
    for (const d of directors) {
      if (d.user_id !== userId) {
        await supabase.from('notifications').insert({
          user_id: d.user_id, type, title, message, link: link || null
        });
      }
    }
  }
}

// ============================================================
// AUTH MIDDLEWARE — validates JWT + attaches profile/role/company
// ============================================================
const authMiddleware = async (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabaseAuth.auth.getUser(token);
    if (error || !user) {
      console.error('Auth error:', error?.message, 'Token prefix:', token?.substring(0, 20) + '...');
      return res.status(401).json({ error: error?.message || 'Недействительный токен' });
    }
    req.user = user;

    // Get or create profile
    let { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', user.id).single();
    
    if (!profile) {
      // Check if first user ever (becomes owner/director)
      const { count } = await supabase.from('user_profiles').select('*', { count: 'exact', head: true });
      const isFirst = (count || 0) === 0;
      
      let companyId: number | null = null;
      
      if (isFirst) {
        // Create default company for first user
        const { data: company } = await supabase.from('companies').insert({
          name: 'Моя компания',
          owner_id: user.id
        }).select().single();
        companyId = company?.id || null;
      }
      
      const { data: newProfile, error: insertErr } = await supabase.from('user_profiles').insert({
        user_id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || '',
        role: isFirst ? 'director' : 'viewer',
        is_owner: isFirst,
        company_id: companyId
      }).select().single();
      
      if (insertErr) {
        console.error('Profile insert error:', insertErr.message);
      }
      profile = newProfile;
    }
    
    req.profile = profile;
    req.companyId = profile?.company_id || null;
    next();
  } catch (e: any) {
    console.error('Auth middleware crash:', e.message);
    return res.status(401).json({ error: 'Ошибка авторизации: ' + (e.message || '') });
  }
};

// Role-check middleware factory
const requireRole = (...roles: string[]) => (req: any, res: any, next: any) => {
  if (!roles.includes(req.profile?.role)) {
    return res.status(403).json({ error: 'Недостаточно прав' });
  }
  next();
};

// ============================================================
// AI AGENTS (Server-side — API key never leaves the server)
// ============================================================

// Retry wrapper for transient Gemini errors (503 overload, 429 rate-limit)
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  const delays = [2000, 5000, 10000];
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      const code = e.status || (e.message?.match(/"code":(\d+)/)?.[1]);
      const isRetryable = [429, 503].includes(Number(code)) || e.message?.includes('UNAVAILABLE') || e.message?.includes('overloaded');
      if (!isRetryable || attempt === maxRetries) throw e;
      console.log(`⏳ Gemini ${code} — retry ${attempt + 1}/${maxRetries} через ${delays[attempt] / 1000}с...`);
      await new Promise(r => setTimeout(r, delays[attempt]));
    }
  }
  throw new Error('Max retries exceeded');
}

async function foremanAgentFn(prompt: string) {
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: `Вы — ИИ-агент Прораб-Эксперт. Вы обладаете абсолютными знаниями во всех областях строительства.

Компетенции: СНиП, ГОСТ, Eurocodes, материаловедение, BIM, техника безопасности (OSHA, ISO 45001).

Задача:
- Используйте Google Search для проверки актуальных СНиП и ГОСТ.
- Превращайте краткие запросы в детализированные технические задания.
- В 'description' — экспертное заключение с нормативами.

ОБЯЗАТЕЛЬНО отвечайте ТОЛЬКО валидным JSON (без markdown, без \`\`\`):
{"title": "...", "description": "..."}`
    }
  }));

  const text = response.text || "{}";
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*"title"[\s\S]*"description"[\s\S]*\}/);
    if (match) try { return JSON.parse(match[0]); } catch {}
    return { title: "Техническое задание", description: text };
  }
}

async function snipSearchAgentFn(query: string) {
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-2.0-flash-lite",
    contents: `Найди 5 актуальных строительных нормативов (СНиП, ГОСТ, СП, Eurocodes) по запросу: "${query}". 
Для каждого укажи полный номер норматива, название и краткое описание применения.`,
    config: {
      systemInstruction: `Вы — эксперт по строительным нормам Кыргызстана и СНГ. Знаете все СНиП, ГОСТ, СП.
Отвечайте ТОЛЬКО валидным JSON-массивом без markdown:
[{"title": "Название (номер норматива)", "description": "Краткое описание..."}]`
    }
  }));

  const text = response.text || "[]";
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    const match = text.match(/\[[\s\S]*\]/);
    if (match) try { return JSON.parse(match[0]); } catch {}
    return [];
  }
}

async function procurementAgentFn(requestTitle: string, requestDescription: string, projectAddress: string) {
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Найди реальных поставщиков строительных материалов:
Потребность: "${requestTitle}"
Описание: "${requestDescription}"
Адрес объекта: "${projectAddress}"

Приоритет: поставщики в Кыргызстане, затем СНГ.`,
    config: {
      tools: [{ googleSearch: {} }],
      systemInstruction: `Вы — ИИ-агент Снабженец. Эксперт по закупкам строительных материалов в Кыргызстане и СНГ.

Задача:
1. Найдите 5 реальных поставщиков через Google Search
2. Для каждого найдите: название, телефон, email, адрес, цену, рейтинг
3. Оцените надёжность (1-100) и риски

ОБЯЗАТЕЛЬНО отвечайте ТОЛЬКО валидным JSON (без markdown):
{
  "offers": [
    {
      "supplier_name": "...",
      "supplier_phone": "...",
      "supplier_email": "...",
      "supplier_address": "...",
      "rating": 4.5,
      "price": 0,
      "details": "...",
      "source_url": "...",
      "reliability_score": 85,
      "risk_assessment": "..."
    }
  ]
}`
    }
  }));

  const text = response.text || "{}";
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*"offers"[\s\S]*\}/);
    if (match) try { return JSON.parse(match[0]); } catch {}
    return { offers: [] };
  }
}

async function accountantAgentFn(action: string, amount: number, description: string) {
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Операция: ${action === 'expense' ? 'Расход' : 'Доход'}, Сумма: ${amount} сом, Описание: ${description}`,
    config: {
      systemInstruction: "Вы - ИИ-агент Бухгалтер. Эксперт в налоговом и бухгалтерском учёте Кыргызстана. Формируете проводки по НСБУ, рассчитываете НДС (12%), НДФЛ (10%), социальные отчисления. Ведёте реестр счетов-фактур. Ответ: рекомендация по учёту данной операции, проводка и налоговые последствия.",
    }
  }));
  return response.text || "";
}

async function storekeeperAgentFn(itemName: string, quantity: number, action: string) {
  const response = await withRetry(() => ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `ТМЦ: ${itemName}, Кол-во: ${quantity}, Операция: ${action === 'issue' ? 'Отпуск со склада' : 'Приход на склад'}.`,
    config: {
      systemInstruction: "Вы - ИИ-агент Заведующий Складом. Эксперт в адресном хранении, инвентаризации и технике безопасности. Контролируете остатки, проверяете целостность упаковки. Ответ: подтверждение операции и место хранения.",
    }
  }));
  return response.text || "";
}

// ============================================================
// SERVER
// ============================================================

async function startServer() {
  const app = express();
  app.use(express.json());

  // CORS for mobile APK (Capacitor sends from capacitor://localhost or http://localhost)
  app.use((req: any, res: any, next: any) => {
    const origin = req.headers.origin || '*';
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Credentials', 'true');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
  });

  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // ---- AI API Routes (protected) ----
  const AI_KEY_ERROR = "GEMINI_API_KEY не настроен. Получите ключ на https://aistudio.google.com/apikey и добавьте в .env.local";

  function handleAiError(e: any, res: any, fallback?: any) {
    console.error("AI error:", e.message || e);
    if (e.message?.includes("API_KEY_INVALID") || e.message?.includes("API key not valid")) {
      return res.status(400).json({ error: AI_KEY_ERROR });
    }
    if (e.status === 429 || e.message?.includes("429") || e.message?.includes("quota")) {
      return res.status(429).json({ error: "Превышен лимит запросов к ИИ. Подождите минуту и попробуйте снова." });
    }
    if (fallback !== undefined) return res.json(fallback);
    res.status(500).json({ error: "Ошибка ИИ: " + (e.message || "Неизвестная ошибка") });
  }

  app.post("/api/ai/foreman", authMiddleware, async (req: any, res) => {
    if (!isGeminiConfigured) return res.status(400).json({ error: AI_KEY_ERROR });
    try {
      const result = await foremanAgentFn(req.body.prompt);
      res.json(result);
    } catch (e: any) { handleAiError(e, res); }
  });

  // Server-side cache for SNiP search (10 min TTL)
  const snipCache = new Map<string, { data: any; ts: number }>();
  const snipRateLimit = new Map<string, { count: number; resetAt: number }>();
  const SNIP_CACHE_TTL = 10 * 60 * 1000;
  const SNIP_RATE_LIMIT = 3;
  const SNIP_RATE_WINDOW = 60 * 1000;

  app.post("/api/ai/snip-search", authMiddleware, async (req: any, res) => {
    if (!isGeminiConfigured) return res.json([]);
    const query = (req.body.query || '').trim().toLowerCase();
    if (!query || query.length < 3) return res.json([]);
    
    const cached = snipCache.get(query);
    if (cached && Date.now() - cached.ts < SNIP_CACHE_TTL) {
      return res.json(cached.data);
    }

    const userId = req.user?.id || '0';
    const now = Date.now();
    const userLimit = snipRateLimit.get(userId);
    if (userLimit && now < userLimit.resetAt && userLimit.count >= SNIP_RATE_LIMIT) {
      return res.status(429).json({ error: 'Лимит поиска СНиП: подождите минуту' });
    }
    if (!userLimit || now >= userLimit.resetAt) {
      snipRateLimit.set(userId, { count: 1, resetAt: now + SNIP_RATE_WINDOW });
    } else {
      userLimit.count++;
    }
    
    try {
      const result = await snipSearchAgentFn(req.body.query);
      snipCache.set(query, { data: result, ts: now });
      res.json(result);
    } catch (e: any) { handleAiError(e, res, []); }
  });

  app.post("/api/ai/procurement", authMiddleware, async (req: any, res) => {
    if (!isGeminiConfigured) return res.status(400).json({ error: AI_KEY_ERROR });
    try {
      const result = await procurementAgentFn(req.body.requestTitle, req.body.requestDescription, req.body.projectAddress);
      res.json(result);
    } catch (e: any) { handleAiError(e, res); }
  });

  app.post("/api/ai/accountant", authMiddleware, async (req: any, res) => {
    if (!isGeminiConfigured) return res.json({ text: "⚠️ " + AI_KEY_ERROR });
    try {
      const text = await accountantAgentFn(req.body.action, req.body.amount, req.body.description);
      res.json({ text });
    } catch (e: any) { handleAiError(e, res, { text: "Ошибка ИИ: " + e.message }); }
  });

  app.post("/api/ai/storekeeper", authMiddleware, async (req: any, res) => {
    if (!isGeminiConfigured) return res.json({ text: "⚠️ " + AI_KEY_ERROR });
    try {
      const text = await storekeeperAgentFn(req.body.itemName, req.body.quantity, req.body.action);
      res.json({ text });
    } catch (e: any) { handleAiError(e, res, { text: "Ошибка ИИ: " + e.message }); }
  });

  // ============================================================
  // DATA API ROUTES — All using Supabase PostgreSQL
  // ============================================================

  // ---- Projects ----
  app.get("/api/projects", authMiddleware, async (req: any, res) => {
    if (!req.companyId) return res.json([]);
    const { data, error } = await supabase.from('projects').select('*').eq('company_id', req.companyId).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.post("/api/projects", authMiddleware, async (req: any, res) => {
    if (!req.companyId) return res.status(400).json({ error: 'Сначала создайте или присоединитесь к компании' });
    const { name, address } = req.body;
    const { data, error } = await supabase.from('projects').insert({ name, address, company_id: req.companyId }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ---- Requests ----
  app.get("/api/requests", authMiddleware, async (req: any, res) => {
    const { project_id } = req.query;
    let query = supabase.from('requests').select('*').order('created_at', { ascending: false });
    if (project_id) query = query.eq('project_id', project_id);
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.post("/api/requests", authMiddleware, async (req: any, res) => {
    const { project_id, title, description, quantity, unit } = req.body;
    if (!title) return res.status(400).json({ error: 'Название заявки обязательно' });
    const { data, error } = await supabase.from('requests').insert({
      project_id, title, description, 
      foreman_id: req.user.id,
      quantity: quantity || 1, unit: unit || 'шт'
    }).select().single();
    if (error) {
      console.error('Request insert error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    await createNotification(req.user.id, req.companyId, 'new_request', 'Новая заявка', `Создана заявка: "${title}" (${quantity || 1} ${unit || 'шт'})`);
    res.json(data);
  });

  app.patch("/api/requests/:id", authMiddleware, async (req: any, res) => {
    const { status } = req.body;
    const { error } = await supabase.from('requests').update({ status }).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    
    const { data: request } = await supabase.from('requests').select('*').eq('id', req.params.id).single();
    const statusLabels: Record<string, string> = {
      approved: '✅ Одобрена', procurement: '🛒 В закупке', payment_pending: '💰 Ожидает оплаты',
      purchased: '📦 Закуплено', delivered: '✅ Доставлено', rejected: '❌ Отклонена'
    };
    await createNotification(request?.foreman_id || req.user.id, req.companyId, 'status_change', 'Статус заявки', `${statusLabels[status] || status}: "${request?.title}"`);
    res.json({ success: true });
  });

  app.delete("/api/requests/:id", authMiddleware, async (req: any, res) => {
    const { error } = await supabase.from('requests').delete().eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  // ---- Procurement Offers ----
  app.get("/api/procurement/:requestId", authMiddleware, async (req: any, res) => {
    const { data, error } = await supabase.from('procurement_offers').select('*').eq('request_id', req.params.requestId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.patch("/api/procurement/:id", authMiddleware, async (req: any, res) => {
    const { status, approved_quantity, approved_amount, payment_method, payment_notes } = req.body;
    const updateData: any = { status };
    if (approved_quantity !== undefined) {
      updateData.approved_quantity = approved_quantity;
      updateData.approved_amount = approved_amount;
      updateData.payment_method = payment_method || null;
      updateData.payment_notes = payment_notes || null;
    }
    const { error } = await supabase.from('procurement_offers').update(updateData).eq('id', req.params.id);
    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  });

  app.post("/api/procurement", authMiddleware, async (req: any, res) => {
    const { request_id, supplier_name, supplier_phone, supplier_email, supplier_address, rating, price, details, source_url, reliability_score, risk_assessment } = req.body;
    const { data, error } = await supabase.from('procurement_offers').insert({
      request_id: request_id ?? null,
      supplier_name: supplier_name ?? 'Неизвестный поставщик',
      supplier_phone: supplier_phone ?? '',
      supplier_email: supplier_email ?? '',
      supplier_address: supplier_address ?? '',
      rating: rating ?? 0,
      price: price ?? 0,
      details: details ?? '',
      source_url: source_url || null,
      reliability_score: reliability_score ?? null,
      risk_assessment: risk_assessment || null
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  // ---- Inventory ----
  app.get("/api/inventory", authMiddleware, async (req: any, res) => {
    if (!req.companyId) return res.json([]);
    const { data, error } = await supabase.from('inventory').select('*').eq('company_id', req.companyId);
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.post("/api/inventory/update", authMiddleware, async (req: any, res) => {
    const { item_name, quantity, unit } = req.body;
    const { data: existing } = await supabase.from('inventory').select('*').eq('item_name', item_name).eq('company_id', req.companyId).single();
    if (existing) {
      await supabase.from('inventory').update({ quantity: existing.quantity + quantity }).eq('item_name', item_name).eq('company_id', req.companyId);
    } else {
      await supabase.from('inventory').insert({ item_name, quantity, unit, company_id: req.companyId });
    }
    res.json({ success: true });
  });

  // Issue item from inventory
  app.post("/api/inventory/:id/issue", authMiddleware, async (req: any, res) => {
    const itemId = parseInt(req.params.id);
    const { issued_to, quantity, notes } = req.body;
    if (!issued_to || !quantity || quantity <= 0) return res.status(400).json({ error: 'Укажите получателя и количество' });

    // Check current stock
    const { data: item, error: itemErr } = await supabase.from('inventory').select('*').eq('id', itemId).single();
    if (itemErr || !item) return res.status(404).json({ error: 'Товар не найден' });
    if (item.quantity < quantity) return res.status(400).json({ error: `Недостаточно на складе. Остаток: ${item.quantity} ${item.unit}` });

    // Decrease stock
    const { error: updateErr } = await supabase.from('inventory').update({ quantity: item.quantity - quantity }).eq('id', itemId);
    if (updateErr) return res.status(500).json({ error: updateErr.message });

    // Record issue
    const { data: issue, error: issueErr } = await supabase.from('inventory_issues').insert({
      inventory_item_id: itemId,
      issued_to,
      quantity,
      notes: notes || '',
      company_id: req.companyId,
    }).select().single();
    if (issueErr) return res.status(500).json({ error: issueErr.message });

    res.json(issue);
  });

  // Get issue history for an item
  app.get("/api/inventory/:id/issues", authMiddleware, async (req: any, res) => {
    const itemId = parseInt(req.params.id);
    const { data, error } = await supabase
      .from('inventory_issues')
      .select('*')
      .eq('inventory_item_id', itemId)
      .eq('company_id', req.companyId)
      .order('issued_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  // Get all issues for PDF (all items in company)
  app.get("/api/inventory/issues/all", authMiddleware, async (req: any, res) => {
    if (!req.companyId) return res.json([]);
    const { data, error } = await supabase
      .from('inventory_issues')
      .select('*, inventory!inner(item_name, unit)')
      .eq('company_id', req.companyId)
      .order('issued_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  // ---- Transactions ----
  app.get("/api/transactions", authMiddleware, async (req: any, res) => {
    if (!req.companyId) return res.json([]);
    const { data, error } = await supabase.from('transactions').select('*').eq('company_id', req.companyId).order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.post("/api/transactions", authMiddleware, async (req: any, res) => {
    const { type, amount, description } = req.body;
    const { data, error } = await supabase.from('transactions').insert({ type, amount, description, company_id: req.companyId }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await createNotification(req.user.id, req.companyId, 'transaction', 'Новая транзакция', `${type === 'expense' ? 'Расход' : 'Доход'}: ${amount} сом — ${description}`);
    res.json(data);
  });

  // ---- Profile API ----
  app.get("/api/profile", authMiddleware, (req: any, res) => {
    res.json(req.profile);
  });

  app.patch("/api/profile", authMiddleware, async (req: any, res) => {
    const { full_name } = req.body;
    if (full_name) {
      await supabase.from('user_profiles').update({ full_name }).eq('user_id', req.user.id);
    }
    const { data } = await supabase.from('user_profiles').select('*').eq('user_id', req.user.id).single();
    res.json(data);
  });

  // ---- Company Management ----
  app.get("/api/company", authMiddleware, async (req: any, res) => {
    if (!req.companyId) return res.json(null);
    const { data } = await supabase.from('companies').select('*').eq('id', req.companyId).single();
    res.json(data);
  });

  app.post("/api/company/create", authMiddleware, async (req: any, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Укажите название компании' });
    
    const { data: company, error } = await supabase.from('companies').insert({
      name,
      owner_id: req.user.id
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });

    // Update user profile
    await supabase.from('user_profiles').update({
      company_id: company.id,
      role: 'director',
      is_owner: true
    }).eq('user_id', req.user.id);

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', req.user.id).single();
    res.json({ company, profile });
  });

  app.post("/api/company/join", authMiddleware, async (req: any, res) => {
    const { invite_code } = req.body;
    if (!invite_code) return res.status(400).json({ error: 'Укажите код приглашения' });

    const { data: company } = await supabase.from('companies').select('*').eq('invite_code', invite_code).single();
    if (!company) return res.status(404).json({ error: 'Компания не найдена. Проверьте код.' });

    await supabase.from('user_profiles').update({
      company_id: company.id,
      role: 'foreman'
    }).eq('user_id', req.user.id);

    const { data: profile } = await supabase.from('user_profiles').select('*').eq('user_id', req.user.id).single();
    res.json({ company, profile });
  });

  // ---- Team Management (Director only) ----
  app.get("/api/team", authMiddleware, requireRole('director'), async (req: any, res) => {
    if (!req.companyId) return res.json([]);
    const { data, error } = await supabase.from('user_profiles').select('*').eq('company_id', req.companyId).order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.patch("/api/team/:userId", authMiddleware, requireRole('director'), async (req: any, res) => {
    const { role, project_ids } = req.body;
    const { data: target } = await supabase.from('user_profiles').select('*').eq('user_id', req.params.userId).eq('company_id', req.companyId).single();
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    if (target.is_owner && role !== 'director') {
      return res.status(403).json({ error: 'Нельзя изменить роль владельца' });
    }
    const updateData: any = {};
    if (role) updateData.role = role;
    if (project_ids) updateData.project_ids = project_ids;
    await supabase.from('user_profiles').update(updateData).eq('user_id', req.params.userId);
    const { data: updated } = await supabase.from('user_profiles').select('*').eq('user_id', req.params.userId).single();
    await createNotification(req.params.userId, req.companyId, 'role_change', 'Роль изменена', `Ваша роль изменена на: ${role}`);
    res.json(updated);
  });

  app.delete("/api/team/:userId", authMiddleware, requireRole('director'), async (req: any, res) => {
    const { data: target } = await supabase.from('user_profiles').select('*').eq('user_id', req.params.userId).eq('company_id', req.companyId).single();
    if (!target) return res.status(404).json({ error: 'Пользователь не найден' });
    if (target.is_owner) return res.status(403).json({ error: 'Нельзя удалить владельца' });
    await supabase.from('user_profiles').update({ company_id: null, role: 'viewer' }).eq('user_id', req.params.userId);
    res.json({ success: true });
  });

  // ---- Notifications API ----
  app.get("/api/notifications", authMiddleware, async (req: any, res) => {
    const { data: notifications } = await supabase.from('notifications').select('*').eq('user_id', req.user.id).order('created_at', { ascending: false }).limit(50);
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', req.user.id).eq('is_read', false);
    res.json({ notifications: notifications || [], unreadCount: count || 0 });
  });

  app.patch("/api/notifications/:id/read", authMiddleware, async (req: any, res) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', req.params.id).eq('user_id', req.user.id);
    res.json({ success: true });
  });

  app.post("/api/notifications/read-all", authMiddleware, async (req: any, res) => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', req.user.id);
    res.json({ success: true });
  });

  // ---- Schedule / Gantt API ----
  app.get("/api/schedule/:projectId", authMiddleware, async (req: any, res) => {
    const { data, error } = await supabase.from('schedule_tasks').select('*').eq('project_id', req.params.projectId).order('sort_order').order('start_date');
    if (error) return res.status(500).json({ error: error.message });
    res.json(data || []);
  });

  app.post("/api/schedule", authMiddleware, async (req: any, res) => {
    const { project_id, title, start_date, end_date, parent_id, color } = req.body;
    // Get max sort_order
    const { data: maxRow } = await supabase.from('schedule_tasks').select('sort_order').eq('project_id', project_id).order('sort_order', { ascending: false }).limit(1).single();
    const { data, error } = await supabase.from('schedule_tasks').insert({
      project_id, title, start_date, end_date,
      parent_id: parent_id || null,
      color: color || '#6366f1',
      sort_order: (maxRow?.sort_order || 0) + 1
    }).select().single();
    if (error) return res.status(500).json({ error: error.message });
    await createNotification(req.user.id, req.companyId, 'schedule', 'Новый этап', `Добавлен этап "${title}" в график`);
    res.json(data);
  });

  app.patch("/api/schedule/:id", authMiddleware, async (req: any, res) => {
    const { title, start_date, end_date, progress, status, color, sort_order } = req.body;
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (start_date !== undefined) updateData.start_date = start_date;
    if (end_date !== undefined) updateData.end_date = end_date;
    if (progress !== undefined) updateData.progress = progress;
    if (status !== undefined) updateData.status = status;
    if (color !== undefined) updateData.color = color;
    if (sort_order !== undefined) updateData.sort_order = sort_order;
    
    if (Object.keys(updateData).length > 0) {
      await supabase.from('schedule_tasks').update(updateData).eq('id', req.params.id);
    }
    const { data } = await supabase.from('schedule_tasks').select('*').eq('id', req.params.id).single();
    res.json(data);
  });

  app.delete("/api/schedule/:id", authMiddleware, async (req: any, res) => {
    await supabase.from('schedule_tasks').delete().eq('id', req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
