const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const crypto = require("crypto");
const express = require("express");
const bcrypt = require("bcryptjs");
const { MongoClient, ObjectId } = require("mongodb");

let jwt;
try { jwt = require("jsonwebtoken"); } catch {
  jwt = require("../node_modules/jsonwebtoken");
}

const app = express();

// ── CORS ──
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json());

// ── Config ──
const MONGO_URI = "mongodb+srv://bhushandasari_db_user:xQL1NV0sZHs7Iygg@cluster25.twjatkb.mongodb.net/";
const DB_NAME = "Test30";
const COLLECTION = "Test user details";
const AUTH_COLLECTION = "_td_users";
const PORT = 3001;

// Anthropic API key for Confluence AI
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

// ── Security keys (fresh each server start) ──
const JWT_SECRET = crypto.randomBytes(32).toString("hex");
const ENCRYPTION_KEY = crypto.randomBytes(32);
const IV_LENGTH = 16;
console.log("[Security] JWT and AES-256 keys generated");

// ── Encryption ──
function encrypt(data) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let enc = cipher.update(JSON.stringify(data), "utf8", "base64");
  enc += cipher.final("base64");
  return { iv: iv.toString("base64"), data: enc };
}
function sendEncrypted(res, payload) {
  res.json({ _enc: true, payload: encrypt(payload) });
}

// ── MongoDB ──
let client, db;
async function connectDB() {
  if (db) return db;
  client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db(DB_NAME);
  console.log("[DB] Connected:", DB_NAME);
  return db;
}

// ── Seed default admin ──
async function seedAdmin() {
  const d = await connectDB();
  const col = d.collection(AUTH_COLLECTION);
  const existing = await col.findOne({ email: "admin@trajectdata.com" });
  if (!existing) {
    const hash = bcrypt.hashSync("Admin@123", 10);
    await col.insertOne({
      email: "admin@trajectdata.com",
      passwordHash: hash,
      role: "admin",
      permissions: {},
      createdAt: new Date().toISOString(),
    });
    console.log("[Auth] Seeded admin: admin@trajectdata.com / Admin@123");
  } else {
    console.log("[Auth] Admin user exists");
  }
}

// ── Auth middleware ──
function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try {
    req.user = jwt.verify(h.split(" ")[1], JWT_SECRET);
    next();
  } catch { return res.status(401).json({ error: "Token expired" }); }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
  next();
}

// ══════════════════════════════════════
//  AUTH ENDPOINTS
// ══════════════════════════════════════

// Login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const d = await connectDB();
    const user = await d.collection(AUTH_COLLECTION).findOne({ email });
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: "Invalid email or password" });
    }
    const token = jwt.sign(
      { userId: user._id.toString(), email: user.email, role: user.role },
      JWT_SECRET, { expiresIn: "8h" }
    );
    res.json({
      token,
      encKey: ENCRYPTION_KEY.toString("hex"),
      user: { id: user._id.toString(), email: user.email, role: user.role },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get current user
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const d = await connectDB();
    const user = await d.collection(AUTH_COLLECTION).findOne({ _id: new ObjectId(req.user.userId) });
    if (!user) return res.status(404).json({ error: "User not found" });
    sendEncrypted(res, {
      id: user._id.toString(), email: user.email, role: user.role,
      permissions: user.permissions || {},
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List all users (admin only)
app.get("/api/auth/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const d = await connectDB();
    const users = await d.collection(AUTH_COLLECTION).find({}, { projection: { passwordHash: 0 } }).toArray();
    sendEncrypted(res, users.map(u => ({
      id: u._id.toString(), email: u.email, role: u.role,
      permissions: u.permissions || {}, createdAt: u.createdAt,
    })));
  } catch (err) { sendEncrypted(res, { error: err.message }); }
});

// Create user (admin only)
app.post("/api/auth/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, password, role } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const d = await connectDB();
    const existing = await d.collection(AUTH_COLLECTION).findOne({ email });
    if (existing) return res.status(409).json({ error: "User already exists" });
    const hash = bcrypt.hashSync(password, 10);
    const result = await d.collection(AUTH_COLLECTION).insertOne({
      email, passwordHash: hash, role: role || "user",
      permissions: {}, createdAt: new Date().toISOString(),
    });
    sendEncrypted(res, { success: true, id: result.insertedId.toString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update user role (admin only)
app.put("/api/auth/users/:id/role", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { role } = req.body;
    if (!["admin", "user"].includes(role)) return res.status(400).json({ error: "Invalid role" });
    const d = await connectDB();
    await d.collection(AUTH_COLLECTION).updateOne(
      { _id: new ObjectId(req.params.id) }, { $set: { role } }
    );
    sendEncrypted(res, { success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update user permissions (admin only)
app.put("/api/auth/users/:id/permissions", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { permissions } = req.body; // { dashboard: true, wilddeer: false, ... }
    if (!permissions || typeof permissions !== "object") return res.status(400).json({ error: "Invalid permissions" });
    const d = await connectDB();
    await d.collection(AUTH_COLLECTION).updateOne(
      { _id: new ObjectId(req.params.id) }, { $set: { permissions } }
    );
    sendEncrypted(res, { success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete user (admin only)
app.delete("/api/auth/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    if (req.user.userId === req.params.id) return res.status(400).json({ error: "Cannot delete yourself" });
    const d = await connectDB();
    await d.collection(AUTH_COLLECTION).deleteOne({ _id: new ObjectId(req.params.id) });
    sendEncrypted(res, { success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Change password
app.put("/api/auth/password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Both passwords required" });
    const d = await connectDB();
    const user = await d.collection(AUTH_COLLECTION).findOne({ _id: new ObjectId(req.user.userId) });
    if (!user || !bcrypt.compareSync(currentPassword, user.passwordHash)) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }
    const hash = bcrypt.hashSync(newPassword, 10);
    await d.collection(AUTH_COLLECTION).updateOne(
      { _id: new ObjectId(req.user.userId) }, { $set: { passwordHash: hash } }
    );
    sendEncrypted(res, { success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ══════════════════════════════════════
//  DATA ENDPOINTS (existing)
// ══════════════════════════════════════
app.get("/api/accounts", requireAuth, async (req, res) => {
  try {
    const d = await connectDB();
    const docs = await d.collection(COLLECTION).find({}).limit(500).toArray();
    sendEncrypted(res, { success: true, data: docs });
  } catch (err) { sendEncrypted(res, { success: false, error: err.message }); }
});

app.put("/api/accounts/:id", requireAuth, async (req, res) => {
  try {
    const d = await connectDB();
    const updates = { ...req.body }; delete updates._id;
    const r = await d.collection(COLLECTION).updateOne({ _id: new ObjectId(req.params.id) }, { $set: updates });
    sendEncrypted(res, { success: true, modifiedCount: r.modifiedCount });
  } catch (err) { sendEncrypted(res, { success: false, error: err.message }); }
});

app.delete("/api/accounts/:id", requireAuth, async (req, res) => {
  try {
    const d = await connectDB();
    const r = await d.collection(COLLECTION).deleteOne({ _id: new ObjectId(req.params.id) });
    sendEncrypted(res, { success: true, deletedCount: r.deletedCount });
  } catch (err) { sendEncrypted(res, { success: false, error: err.message }); }
});

app.post("/api/accounts", requireAuth, async (req, res) => {
  try {
    const d = await connectDB();
    const r = await d.collection(COLLECTION).insertOne(req.body);
    sendEncrypted(res, { success: true, insertedId: r.insertedId });
  } catch (err) { sendEncrypted(res, { success: false, error: err.message }); }
});

app.get("/api/plans", requireAuth, async (req, res) => {
  try {
    const d = await connectDB();
    const docs = await d.collection("Plans").find({}).toArray();
    sendEncrypted(res, { success: true, data: docs });
  } catch (err) { sendEncrypted(res, { success: false, error: err.message }); }
});

// ══════════════════════════════════════
//  CONFLUENCE / KNOWLEDGE BASE
// ══════════════════════════════════════
const KB_COLLECTION = "_td_knowledge_base";

// Upload document (admin only)
app.post("/api/confluence/documents", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, content, category } = req.body;
    if (!title || !content) return res.status(400).json({ error: "Title and content required" });
    const d = await connectDB();
    const r = await d.collection(KB_COLLECTION).insertOne({
      title, content, category: category || "General",
      uploadedBy: req.user.email, uploadedAt: new Date().toISOString(),
    });
    sendEncrypted(res, { success: true, id: r.insertedId.toString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// List documents
app.get("/api/confluence/documents", requireAuth, async (req, res) => {
  try {
    const d = await connectDB();
    const docs = await d.collection(KB_COLLECTION).find({}).sort({ uploadedAt: -1 }).toArray();
    sendEncrypted(res, { success: true, data: docs.map(d => ({
      id: d._id.toString(), title: d.title, content: d.content,
      category: d.category, uploadedBy: d.uploadedBy, uploadedAt: d.uploadedAt,
    })) });
  } catch (err) { sendEncrypted(res, { success: false, error: err.message }); }
});

// Delete document (admin only)
app.delete("/api/confluence/documents/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const d = await connectDB();
    await d.collection(KB_COLLECTION).deleteOne({ _id: new ObjectId(req.params.id) });
    sendEncrypted(res, { success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Ask AI - searches documents, calls Anthropic API, returns answer
app.post("/api/confluence/ask", requireAuth, async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: "Question required" });
    const d = await connectDB();
    const docs = await d.collection(KB_COLLECTION).find({}).toArray();

    // Simple keyword search — score documents by matching words
    const qWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    const scored = docs.map(doc => {
      const text = (doc.title + " " + doc.content + " " + doc.category).toLowerCase();
      const score = qWords.reduce((s, w) => s + (text.includes(w) ? 1 : 0), 0);
      return { ...doc, score };
    }).filter(d => d.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);

    const context = scored.length > 0
      ? scored.map(d => `[${d.title}] (${d.category})\n${d.content}`).join("\n\n---\n\n")
      : "No relevant documents found.";

    // Call Anthropic API server-side
    let answer = "No relevant documents found to answer your question. Please ask an admin to upload related documents.";
    if (scored.length > 0 && ANTHROPIC_API_KEY) {
      try {
        const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1024,
            system: `You are an internal knowledge assistant for TrajectData. Answer questions ONLY using the provided document context. If the context doesn't contain relevant information, say so clearly. Be concise and helpful. Do not make up information.\n\nDocument context:\n${context}`,
            messages: [{ role: "user", content: question }],
          }),
        });
        const apiData = await apiRes.json();
        if (apiData.content) {
          answer = apiData.content.map(b => b.type === "text" ? b.text : "").filter(Boolean).join("\n");
        } else if (apiData.error) {
          answer = `AI service error: ${apiData.error.message || "Unknown error"}. The matched documents are still available.`;
        }
      } catch (apiErr) {
        console.error("[Confluence] Anthropic API error:", apiErr.message);
        answer = `Could not reach AI service. Here's what I found in ${scored.length} document(s):\n\n${scored.map(d => `• ${d.title}: ${d.content.slice(0, 200)}...`).join("\n")}`;
      }
    } else if (!ANTHROPIC_API_KEY) {
      // No API key — return document excerpts as fallback
      answer = scored.length > 0
        ? `[AI key not configured — showing raw matches]\n\n${scored.map(d => `📄 ${d.title} (${d.category}):\n${d.content.slice(0, 300)}${d.content.length > 300 ? "..." : ""}`).join("\n\n")}`
        : "No relevant documents found. Ask an admin to upload related documents.";
    }

    // Build source references
    const sourceDocs = scored.map(d => ({ id: d._id.toString(), title: d.title, category: d.category, excerpt: d.content.slice(0, 150) }));

    sendEncrypted(res, { success: true, answer, matchCount: scored.length, totalDocs: docs.length, sourceDocs });
  } catch (err) { sendEncrypted(res, { success: false, error: err.message }); }
});

app.get("/api/health", async (req, res) => {
  try {
    const d = await connectDB();
    await d.command({ ping: 1 });
    res.json({ success: true, db: DB_NAME, mode: "development" });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get("/api/env", (req, res) => {
  res.json({ mode: "development", database: DB_NAME });
});

// ── Start ──
(async () => {
  try {
    await seedAdmin();
  } catch (e) { console.error("[Auth] Seed failed:", e.message); }
  app.listen(PORT, () => {
    console.log("[Server] Running on http://localhost:" + PORT);
    console.log("[Security] Auth + AES-256 encryption active");
    console.log("[Confluence] AI mode:", ANTHROPIC_API_KEY ? "Anthropic API (full AI answers)" : "Fallback (document excerpts only — set ANTHROPIC_API_KEY for AI)");
  });
})();
