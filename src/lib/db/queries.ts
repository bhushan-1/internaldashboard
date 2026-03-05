import { getDb, persistDb, dbRun, dbQuery } from "./database";

// ───── User Roles ─────
export async function getUserRole(userId: string): Promise<"admin" | "user"> {
  const db = await getDb();
  const r = dbQuery(db, "SELECT role FROM user_roles WHERE user_id = ?", [userId]);
  if (r.length && r[0].values.length) return r[0].values[0][0] as "admin" | "user";
  return "user";
}

export async function upsertUserRole(userId: string, role: "admin" | "user") {
  const db = await getDb();
  const existing = dbQuery(db, "SELECT id FROM user_roles WHERE user_id = ?", [userId]);
  const now = new Date().toISOString();
  if (existing.length && existing[0].values.length) {
    dbRun(db, "UPDATE user_roles SET role = ?, updated_at = ? WHERE user_id = ?", [role, now, userId]);
  } else {
    dbRun(db, "INSERT INTO user_roles (id, user_id, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      [crypto.randomUUID(), userId, role, now, now]);
  }
  persistDb();
}

export async function getAllRoles() {
  const db = await getDb();
  const r = db.exec("SELECT user_id, role, created_at FROM user_roles");
  if (!r.length) return [];
  return r[0].values.map(([user_id, role, created_at]) => ({
    user_id: user_id as string, role: role as string, created_at: created_at as string,
  }));
}

// ───── User Permissions ─────
export async function getUserPermissions(userId: string) {
  const db = await getDb();
  const r = dbQuery(db, "SELECT component_name, has_access FROM user_permissions WHERE user_id = ?", [userId]);
  if (!r.length) return [];
  return r[0].values.map(([component_name, has_access]) => ({
    component_name: component_name as string,
    has_access: Boolean(has_access),
  }));
}

export async function getAllPermissions() {
  const db = await getDb();
  const r = db.exec("SELECT user_id, component_name, has_access FROM user_permissions");
  if (!r.length) return [];
  return r[0].values.map(([user_id, component_name, has_access]) => ({
    user_id: user_id as string,
    component_name: component_name as string,
    has_access: Boolean(has_access),
  }));
}

export async function upsertPermission(userId: string, componentName: string, hasAccess: boolean) {
  const db = await getDb();
  const now = new Date().toISOString();
  const existing = dbQuery(db,
    "SELECT id FROM user_permissions WHERE user_id = ? AND component_name = ?",
    [userId, componentName]
  );
  if (existing.length && existing[0].values.length) {
    dbRun(db, "UPDATE user_permissions SET has_access = ?, updated_at = ? WHERE user_id = ? AND component_name = ?",
      [hasAccess ? 1 : 0, now, userId, componentName]);
  } else {
    dbRun(db, "INSERT INTO user_permissions (id, user_id, component_name, has_access, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
      [crypto.randomUUID(), userId, componentName, hasAccess ? 1 : 0, now, now]);
  }
  persistDb();
}

// ───── Activity Logs ─────
export interface ActivityLogEntry {
  id: string;
  user_id: string | null;
  user_email: string;
  user_role: string;
  action: string;
  component_name: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export async function insertActivityLog(log: Omit<ActivityLogEntry, "id" | "created_at">) {
  const db = await getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  dbRun(db,
    `INSERT INTO activity_logs (id, user_id, user_email, user_role, action, component_name, details, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, log.user_id, log.user_email, log.user_role, log.action, log.component_name, log.details, log.ip_address, now]
  );
  persistDb();
}

export async function getActivityLogs(limit = 100): Promise<ActivityLogEntry[]> {
  const db = await getDb();
  const r = db.exec(`SELECT id, user_id, user_email, user_role, action, component_name, details, ip_address, created_at
    FROM activity_logs ORDER BY created_at DESC LIMIT ${limit}`);
  if (!r.length) return [];
  const cols = ["id","user_id","user_email","user_role","action","component_name","details","ip_address","created_at"];
  return r[0].values.map(row => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c, i) => { obj[c] = row[i]; });
    return obj as unknown as ActivityLogEntry;
  });
}

// ───── User Accounts (WildDeer table) ─────
export interface UserAccountRow {
  id: string;
  user_id: string;
  user_email: string | null;
  user_user_name: string | null;
  api_key: string | null;
  app_name: string | null;
  plan_id: string | null;
  stripe_customer_id: string | null;
  has_payment_problem: boolean;
  is_admin_blocked: boolean;
  is_user_email_verified: boolean;
  plan_free_top_up_credits: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

export async function getUserAccounts(limit = 100): Promise<UserAccountRow[]> {
  const db = await getDb();
  const r = db.exec(`SELECT * FROM user_accounts ORDER BY created_at DESC LIMIT ${limit}`);
  if (!r.length) return [];
  const cols = r[0].columns;
  return r[0].values.map(row => {
    const obj: Record<string, unknown> = {};
    cols.forEach((c, i) => {
      const v = row[i];
      if (["has_payment_problem","is_admin_blocked","is_multi_free_trial_blocked","is_test_mode","is_user_email_verified","on_yearly_plan"].includes(c)) {
        obj[c] = Boolean(v);
      } else {
        obj[c] = v;
      }
    });
    return obj as unknown as UserAccountRow;
  });
}

export async function updateUserAccount(id: string, updates: Record<string, unknown>) {
  const db = await getDb();
  const now = new Date().toISOString();
  const entries = Object.entries(updates).filter(([k]) => k !== "id");
  if (!entries.length) return;
  const sets = entries.map(([k]) => `${k} = ?`).join(", ");
  const vals = entries.map(([, v]) => {
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "object" && v !== null) return JSON.stringify(v);
    return v;
  });
  dbRun(db, `UPDATE user_accounts SET ${sets}, updated_at = ? WHERE id = ?`, [...vals, now, id]);
  persistDb();
}

export async function deleteUserAccount(id: string) {
  const db = await getDb();
  dbRun(db, "DELETE FROM user_accounts WHERE id = ?", [id]);
  persistDb();
}
