import { useAuth } from "./useAuth";

type ActionType =
  | "login"
  | "logout"
  | "password_change"
  | "component_access"
  | "credit_update"
  | "account_lookup"
  | "permission_change"
  | "role_change";

interface LogActivityParams {
  action: ActionType;
  componentName?: string;
  details?: Record<string, unknown>;
}

export const useActivityLog = () => {
  const { user, userRole } = useAuth();

  const logActivity = async ({ action, componentName, details }: LogActivityParams) => {
    if (!user) return;
    console.log(`[Activity] ${user.email} (${userRole}) → ${action}`, componentName || "", details || "");
  };

  return { logActivity };
};
