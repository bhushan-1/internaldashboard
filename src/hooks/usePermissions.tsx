import { useAuth } from "./useAuth";

export type ComponentName =
  | "dashboard"
  | "wilddeer"
  | "wilddeer-edit"
  | "confluence"
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
    // If no explicit permission set, default to true for view-level access
    // But for edit-level permissions (like wilddeer-edit), default to false
    if (componentName.endsWith("-edit")) {
      if (!(componentName in (user.permissions || {}))) return false;
      return user.permissions[componentName] === true;
    }
    if (!(componentName in (user.permissions || {}))) return true;
    return user.permissions[componentName] === true;
  };

  return { hasAccess, isLoading, permissions: user?.permissions || {} };
};
