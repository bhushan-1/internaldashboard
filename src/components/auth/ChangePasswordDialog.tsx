import { useState } from "react";
import { useActivityLog } from "@/hooks/useActivityLog";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, Key } from "lucide-react";
import { updatePassword } from "@/lib/db";

export const ChangePasswordDialog = () => {
  const { user } = useAuth();
  const { logActivity } = useActivityLog();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) return "Password must be at least 8 characters long";
    if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter";
    if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter";
    if (!/[0-9]/.test(password)) return "Password must contain at least one number";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return "Password must contain at least one special character";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast.error("Passwords do not match"); return; }
    const validationError = validatePassword(newPassword);
    if (validationError) { toast.error(validationError); return; }
    setIsLoading(true);
    try {
      if (!user) throw new Error("Not logged in");
      const { error } = await updatePassword(user.id, newPassword);
      if (error) { toast.error(error); } else {
        toast.success("Password changed successfully");
        await logActivity({ action: "password_change" });
        setOpen(false); setNewPassword(""); setConfirmPassword("");
      }
    } catch { toast.error("Failed to change password"); }
    finally { setIsLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="border-2"><Key className="w-4 h-4 mr-2" />Change Password</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md border-2">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b-2 border-border pb-4">
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your new password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label htmlFor="new-password">New Password</Label><Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required className="border-2" /></div>
            <div className="space-y-2"><Label htmlFor="confirm-password">Confirm New Password</Label><Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required className="border-2" /></div>
            <p className="text-xs text-muted-foreground">Password must be at least 8 characters with uppercase, lowercase, number, and special character.</p>
          </div>
          <DialogFooter className="border-t-2 border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-2">Cancel</Button>
            <Button type="submit" disabled={isLoading} className="border-2">{isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Change Password</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
