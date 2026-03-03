import express from "express";
console.log("🟢 SERVER.TS IS EXECUTING");
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

let db: any;
try {
  db = new Database("health_declarations.db");
  // Initialize database
  db.exec(`
    CREATE TABLE IF NOT EXISTS declarations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT,
      etablissement TEXT,
      etablissement_id TEXT,
      status TEXT,
      cases TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  console.log("✅ Database initialized");
} catch (dbError) {
  console.error("❌ Database initialization failed:", dbError);
  // Fallback to a mock DB or just continue to allow the server to start
  db = {
    prepare: () => ({ all: () => [], run: () => {} }),
    exec: () => {}
  };
}

// Migration robuste : Vérifier si les colonnes existent
const tableInfo = db.prepare("PRAGMA table_info(declarations)").all();
const hasEtablissement = tableInfo.some((col: any) => col.name === 'etablissement');
const hasEtablissementId = tableInfo.some((col: any) => col.name === 'etablissement_id');

if (!hasEtablissement) {
  try {
    db.exec("ALTER TABLE declarations ADD COLUMN etablissement TEXT DEFAULT 'Inconnu'");
  } catch (e) {}
}

if (!hasEtablissementId) {
  try {
    db.exec("ALTER TABLE declarations ADD COLUMN etablissement_id TEXT DEFAULT ''");
    console.log("✅ Colonne 'etablissement_id' ajoutée.");
  } catch (e) {}
}

// Index unique pour éviter les doublons par date et établissement ID
try {
  db.exec("DROP INDEX IF EXISTS idx_date_etab");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_date_etab_id ON declarations(date, etablissement_id)");
} catch (e) {
  console.error("❌ Erreur création index:", e);
}

async function startServer() {
  console.log("🎬 Starting server initialization...");
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get("/api/health", (req, res) => {
    console.log("💓 Health check requested");
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // API Routes
  app.get("/api/declarations", (req, res) => {
    const etablissementId = req.query.etablissement_id;
    try {
      const rows = etablissementId 
        ? db.prepare("SELECT * FROM declarations WHERE etablissement_id = ?").all(etablissementId)
        : db.prepare("SELECT * FROM declarations").all();
      res.json(rows.map((row: any) => ({
        ...row,
        cases: row.cases ? JSON.parse(row.cases) : []
      })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/declarations", (req, res) => {
    const { date, status, cases, etablissement, etablissement_id } = req.body;
    try {
      const stmt = db.prepare(
        "INSERT OR REPLACE INTO declarations (date, status, cases, etablissement, etablissement_id) VALUES (?, ?, ?, ?, ?)"
      );
      stmt.run(date, status, JSON.stringify(cases), etablissement || "Inconnu", etablissement_id || "");
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Robust Frontend Serving
  const distPath = path.resolve("dist");
  const indexPath = path.join(distPath, "index.html");
  
  if (fs.existsSync(distPath)) {
    console.log("🚀 Production mode: Serving static files from dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (req.url.startsWith('/api')) return res.status(404).json({ error: "API not found" });
      res.sendFile(indexPath);
    });
  } else {
    console.log("🛠️ Development mode: Starting Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicit catch-all for SPA in dev mode
    app.get("*", async (req, res, next) => {
      if (req.url.startsWith('/api')) return next();
      try {
        const template = fs.readFileSync(path.resolve("index.html"), "utf-8");
        const html = await vite.transformIndexHtml(req.url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 SERVER IS LIVE at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("💥 CRITICAL SERVER ERROR:", err);
});
