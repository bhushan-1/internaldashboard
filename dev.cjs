const { spawn } = require("child_process");
const path = require("path");

const ROOT = __dirname;

// Start MongoDB proxy server
const mongo = spawn("node", [path.join(ROOT, "server", "index.cjs")], {
  cwd: ROOT, stdio: "pipe", shell: true
});

mongo.stdout.on("data", (d) => process.stdout.write(`[mongo] ${d}`));
mongo.stderr.on("data", (d) => process.stderr.write(`[mongo] ${d}`));
mongo.on("exit", (code) => console.log(`[mongo] exited (${code})`));

// Start Vite dev server
const vite = spawn("npx", ["vite"], {
  cwd: ROOT, stdio: "pipe", shell: true
});

vite.stdout.on("data", (d) => process.stdout.write(`[vite]  ${d}`));
vite.stderr.on("data", (d) => process.stderr.write(`[vite]  ${d}`));
vite.on("exit", (code) => {
  console.log(`[vite]  exited (${code})`);
  mongo.kill();
  process.exit(code);
});

// Cleanup on Ctrl+C
process.on("SIGINT", () => { mongo.kill(); vite.kill(); process.exit(0); });
process.on("SIGTERM", () => { mongo.kill(); vite.kill(); process.exit(0); });

console.log("[dev] Starting Vite + MongoDB proxy...\n");
