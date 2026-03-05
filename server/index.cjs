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
  });
})();
