import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, Users, Loader2, Save, UserPlus, Trash2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  listUsers, createUser, updateUserRole, updateUserPermissions, deleteUser,
  type AuthUser,
} from "@/lib/authApi";

const COMPONENTS = [
  { name: "dashboard", label: "Dashboard" },
  { name: "wilddeer", label: "WildDeer" },
  { name: "credits", label: "Credits" },
  { name: "account-lookup", label: "Account Lookup" },
  { name: "stripe", label: "Stripe" },
  { name: "users", label: "Users" },
  { name: "activity", label: "Activity" },
];

const AdminSettingsPage = () => {
  const { user: currentUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingRoles, setPendingRoles] = useState<Record<string, "admin" | "user">>({});
  const [pendingPerms, setPendingPerms] = useState<Record<string, Record<string, boolean>>>({});
  // Add user dialog
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<"admin" | "user">("user");
  const [showPw, setShowPw] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      toast.error("Failed to load users: " + (err instanceof Error ? err.message : "Unknown"));
    } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const getRole = (id: string) => pendingRoles[id] || users.find(u => u.id === id)?.role || "user";
  const getPerm = (id: string, comp: string) => {
    if (pendingPerms[id]?.[comp] !== undefined) return pendingPerms[id][comp];
    const u = users.find(u => u.id === id);
    if (u?.permissions?.[comp] !== undefined) return u.permissions[comp];
    return true; // default allow
  };

  const hasPending = Object.keys(pendingRoles).length > 0 || Object.keys(pendingPerms).length > 0;

  const saveChanges = async () => {
    setIsSaving(true);
    try {
      for (const [id, role] of Object.entries(pendingRoles)) {
        await updateUserRole(id, role);
      }
      for (const [id, perms] of Object.entries(pendingPerms)) {
        const u = users.find(u => u.id === id);
        const merged = { ...(u?.permissions || {}), ...perms };
        await updateUserPermissions(id, merged);
      }
      toast.success("Changes saved");
      setPendingRoles({}); setPendingPerms({});
      fetchData(); refreshUser();
    } catch (err) { toast.error("Save failed: " + (err instanceof Error ? err.message : "Unknown")); }
    finally { setIsSaving(false); }
  };

  const handleAddUser = async () => {
    if (!addEmail || !addPassword) { toast.error("Fill in all fields"); return; }
    if (addPassword.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setAddLoading(true);
    try {
      await createUser(addEmail, addPassword, addRole);
      toast.success(`User ${addEmail} created`);
      setAddOpen(false); setAddEmail(""); setAddPassword(""); setAddRole("user");
      fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed to create user"); }
    finally { setAddLoading(false); }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      await deleteUser(id);
      toast.success(`Deleted ${email}`);
      fetchData();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
  };

  if (isLoading) {
    return (<DashboardLayout><div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>);
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary flex items-center justify-center rounded-lg"><Shield className="w-6 h-6 text-primary-foreground" /></div>
            <div><h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1><p className="text-muted-foreground mt-1">Manage users, roles, and permissions</p></div>
          </div>
          <div className="flex gap-2">
            {/* Add User Dialog */}
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild><Button><UserPlus className="w-4 h-4 mr-2" />Add User</Button></DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader><DialogTitle>Add New User</DialogTitle><DialogDescription>Create a new dashboard user</DialogDescription></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label className="font-mono text-xs uppercase">Email</Label><Input type="email" value={addEmail} onChange={e => setAddEmail(e.target.value)} placeholder="user@trajectdata.com" /></div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Password</Label>
                    <div className="relative">
                      <Input type={showPw ? "text" : "password"} value={addPassword} onChange={e => setAddPassword(e.target.value)} placeholder="Min 8 characters" />
                      <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3" onClick={() => setShowPw(!showPw)}>{showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</Button>
                    </div>
                  </div>
                  <div className="space-y-2"><Label className="font-mono text-xs uppercase">Role</Label>
                    <Select value={addRole} onValueChange={v => setAddRole(v as "admin" | "user")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="user">User</SelectItem><SelectItem value="admin">Admin</SelectItem></SelectContent></Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddUser} disabled={addLoading}>{addLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create User</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {hasPending && (<Button onClick={saveChanges} disabled={isSaving}>{isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}Save Changes</Button>)}
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-4">
          <TabsList><TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" />Users & Roles</TabsTrigger><TabsTrigger value="permissions" className="gap-2"><Shield className="w-4 h-4" />Permissions</TabsTrigger></TabsList>

          <TabsContent value="users">
            <Card>
              <CardHeader><CardTitle>User Management</CardTitle><CardDescription>{users.length} user{users.length !== 1 ? "s" : ""} registered</CardDescription></CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader><TableRow><TableHead className="font-mono text-xs uppercase">Email</TableHead><TableHead className="font-mono text-xs uppercase">Role</TableHead><TableHead className="font-mono text-xs uppercase">Created</TableHead><TableHead className="font-mono text-xs uppercase w-20">Actions</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {users.map(u => (
                      <TableRow key={u.id}>
                        <TableCell className="font-mono text-sm">{u.email}{u.id === currentUser?.id && <Badge variant="outline" className="ml-2 text-[10px]">you</Badge>}</TableCell>
                        <TableCell>
                          <Select value={getRole(u.id)} onValueChange={v => setPendingRoles(p => ({ ...p, [u.id]: v as "admin" | "user" }))} disabled={u.id === currentUser?.id}>
                            <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="admin">Admin</SelectItem><SelectItem value="user">User</SelectItem></SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{u.createdAt ? format(new Date(u.createdAt), "MMM d, yyyy") : "—"}</TableCell>
                        <TableCell>
                          {u.id !== currentUser?.id && (
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400 hover:text-red-300" onClick={() => handleDelete(u.id, u.email)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <Card>
              <CardHeader><CardTitle>Component Permissions</CardTitle><CardDescription>Control access per user. Admins have full access by default.</CardDescription></CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead className="font-mono text-xs uppercase sticky left-0 bg-background z-10">User</TableHead>
                      {COMPONENTS.map(c => <TableHead key={c.name} className="font-mono text-xs uppercase text-center">{c.label}</TableHead>)}
                    </TableRow></TableHeader>
                    <TableBody>
                      {users.filter(u => getRole(u.id) !== "admin").map(u => (
                        <TableRow key={u.id}>
                          <TableCell className="font-mono text-sm sticky left-0 bg-background z-10">{u.email}</TableCell>
                          {COMPONENTS.map(c => (
                            <TableCell key={c.name} className="text-center">
                              <Switch checked={getPerm(u.id, c.name)}
                                onCheckedChange={v => setPendingPerms(p => ({ ...p, [u.id]: { ...(p[u.id] || {}), [c.name]: v } }))} />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {users.filter(u => getRole(u.id) !== "admin").length === 0 && (
                        <TableRow><TableCell colSpan={COMPONENTS.length + 1} className="text-center text-muted-foreground py-8">No regular users. All users are admins.</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-4 border-t bg-muted/30"><p className="text-xs text-muted-foreground">Admin users have access to all components. Permissions only apply to users with the "User" role.</p></div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminSettingsPage;
