const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const path = require("path");
const fs = require("fs");
const net = require("net");
const crypto = require("crypto");
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const { Client: SSHClient } = require("ssh2");

// Load production env
require("dotenv").config({ path: path.resolve(__dirname, "..", ".env.production"), override: true });

let jwt;
try { jwt = require("jsonwebtoken"); } catch {
  jwt = require("../node_modules/jsonwebtoken");
}

// ── Config ──
const DB_NAME = process.env.MONGO_DB_NAME || "wildeer";
const COLLECTION = process.env.MONGO_COLLECTION || "admin-users";
const PLANS_COLLECTION = process.env.MONGO_PLANS_COLLECTION || "admin-plans";
const PORT = parseInt(process.env.PORT, 10) || 3002;const REPLICA_SET = process.env.MONGO_REPLICA_SET || "ams3-mongodb-core";
const MONGO_USER = "richie";
const MONGO_PASS = process.env.MONGO_URI ? (process.env.MONGO_URI.match(/:\/\/[^:]+:([^@]+)@/) || [])[1] || "" : "";
const SRV_HOST = "ams3-mongodb-core-0dc7b7be.mongo.ondigitalocean.com";
const CA_FILE = path.resolve(__dirname, "..", process.env.MONGO_TLS_CA_FILE || "server/certs/core-certificate.crt");
const SSH_HOST = process.env.SSH_HOST || "63.142.251.88";
const SSH_PORT = parseInt(process.env.SSH_PORT, 10) || 22;
const SSH_USER = process.env.SSH_USERNAME || "root";
const SSH_KEY = path.resolve(__dirname, "..", process.env.SSH_KEY_FILE || "server/certs/vps_ed25519");

if (!fs.existsSync(CA_FILE)) { console.error("[FATAL] TLS CA not found:", CA_FILE); process.exit(1); }
if (!fs.existsSync(SSH_KEY)) { console.error("[FATAL] SSH key not found:", SSH_KEY); process.exit(1); }

console.log("[Config] Mode: PRODUCTION (data only — auth via dev server)");
console.log("[Config] DB:", DB_NAME, "| Replica:", REPLICA_SET);
console.log("[Config] SSH:", SSH_USER + "@" + SSH_HOST + ":" + SSH_PORT);
console.log("[Config] TLS CA: loaded");
// ── Express App ──
const app = express();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-No-Encrypt");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json());

// ── Security keys (shared with dev — login tokens work on both servers) ──
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY
  ? Buffer.from(process.env.ENCRYPTION_KEY, "hex")
  : crypto.randomBytes(32);
const IV_LENGTH = 16;
console.log("[Security] Shared JWT + AES-256 keys loaded");
function encrypt(data) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let enc = cipher.update(JSON.stringify(data), "utf8", "base64");
  enc += cipher.final("base64");
  return { iv: iv.toString("base64"), data: enc };
}
function sendEncrypted(res, payload) {
  if (res.req && res.req.headers["x-no-encrypt"] === "1") return res.json(payload);
  res.json({ _enc: true, payload: encrypt(payload) });
}

// ══════════════════════════════════════
//  SSH TUNNEL + MONGODB CONNECTION
// ══════════════════════════════════════
let sshConn = null;
let localProxy = null;
let mongoClient = null;
let db = null;

function resolveSRV(hostname) {
  return new Promise((resolve, reject) => {
    dns.resolveSrv("_mongodb._tcp." + hostname, (err, records) => {
      if (err) return reject(err);
      console.log("[DNS] SRV resolved:", records.map(r => r.name + ":" + r.port).join(", "));
      resolve(records);
    });
  });
}
function createSSH() {
  return new Promise((resolve, reject) => {
    const ssh = new SSHClient();
    ssh.on("ready", () => { console.log("[SSH] Connected to", SSH_HOST); resolve(ssh); });
    ssh.on("error", (err) => { console.error("[SSH] Error:", err.message); reject(err); });
    ssh.connect({ host: SSH_HOST, port: SSH_PORT, username: SSH_USER, privateKey: fs.readFileSync(SSH_KEY) });
  });
}

function createLocalProxy(ssh, remoteHost, remotePort) {
  return new Promise((resolve) => {
    const server = net.createServer((socket) => {
      ssh.forwardOut("127.0.0.1", socket.localPort || 0, remoteHost, remotePort, (err, stream) => {
        if (err) { console.error("[Tunnel] Forward error:", err.message); socket.end(); return; }
        socket.pipe(stream).pipe(socket);
        stream.on("error", () => socket.destroy());
        socket.on("error", () => stream.destroy());
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      console.log("[Tunnel] Local proxy 127.0.0.1:" + port + " → " + remoteHost + ":" + remotePort);
      resolve({ server, port });
    });
  });
}
async function connectDB() {
  if (db) return db;
  console.log("[Connect] Resolving SRV for", SRV_HOST);
  const srvRecords = await resolveSRV(SRV_HOST);
  const mongoHost = srvRecords[0].name;
  const mongoPort = srvRecords[0].port;

  console.log("[Connect] Establishing SSH tunnel to", SSH_HOST);
  sshConn = await createSSH();
  const proxy = await createLocalProxy(sshConn, mongoHost, mongoPort);
  localProxy = proxy.server;

  const encodedPass = encodeURIComponent(MONGO_PASS);
  const uri = `mongodb://${MONGO_USER}:${encodedPass}@127.0.0.1:${proxy.port}/${DB_NAME}?authSource=admin&tls=true&directConnection=true`;

  console.log("[Connect] Connecting MongoDB via tunnel (TLS + CA cert)...");
  mongoClient = new MongoClient(uri, {
    tls: true, tlsCAFile: CA_FILE, directConnection: true,
    tlsAllowInvalidHostnames: true,
    serverSelectionTimeoutMS: 15000, connectTimeoutMS: 15000,
  });

  await mongoClient.connect();
  db = mongoClient.db(DB_NAME);
  console.log("[Connect] SUCCESS — Connected to", DB_NAME, "via SSH tunnel");
  return db;
}
// ── Auth middleware (validates JWT from dev server — shared secret) ──
// No auth endpoints here. Login/users always go through dev server (port 3001).
function requireAuth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
  try { req.user = jwt.verify(h.split(" ")[1], JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "Token expired — re-login via dev server" }); }
}

// ══════════════════════════════════════
//  DATA ENDPOINTS ONLY (no auth writes)
// ══════════════════════════════════════
app.get("/api/accounts", requireAuth, async (req, res) => {
  try {
    const d = await connectDB();
    const limit = parseInt(req.query.limit, 10) || 100;
    const skip = parseInt(req.query.skip, 10) || 0;
    const total = await d.collection(COLLECTION).countDocuments();
    const docs = await d.collection(COLLECTION).find({}).sort({ _id: -1 }).skip(skip).limit(limit).toArray();
    sendEncrypted(res, { success: true, data: docs, total, limit, skip });
  } catch (err) { sendEncrypted(res, { success: false, error: err.message }); }
});
app.get("/api/accounts/search", requireAuth, async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    if (!q) return sendEncrypted(res, { success: true, data: [], total: 0 });
    const d = await connectDB();
    const regex = { $regex: q, $options: "i" };
    const filter = {
      $or: [
        { userEmail: regex }, { userUserName: regex }, { userFirstName: regex },
        { userLastName: regex }, { userDisplayName: regex }, { userCompanyName: regex },
        { userPhoneNumber: regex }, { planId: regex }, { appName: regex },
        { stripeCustomerId: regex }, { stripeSubscriptionId: regex },
      ],
    };
    const docs = await d.collection(COLLECTION).find(filter).toArray();
    sendEncrypted(res, { success: true, data: docs, total: docs.length });
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
    const docs = await d.collection(PLANS_COLLECTION).find({}).toArray();
    sendEncrypted(res, { success: true, data: docs });
  } catch (err) { sendEncrypted(res, { success: false, error: err.message }); }
});

app.get("/api/health", async (req, res) => {
  try {
    const d = await connectDB();
    await d.command({ ping: 1 });
    res.json({ success: true, db: DB_NAME, mode: "production", ssh: SSH_HOST });
  } catch (err) { res.status(500).json({ success: false, error: err.message }); }
});

app.get("/api/env", (req, res) => {
  res.json({ mode: "production", database: DB_NAME, replicaSet: REPLICA_SET, sshHost: SSH_HOST });
});
// ── Serve frontend ──
const distPath = path.resolve(__dirname, "..", "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    if (!req.path.startsWith("/api")) res.sendFile(path.join(distPath, "index.html"));
  });
}

// ── Cleanup ──
function cleanup() {
  console.log("\n[Cleanup] Shutting down...");
  if (mongoClient) mongoClient.close().catch(() => {});
  if (localProxy) localProxy.close();
  if (sshConn) sshConn.end();
  process.exit(0);
}
process.on("SIGINT", cleanup);
process.on("uncaughtException", (err) => { console.error("[FATAL]", err.message); cleanup(); });

// ── Start (no seedAdmin — auth is dev-only) ──
app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  PRODUCTION MongoDB Proxy (data only)        ║`);
  console.log(`║  http://localhost:${PORT}                      ║`);
  console.log(`║  SSH  → ${SSH_USER}@${SSH_HOST}:${SSH_PORT}`);
  console.log(`║  DB   → ${DB_NAME} (${REPLICA_SET})`);
  console.log(`║  Auth → via dev server (shared JWT)          ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});