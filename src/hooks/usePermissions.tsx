import { useAuth } from "./useAuth";

export type ComponentName =
  | "dashboard"
  | "wilddeer"
  | "credits"
  | "account-lookup"
  | "stripe"
  | "users"
  | "activity";

export const usePermissions = () => {
  const { user, isAdmin, isLoading } = useAuth();

  const hasAccess = (componentName: ComponentName): boolean => {
    if (isAdmin) return true;
    if (!user) return false;
    // If no explicit permission set, default to true
    if (!(componentName in (user.permissions || {}))) return true;
    return user.permissions[componentName] === true;
  };

  return { hasAccess, isLoading, permissions: user?.permissions || {} };
};
