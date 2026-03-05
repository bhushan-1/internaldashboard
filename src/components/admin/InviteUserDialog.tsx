import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, UserPlus, Eye, EyeOff } from "lucide-react";
import { createUser, upsertUserRole } from "@/lib/db";

interface InviteUserDialogProps { onUserInvited: () => void; }

export const InviteUserDialog = ({ onUserInvited }: InviteUserDialogProps) => {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<"admin" | "user">("user");

  const validatePassword = (p: string): string | null => {
    if (p.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(p)) return "Needs an uppercase letter";
    if (!/[a-z]/.test(p)) return "Needs a lowercase letter";
    if (!/[0-9]/.test(p)) return "Needs a number";
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(p)) return "Needs a special character";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Please fill in all fields"); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Invalid email"); return; }
    const pwErr = validatePassword(password);
    if (pwErr) { toast.error(pwErr); return; }

    setIsLoading(true);
    try {
      const { user, error } = await createUser(email, password);
      if (error) { toast.error(error); return; }
      if (user) {
        await upsertUserRole(user.id, role);
        toast.success(`User ${email} created`);
        onUserInvited();
        setOpen(false); setEmail(""); setPassword(""); setRole("user");
      }
    } catch (err) { console.error(err); toast.error("Failed to create user"); }
    finally { setIsLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="border-2"><UserPlus className="w-4 h-4 mr-2" />Add User</Button></DialogTrigger>
      <DialogContent className="sm:max-w-md border-2">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="border-b-2 border-border pb-4"><DialogTitle>Add New User</DialogTitle><DialogDescription>Create a new user with email and password.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2"><Label className="font-mono text-xs uppercase">Email Address</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" required className="border-2" /></div>
            <div className="space-y-2">
              <Label className="font-mono text-xs uppercase">Password</Label>
              <div className="relative">
                <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className="border-2 pr-10" />
                <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
              </div>
              <p className="text-xs text-muted-foreground">Min 8 chars, uppercase, lowercase, number, special character.</p>
            </div>
            <div className="space-y-2"><Label className="font-mono text-xs uppercase">Role</Label>
              <Select value={role} onValueChange={(v) => setRole(v as "admin" | "user")}><SelectTrigger className="border-2"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select>
            </div>
          </div>
          <DialogFooter className="border-t-2 border-border pt-4">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} className="border-2">Cancel</Button>
            <Button type="submit" disabled={isLoading} className="border-2">{isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create User</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
