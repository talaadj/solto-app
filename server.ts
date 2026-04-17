import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("buildflow.db");

// Supabase Client (Server-side)
const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER,
    title TEXT,
    description TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved, procurement, purchased, delivered
    foreman_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(project_id) REFERENCES projects(id)
  );

  CREATE TABLE IF NOT EXISTS procurement_offers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id INTEGER,
    supplier_name TEXT,
    supplier_phone TEXT,
    supplier_email TEXT,
    supplier_address TEXT,
    rating REAL,
    price REAL,
    details TEXT,
    source_url TEXT,
    reliability_score INTEGER,
    risk_assessment TEXT,
    status TEXT DEFAULT 'pending', -- pending, approved
    FOREIGN KEY(request_id) REFERENCES requests(id)
  );

  CREATE TABLE IF NOT EXISTS inventory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_name TEXT UNIQUE,
    quantity REAL DEFAULT 0,
    unit TEXT
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT, -- expense, income
    amount REAL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.prepare("ALTER TABLE procurement_offers ADD COLUMN reliability_score INTEGER").run();
} catch (e) {
  // Column might already exist
}

try {
  db.prepare("ALTER TABLE procurement_offers ADD COLUMN risk_assessment TEXT").run();
} catch (e) {
  // Column might already exist
}

// Migration: Ensure project_id exists in requests table
const tableInfo = db.prepare("PRAGMA table_info(requests)").all() as any[];
const hasProjectId = tableInfo.some(col => col.name === 'project_id');
if (!hasProjectId) {
  db.exec("ALTER TABLE requests ADD COLUMN project_id INTEGER REFERENCES projects(id)");
}

// Migration: Ensure supplier_address and rating exist in procurement_offers table
const offerTableInfo = db.prepare("PRAGMA table_info(procurement_offers)").all() as any[];
const hasSupplierAddress = offerTableInfo.some(col => col.name === 'supplier_address');
if (!hasSupplierAddress) {
  db.exec("ALTER TABLE procurement_offers ADD COLUMN supplier_address TEXT");
}
const hasRating = offerTableInfo.some(col => col.name === 'rating');
if (!hasRating) {
  db.exec("ALTER TABLE procurement_offers ADD COLUMN rating REAL");
}
const hasSourceUrl = offerTableInfo.some(col => col.name === 'source_url');
if (!hasSourceUrl) {
  db.exec("ALTER TABLE procurement_offers ADD COLUMN source_url TEXT");
}

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // API Routes
  app.get("/api/projects", (req, res) => {
    const rows = db.prepare("SELECT * FROM projects ORDER BY created_at DESC").all();
    res.json(rows);
  });

  app.post("/api/projects", (req, res) => {
    const { name, address } = req.body;
    const info = db.prepare("INSERT INTO projects (name, address) VALUES (?, ?)").run(name, address);
    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/requests", (req, res) => {
    const { project_id } = req.query;
    let query = "SELECT * FROM requests";
    let params = [];
    if (project_id) {
      query += " WHERE project_id = ?";
      params.push(project_id);
    }
    query += " ORDER BY created_at DESC";
    const rows = db.prepare(query).all(...params);
    res.json(rows);
  });

  app.post("/api/requests", (req, res) => {
    const { project_id, title, description, foreman_id } = req.body;
    const info = db.prepare("INSERT INTO requests (project_id, title, description, foreman_id) VALUES (?, ?, ?, ?)").run(project_id, title, description, foreman_id);
    res.json({ id: info.lastInsertRowid });
  });

  app.patch("/api/requests/:id", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE requests SET status = ? WHERE id = ?").run(status, req.params.id);
    res.json({ success: true });
  });

  app.delete("/api/requests/:id", (req, res) => {
    db.prepare("DELETE FROM requests WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/procurement/:requestId", (req, res) => {
    const rows = db.prepare("SELECT * FROM procurement_offers WHERE request_id = ?").all(req.params.requestId);
    res.json(rows);
  });

  app.patch("/api/procurement/:id", (req, res) => {
    const { status } = req.body;
    db.prepare("UPDATE procurement_offers SET status = ? WHERE id = ?").run(status, req.params.id);
    res.json({ success: true });
  });

  app.post("/api/procurement", async (req, res) => {
    const { request_id, supplier_name, supplier_phone, supplier_email, supplier_address, rating, price, details, source_url, reliability_score, risk_assessment } = req.body;
    const info = db.prepare("INSERT INTO procurement_offers (request_id, supplier_name, supplier_phone, supplier_email, supplier_address, rating, price, details, source_url, reliability_score, risk_assessment) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
      request_id ?? null, 
      supplier_name ?? 'Неизвестный поставщик', 
      supplier_phone ?? '', 
      supplier_email ?? '', 
      supplier_address ?? '', 
      rating ?? 0, 
      price ?? 0, 
      details ?? '', 
      source_url || null, 
      reliability_score ?? null, 
      risk_assessment || null
    );
    
    // Sync to Supabase suppliers table
    if (supabaseUrl && supabaseAnonKey) {
      try {
        await supabase.from('suppliers').upsert({
          name: supplier_name,
          phone: supplier_phone,
          email: supplier_email,
          address: supplier_address,
          rating: rating
        }, { onConflict: 'name' });
      } catch (e) {
        console.error("Failed to sync supplier to Supabase:", e);
      }
    }

    res.json({ id: info.lastInsertRowid });
  });

  app.get("/api/inventory", (req, res) => {
    const rows = db.prepare("SELECT * FROM inventory").all();
    res.json(rows);
  });

  app.post("/api/inventory/update", (req, res) => {
    const { item_name, quantity, unit } = req.body;
    const existing = db.prepare("SELECT * FROM inventory WHERE item_name = ?").get(item_name);
    if (existing) {
      db.prepare("UPDATE inventory SET quantity = quantity + ? WHERE item_name = ?").run(quantity, item_name);
    } else {
      db.prepare("INSERT INTO inventory (item_name, quantity, unit) VALUES (?, ?, ?)").run(item_name, quantity, unit);
    }
    res.json({ success: true });
  });

  app.get("/api/transactions", (req, res) => {
    const rows = db.prepare("SELECT * FROM transactions ORDER BY created_at DESC").all();
    res.json(rows);
  });

  app.post("/api/transactions", (req, res) => {
    const { type, amount, description } = req.body;
    const info = db.prepare("INSERT INTO transactions (type, amount, description) VALUES (?, ?, ?)").run(type, amount, description);
    res.json({ id: info.lastInsertRowid });
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
