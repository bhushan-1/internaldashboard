export { getDb, persistDb, resetDb, dbRun, dbQuery } from "./database";
export { signInWithPassword, signOut, updatePassword, createUser, listUsers, getStoredSession } from "./auth";
export type { LocalUser, LocalSession } from "./auth";
export {
  getUserRole, upsertUserRole, getAllRoles,
  getUserPermissions, getAllPermissions, upsertPermission,
  insertActivityLog, getActivityLogs,
  getUserAccounts, updateUserAccount, deleteUserAccount,
} from "./queries";
export type { ActivityLogEntry, UserAccountRow } from "./queries";
