import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions, ComponentName } from "@/hooks/usePermissions";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: ReactNode;
  componentName?: ComponentName;
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({ 
  children, 
  componentName,
  requireAdmin = false 
}: ProtectedRouteProps) => {
  const { user, isLoading: authLoading, isAdmin } = useAuth();
  const { hasAccess, isLoading: permLoading } = usePermissions();

  if (authLoading || permLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (componentName && !hasAccess(componentName)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
