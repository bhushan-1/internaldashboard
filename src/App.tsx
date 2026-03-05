import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import UsersPage from "./pages/UsersPage";
import ActivityPage from "./pages/ActivityPage";
import WildDeerPage from "./pages/WildDeerPage";
import StripePage from "./pages/StripePage";
import CreditsPage from "./pages/CreditsPage";
import AccountLookupPage from "./pages/AccountLookupPage";
import SettingsPage from "./pages/SettingsPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";
import LoginPage from "./pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={
              <ProtectedRoute componentName="dashboard">
                <Index />
              </ProtectedRoute>
            } />
            <Route path="/users" element={
              <ProtectedRoute componentName="users">
                <UsersPage />
              </ProtectedRoute>
            } />
            <Route path="/activity" element={
              <ProtectedRoute componentName="activity">
                <ActivityPage />
              </ProtectedRoute>
            } />
            <Route path="/wilddeer" element={
              <ProtectedRoute componentName="wilddeer">
                <WildDeerPage />
              </ProtectedRoute>
            } />
            <Route path="/stripe" element={
              <ProtectedRoute componentName="stripe">
                <StripePage />
              </ProtectedRoute>
            } />
            <Route path="/credits" element={
              <ProtectedRoute componentName="credits">
                <CreditsPage />
              </ProtectedRoute>
            } />
            <Route path="/account-lookup" element={
              <ProtectedRoute componentName="account-lookup">
                <AccountLookupPage />
              </ProtectedRoute>
            } />
            <Route path="/settings" element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin>
                <AdminSettingsPage />
              </ProtectedRoute>
            } />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
