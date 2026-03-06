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
import { Shield, Users, Loader2, Save, UserPlus, Trash2, Eye, EyeOff, Settings2, BotMessageSquare, Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  listUsers, createUser, updateUserRole, updateUserPermissions, deleteUser,
  getConfig, updateConfig,
  type AuthUser, type AppConfig, type AIProvider,
} from "@/lib/authApi";

const COMPONENTS = [
  { name: "dashboard", label: "Dashboard" },
  { name: "wilddeer", label: "WildDeer (View)" },
  { name: "wilddeer-edit", label: "WildDeer (Edit)" },
  { name: "confluence", label: "Confluence" },
  { name: "credits", label: "Credits" },
  { name: "account-lookup", label: "Account Lookup" },
  { name: "stripe", label: "Stripe" },
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
  // Config state
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>("anthropic");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [modelInput, setModelInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);

  const providerInfo: Record<AIProvider, { name: string; placeholder: string; defaultModel: string; models: string[] }> = {
    anthropic: { name: "Anthropic", placeholder: "sk-ant-api03-...", defaultModel: "claude-sonnet-4-20250514", models: ["claude-sonnet-4-20250514", "claude-opus-4-20250514", "claude-haiku-4-20250414"] },
    openai: { name: "OpenAI", placeholder: "sk-...", defaultModel: "gpt-4o", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "o3-mini"] },
    openrouter: { name: "OpenRouter", placeholder: "sk-or-...", defaultModel: "anthropic/claude-sonnet-4", models: ["anthropic/claude-sonnet-4", "openai/gpt-4o", "google/gemini-2.5-pro", "meta-llama/llama-4-maverick"] },
  };

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const data = await getConfig();
      setConfig(data);
      setSelectedProvider(data.aiProvider);
      setModelInput(data.aiModel);
    } catch (err) {
      toast.error("Failed to load config: " + (err instanceof Error ? err.message : "Unknown"));
    } finally { setConfigLoading(false); }
  };

  const handleSaveConfig = async () => {
    setConfigSaving(true);
    try {
      const updates: { aiProvider?: AIProvider; aiApiKey?: string; aiModel?: string } = {};
      if (selectedProvider !== config?.aiProvider) updates.aiProvider = selectedProvider;
      if (apiKeyInput.trim()) updates.aiApiKey = apiKeyInput.trim();
      if (modelInput !== (config?.aiModel || "")) updates.aiModel = modelInput;
      // If switching provider, always send provider even if key is empty
      if (selectedProvider !== config?.aiProvider) updates.aiProvider = selectedProvider;
      await updateConfig(updates);
      toast.success("Configuration saved");
      setApiKeyInput("");
      fetchConfig();
    } catch (err) {
      toast.error("Failed to save: " + (err instanceof Error ? err.message : "Unknown"));
    } finally { setConfigSaving(false); }
  };

  const handleClearApiKey = async () => {
    if (!confirm("Clear the dashboard API key? Will fall back to the server .env value if set.")) return;
    setConfigSaving(true);
    try {
      await updateConfig({ aiApiKey: "" });
      toast.success("API key cleared");
      fetchConfig();
    } catch (err) {
      toast.error("Failed to clear: " + (err instanceof Error ? err.message : "Unknown"));
    } finally { setConfigSaving(false); }
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err) {
      toast.error("Failed to load users: " + (err instanceof Error ? err.message : "Unknown"));
    } finally { setIsLoading(false); }
  };

  useEffect(() => { fetchData(); fetchConfig(); }, []);

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
          <TabsList><TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" />Users & Roles</TabsTrigger><TabsTrigger value="permissions" className="gap-2"><Shield className="w-4 h-4" />Privileges</TabsTrigger><TabsTrigger value="config" className="gap-2"><Settings2 className="w-4 h-4" />Configuration</TabsTrigger></TabsList>

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
              <CardHeader><CardTitle>Privileges</CardTitle><CardDescription>Control access and edit permissions per user. Enable "WildDeer (Edit)" to allow data editing — without it, users can only view.</CardDescription></CardHeader>
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
          <TabsContent value="config">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BotMessageSquare className="w-5 h-5" />AI Configuration</CardTitle>
                <CardDescription>Configure the AI provider and API key for the Confluence assistant</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {configLoading ? (
                  <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                ) : config ? (
                  <>
                    {/* Current status */}
                    <div className="rounded-lg border p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="font-mono text-xs uppercase text-muted-foreground">Status</Label>
                        <Badge variant={config.aiKeyConfigured ? "default" : "destructive"}>
                          {config.aiKeyConfigured ? "Configured" : "Not Configured"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <Label className="font-mono text-xs uppercase text-muted-foreground">Provider</Label>
                        <Badge variant="outline">{providerInfo[config.aiProvider]?.name || config.aiProvider}</Badge>
                      </div>
                      {config.aiKeyConfigured && (
                        <>
                          <div className="flex items-center justify-between">
                            <Label className="font-mono text-xs uppercase text-muted-foreground">Key Source</Label>
                            <Badge variant="outline">
                              {config.aiKeySource === "dashboard" ? "Set via Dashboard" : "Server .env file"}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label className="font-mono text-xs uppercase text-muted-foreground">Current Key</Label>
                            <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{config.aiApiKey}</code>
                          </div>
                          {config.aiModel && (
                            <div className="flex items-center justify-between">
                              <Label className="font-mono text-xs uppercase text-muted-foreground">Model</Label>
                              <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{config.aiModel}</code>
                            </div>
                          )}
                        </>
                      )}
                      {!config.aiKeyConfigured && (
                        <p className="text-sm text-muted-foreground">No API key is set. The Confluence AI will show raw document excerpts instead of AI-generated answers.</p>
                      )}
                    </div>

                    {/* Provider selection */}
                    <div className="space-y-3">
                      <Label className="font-mono text-xs uppercase text-muted-foreground">AI Provider</Label>
                      <Select value={selectedProvider} onValueChange={v => setSelectedProvider(v as AIProvider)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                          <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                          <SelectItem value="openrouter">OpenRouter (Multi-provider)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* API key */}
                    <div className="space-y-3">
                      <Label className="font-mono text-xs uppercase text-muted-foreground">{providerInfo[selectedProvider].name} API Key</Label>
                      <div className="relative">
                        <Input
                          type={showApiKey ? "text" : "password"}
                          value={apiKeyInput}
                          onChange={e => setApiKeyInput(e.target.value)}
                          placeholder={providerInfo[selectedProvider].placeholder}
                          className="pr-10 font-mono text-sm"
                        />
                        <Button type="button" variant="ghost" size="sm" className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowApiKey(!showApiKey)}>
                          {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">Leave blank to keep the current key. Overrides any key set in the server .env file.</p>
                    </div>

                    {/* Model override */}
                    <div className="space-y-3">
                      <Label className="font-mono text-xs uppercase text-muted-foreground">Model (optional)</Label>
                      <Select value={modelInput || "__default__"} onValueChange={v => setModelInput(v === "__default__" ? "" : v)}>
                        <SelectTrigger><SelectValue placeholder="Default" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__default__">Default ({providerInfo[selectedProvider].defaultModel})</SelectItem>
                          {providerInfo[selectedProvider].models.map(m => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">Choose a model or leave as default. You can also type a custom model ID in the server .env.</p>
                    </div>

                    {/* Save / Clear */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button onClick={handleSaveConfig} disabled={configSaving}>
                        {configSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                        Save Configuration
                      </Button>
                      {config.aiKeySource === "dashboard" && (
                        <Button variant="outline" size="sm" onClick={handleClearApiKey} disabled={configSaving}>
                          <Trash2 className="w-3.5 h-3.5 mr-2" />Clear Dashboard Key
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Failed to load configuration.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default AdminSettingsPage;
