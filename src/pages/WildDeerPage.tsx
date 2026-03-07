import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Database, RefreshCw, Pencil, Loader2, Columns3, Undo2, Shield, FlaskConical,
  Search, X, Download, Eye, CheckCircle2, XCircle, ArrowUpDown, Users,
  ChevronDown, User, CreditCard, ToggleLeft, Hash, Zap, Lock, Server,
  Filter, ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { fetchMongoAccounts, updateMongoAccount, fetchPlans, searchMongoAccounts, clearApiAuth, checkServerHealth } from "@/lib/mongoApi";
import type { MongoAccount, MongoPlan } from "@/lib/mongoApi";
import { getEnvMode, setEnvMode, type EnvMode } from "@/lib/envConfig";
import { usePermissions } from "@/hooks/usePermissions";

// ═══════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════
const DEFAULT_COLUMNS = [
  "userEmail", "userUserName", "userFirstName", "userLastName",
  "isUserEmailVerified", "hasPaymentProblem", "isAdminBlocked", "createdAt",
];
const ROWS_OPTIONS = [10, 25, 50, 100];

const FIELD_GROUPS: { label: string; icon: typeof User; keys: string[] }[] = [
  { label: "User Info", icon: User, keys: ["userEmail", "userUserName", "userFirstName", "userLastName", "userDisplayName", "userPhoneNumber", "userCompanyName", "userWebsite", "userLocation"] },
  { label: "Plan & Billing", icon: CreditCard, keys: ["planId", "appName", "planIdUpdatedAt", "currentPeriodStart", "currentPeriodEnd", "hasPaymentProblem", "isAllowedManualBilling", "stripeCustomerId", "stripeSubscriptionId"] },
  { label: "Status Flags", icon: ToggleLeft, keys: ["isUserEmailVerified", "isAdminBlocked", "isMultiFreeTrialBlocked", "isBetaUser", "isActive", "activeNow", "isCustomPlan", "isAllowedOverage"] },
  { label: "Tracking", icon: Hash, keys: ["createdAt", "createdAtEpoch", "userReleaseNotesLastReadDate", "lastLoginAt", "loginCount"] },
];

const ENV_INFO: Record<EnvMode, { label: string; port: number; desc: string; color: string }> = {
  development: { label: "Development", port: 3001, desc: "Test30 · MongoDB Atlas", color: "emerald" },
  production: { label: "Production", port: 3002, desc: "SSH + TLS · Live DB", color: "orange" },
};

const NEGATIVE_BOOLEANS = ["hasPaymentProblem", "isAdminBlocked", "isMultiFreeTrialBlocked", "userEmailPreferencesError"];
const DATE_KEYS = ["createdAt", "planIdUpdatedAt", "created_at", "updated_at"];
const EPOCH_KEYS = ["createdAtEpoch", "currentPeriodEnd", "currentPeriodStart", "userReleaseNotesLastReadDate"];
const COST_KEYS = ["planMonthlyCost", "planYearlyCost"];

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
function isDate(key: string, val: unknown): boolean {
  if (DATE_KEYS.includes(key)) return true;
  return typeof val === "string" && /^\d{4}-\d{2}-\d{2}T/.test(val);
}
function isEpoch(key: string, val: unknown): boolean {
  return EPOCH_KEYS.includes(key) && typeof val === "number" && val > 1e12;
}
function formatDate(v: string | number): string {
  try {
    const d = new Date(v);
    return isNaN(d.getTime()) ? String(v) : d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return String(v); }
}
function columnLabel(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/^./, s => s.toUpperCase()).trim();
}
type FieldType = "boolean" | "date" | "epoch" | "number" | "int32" | "int64" | "float" | "object" | "array" | "string";
function detectType(key: string, val: unknown): FieldType {
  if (typeof val === "boolean") return "boolean";
  if (DATE_KEYS.includes(key)) return "date";
  if (EPOCH_KEYS.includes(key)) return "epoch";
  if (isDate(key, val)) return "date";
  if (isEpoch(key, val)) return "epoch";
  if (Array.isArray(val)) return "array";
  if (typeof val === "object" && val !== null) return "object";
  if (typeof val === "number") return "number";
  return "string";
}
function formatCell(key: string, val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (isDate(key, val)) return formatDate(val as string);
  if (isEpoch(key, val)) return formatDate(val as number);
  if (Array.isArray(val)) return val.length === 0 ? "[ ]" : JSON.stringify(val);
  if (typeof val === "object") {
    const e = Object.entries(val as Record<string, unknown>);
    return e.length === 0 ? "{ }" : e.map(([k, v]) => `${k}: ${v}`).join(", ");
  }
  if (typeof val === "number") return val.toLocaleString();
  return String(val);
}
function cellColor(key: string, val: unknown): string {
  if (val === null || val === undefined) return "text-muted-foreground/50 italic";
  if (typeof val === "boolean") {
    const neg = NEGATIVE_BOOLEANS.includes(key);
    return (neg ? !val : val) ? "text-emerald-500" : "text-red-500";
  }
  if (isDate(key, val) || isEpoch(key, val)) return "text-sky-400";
  if (typeof val === "number") return "tabular-nums";
  return "";
}
function toDatetimeLocal(v: string): string {
  try { const d = new Date(v); return isNaN(d.getTime()) ? v : d.toISOString().slice(0, 16); } catch { return v; }
}
function epochToLocal(v: number): string {
  try { return new Date(v).toISOString().slice(0, 16); } catch { return String(v); }
}
function localToISO(v: string): string {
  try { return new Date(v).toISOString(); } catch { return v; }
}
function localToEpoch(v: string): number {
  try { return new Date(v).getTime(); } catch { return 0; }
}
function getFieldGroup(key: string): string {
  for (const g of FIELD_GROUPS) { if (g.keys.includes(key)) return g.label; }
  return "Other";
}
function exportCSV(data: MongoAccount[], cols: string[], filename: string) {
  const hdr = cols.map(c => `"${columnLabel(c)}"`).join(",");
  const rows = data.map(r => cols.map(c => {
    const v = r[c];
    if (v == null) return "";
    if (typeof v === "object") return `"${JSON.stringify(v).replace(/"/g, '""')}"`;
    return `"${String(v).replace(/"/g, '""')}"`;
  }).join(","));
  const blob = new Blob([[hdr, ...rows].join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename; a.click();
  URL.revokeObjectURL(a.href);
}

// ═══════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════
const WildDeerPage = () => {
  // ── Permissions ──
  const { hasAccess } = usePermissions();
  const canEdit = hasAccess("wilddeer-edit");
  // ── State ──
  const [isLoading, setIsLoading] = useState(false);
  const [accounts, setAccounts] = useState<MongoAccount[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [plans, setPlans] = useState<MongoPlan[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MongoAccount[] | null>(null);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(DEFAULT_COLUMNS);
  const [columnSearch, setColumnSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [quickFilters, setQuickFilters] = useState<Record<string, boolean | null>>({});
  // Environment
  const [envMode, setEnvModeState] = useState<EnvMode>(getEnvMode());
  const [envStatus, setEnvStatus] = useState<"connected" | "disconnected" | "checking">("checking");
  const [envSwitchOpen, setEnvSwitchOpen] = useState(false);
  // View dialog
  const [viewAccount, setViewAccount] = useState<MongoAccount | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  // Edit dialog
  const [editAccount, setEditAccount] = useState<MongoAccount | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, unknown>>({});
  const [originalForm, setOriginalForm] = useState<Record<string, unknown>>({});
  const [selectedPlanApp, setSelectedPlanApp] = useState("");
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<FieldType>("string");
  const [showAddField, setShowAddField] = useState(false);
  const [newFieldTypes, setNewFieldTypes] = useState<Record<string, FieldType>>({});
  const [changingPlan, setChangingPlan] = useState(false);
  const [changePlanApp, setChangePlanApp] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);
  const isProd = envMode === "production";
  const envInfo = ENV_INFO[envMode];

  // ── Memos ──
  const plansByApp = useMemo(() => {
    const g: Record<string, MongoPlan[]> = {};
    plans.forEach(p => { const a = p.appName || "unknown"; if (!g[a]) g[a] = []; g[a].push(p); });
    return g;
  }, [plans]);
  const plansForApp = useMemo(() => selectedPlanApp ? (plansByApp[selectedPlanApp] || []) : [], [plansByApp, selectedPlanApp]);
  const selectedPlan = useMemo(() => {
    const pid = editForm.planId;
    if (!pid || typeof pid !== "string") return null;
    return plans.find(p => p.planId === pid) || null;
  }, [editForm.planId, plans]);
  const changedFields = useMemo(() =>
    Object.keys(editForm).filter(k => !(k in originalForm) || JSON.stringify(editForm[k]) !== JSON.stringify(originalForm[k]))
  , [editForm, originalForm]);

  const allColumns = useMemo(() => {
    const source = searchResults ?? accounts;
    if (!source.length) return [];
    const keys = new Set<string>();
    source.forEach(d => Object.keys(d).forEach(k => { if (k !== "_id") keys.add(k); }));
    return Array.from(keys).sort();
  }, [accounts, searchResults]);

  const filteredColumns = useMemo(() => {
    if (!columnSearch.trim()) return allColumns;
    const q = columnSearch.toLowerCase();
    return allColumns.filter(c => c.toLowerCase().includes(q) || columnLabel(c).toLowerCase().includes(q));
  }, [allColumns, columnSearch]);

  const stats = useMemo(() => {
    const source = searchResults ?? accounts;
    return {
      total: totalCount,
      showing: source.length,
      verified: source.filter(a => a.isUserEmailVerified === true).length,
      payIssue: source.filter(a => a.hasPaymentProblem === true).length,
      plans: new Set(source.map(a => a.planId).filter(Boolean)).size,
    };
  }, [accounts, searchResults, totalCount]);

  // Server-side search with debounce
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    if (q.length < 2) return; // wait for at least 2 chars
    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const r = await searchMongoAccounts(q);
        setSearchResults(r.data);
      } catch (err) {
        console.error("Search failed:", err);
        toast.error("Search failed: " + (err instanceof Error ? err.message : "Unknown error"));
        setSearchResults(null);
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchQuery]);

  const filteredAccounts = useMemo(() => {
    const source = searchResults ?? accounts;
    let result = source;
    Object.entries(quickFilters).forEach(([key, val]) => {
      if (val !== null && val !== undefined) result = result.filter(a => a[key] === val);
    });
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const va = a[sortKey] ?? "", vb = b[sortKey] ?? "";
        const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [accounts, searchResults, sortKey, sortDir, quickFilters]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / rowsPerPage));
  const pagedAccounts = useMemo(() => {
    const s = page * rowsPerPage;
    return filteredAccounts.slice(s, s + rowsPerPage);
  }, [filteredAccounts, page, rowsPerPage]);

  const boolColumns = useMemo(() => {
    const source = searchResults ?? accounts;
    return allColumns.filter(c => source.some(a => typeof a[c] === "boolean"));
  }, [allColumns, accounts, searchResults]);

  // ── Handlers ──
  const checkHealth = async () => {
    setEnvStatus("checking");
    const r = await checkServerHealth();
    setEnvStatus(r.ok ? "connected" : "disconnected");
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [accsResult, plns] = await Promise.all([fetchMongoAccounts(100), fetchPlans()]);
      setAccounts(accsResult.data); setTotalCount(accsResult.total); setPlans(plns);
      toast.success(`Loaded ${accsResult.data.length} of ${accsResult.total.toLocaleString()} documents`);
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : "Unknown"}`);
    } finally { setIsLoading(false); }
  }, []);

  const switchEnv = async (mode: EnvMode) => {
    if (mode === envMode) { setEnvSwitchOpen(false); return; }
    setEnvMode(mode); setEnvModeState(mode);
    // Don't clear auth — login tokens are shared between dev and prod via shared JWT secret
    setAccounts([]); setPlans([]); setSearchResults(null); setSearchQuery(""); setEnvStatus("checking"); setPage(0); setEnvSwitchOpen(false);
    const h = await checkServerHealth();
    if (!h.ok) { setEnvStatus("disconnected"); toast.error(`Cannot reach ${mode} server: ${h.error}`); return; }
    setEnvStatus("connected"); toast.success(`Switched to ${ENV_INFO[mode].label}`);
    setIsLoading(true);
    try {
      const [accsResult, plns] = await Promise.all([fetchMongoAccounts(100), fetchPlans()]);
      setAccounts(accsResult.data); setTotalCount(accsResult.total); setPlans(plns);
    } catch (e) { toast.error(`Failed: ${e instanceof Error ? e.message : "Unknown"}`); }
    finally { setIsLoading(false); }
  };

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const toggleColumn = (col: string) => setVisibleColumns(p => p.includes(col) ? p.filter(c => c !== col) : [...p, col]);
  const toggleQuickFilter = (key: string, value: boolean) => {
    setQuickFilters(p => {
      if (p[key] === value) { const n = { ...p }; delete n[key]; return n; }
      return { ...p, [key]: value };
    });
    setPage(0);
  };

  const openView = (a: MongoAccount) => { setViewAccount(a); setViewOpen(true); };
  const openEdit = (a: MongoAccount) => {
    setEditAccount(a);
    const fd: Record<string, unknown> = {};
    Object.entries(a).forEach(([k, v]) => { if (k !== "_id") fd[k] = v; });
    setEditForm(fd);
    setOriginalForm(JSON.parse(JSON.stringify(fd)));
    setSelectedPlanApp(String(a.appName ?? ""));
    setNewFieldTypes({});
    setShowAddField(false);
    setChangingPlan(false);
    setChangePlanApp("");
    setEditOpen(true);
  };

  const handleUpdate = async () => {
    if (!editAccount || changedFields.length === 0) return;
    if (isProd && !confirmSaveOpen) { setConfirmSaveOpen(true); return; }
    setConfirmSaveOpen(false); setIsLoading(true);
    try {
      const updates: Record<string, unknown> = {};
      changedFields.forEach(k => { updates[k] = editForm[k]; });
      await updateMongoAccount(editAccount._id, updates);
      toast.success(`Updated ${changedFields.length} field(s)`);
      setEditOpen(false); loadData();
    } catch (e) { toast.error(`Update failed: ${e instanceof Error ? e.message : "Unknown"}`); }
    finally { setIsLoading(false); }
  };

  const revertAll = () => { setEditForm({ ...originalForm }); setSelectedPlanApp(String(originalForm.appName ?? "")); toast.info("All changes reverted"); };
  const revertField = (key: string) => { setEditForm(p => ({ ...p, [key]: originalForm[key] })); if (key === "planId" || key === "appName") setSelectedPlanApp(String(originalForm.appName ?? "")); };

  const addNewField = () => {
    const name = newFieldName.trim();
    if (!name) { toast.error("Field name is required"); return; }
    if (name in editForm) { toast.error(`Field "${name}" already exists`); return; }
    const defaults: Record<FieldType, unknown> = {
      string: "", boolean: false, number: 0, int32: 0, int64: 0, float: 0.0, date: new Date().toISOString(),
      epoch: Date.now(), object: {}, array: [],
    };
    setEditForm(p => ({ ...p, [name]: defaults[newFieldType] }));
    setNewFieldTypes(p => ({ ...p, [name]: newFieldType }));
    setNewFieldName(""); setNewFieldType("string"); setShowAddField(false);
    toast.success(`Added field "${name}" (${newFieldType})`);
  };

  const removeNewField = (key: string) => {
    if (key in originalForm) return;
    setEditForm(p => { const n = { ...p }; delete n[key]; return n; });
    setNewFieldTypes(p => { const n = { ...p }; delete n[key]; return n; });
    toast.info(`Removed field "${key}"`);
  };

  const renderEditField = (key: string) => {
    const value = editForm[key];
    const origVal = originalForm[key];
    const isNew = !(key in originalForm);
    const ft = newFieldTypes[key] || detectType(key, origVal ?? value);
    const isChanged = !isNew && changedFields.includes(key);

    // planId — show current value with Change button
    if (key === "planId") {
      const currentVal = String(value ?? "");
      const currentPlan = plans.find(p => p.planId === currentVal);
      const changePlans = changePlanApp ? plans.filter(p => p.appName === changePlanApp) : [];

      return (
        <div key={key} className={`py-2 border-b border-border/30 ${isChanged ? "bg-orange-500/5" : ""}`}>
          <div className="grid grid-cols-[160px_1fr] items-start gap-2">
            <div className="flex items-center gap-1.5 pt-1">
              <span className="text-xs font-mono text-muted-foreground truncate">{key}</span>
              <span className="text-[9px] text-muted-foreground/60">string</span>
              {isChanged && <button onClick={() => { revertField(key); setChangingPlan(false); setChangePlanApp(""); }} className="text-orange-500 hover:text-orange-400"><Undo2 className="w-3 h-3" /></button>}
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm flex-1 truncate" title={currentVal}>{currentVal || <span className="text-muted-foreground italic">empty</span>}</span>
              {!changingPlan && (
                <Button size="sm" variant="outline" className="h-7 text-xs font-mono shrink-0" onClick={() => { setChangingPlan(true); setChangePlanApp(""); }}>
                  Change
                </Button>
              )}
            </div>
          </div>

          {changingPlan && (
            <div className="mt-2 ml-[168px] space-y-2 p-3 rounded-md border border-dashed border-primary/30 bg-primary/5">
              {/* Step 1: Pick app */}
              <div>
                <p className="text-[10px] font-mono text-muted-foreground mb-1">1. Select App</p>
                <select value={changePlanApp} onChange={e => setChangePlanApp(e.target.value)}
                  className="w-full h-8 border rounded px-2 text-sm bg-background font-mono">
                  <option value="">— choose app —</option>
                  {Object.keys(plansByApp).sort().map(app => (
                    <option key={app} value={app}>{app} ({plansByApp[app].length} plans)</option>
                  ))}
                </select>
              </div>

              {/* Step 2: Pick plan */}
              {changePlanApp && (
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground mb-1">2. Select Plan</p>
                  <select value="" onChange={e => {
                    setEditForm(p => ({ ...p, planId: e.target.value, appName: changePlanApp }));
                    setSelectedPlanApp(changePlanApp);
                  }} className="w-full h-8 border rounded px-2 text-sm bg-background font-mono">
                    <option value="">— choose plan —</option>
                    {changePlans.map(p => {
                      const pAny = p as Record<string, unknown>;
                      return (
                        <option key={p.planId} value={p.planId}>
                          {p.planId} — {pAny.planName as string || "Untitled"} (${pAny.planMonthlyCost || 0}/mo)
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Step 3: Show selected plan details */}
              {isChanged && currentPlan && (
                <div className="p-2.5 rounded-md border bg-card">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono font-semibold text-muted-foreground uppercase">Selected Plan</span>
                    <Badge variant={currentPlan.activeNow ? "default" : "secondary"} className="text-[10px]">
                      {currentPlan.activeNow ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                    {Object.entries(currentPlan).filter(([k]) => !["_id"].includes(k)).map(([k, v]) => (
                      <div key={k} className="flex items-baseline justify-between gap-1 py-0.5">
                        <span className="text-[10px] text-muted-foreground truncate font-mono">{k}</span>
                        <span className={`text-[11px] font-mono font-medium text-right ${
                          typeof v === "boolean" ? (v ? "text-emerald-400" : "text-red-400") : "text-foreground"
                        }`}>
                          {v === null || v === undefined ? "—" :
                           typeof v === "boolean" ? String(v) :
                           COST_KEYS.includes(k) ? `$${v}` :
                           typeof v === "number" ? v.toLocaleString() :
                           Array.isArray(v) ? (v.length ? v.join(", ") : "[]") :
                           String(v)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button size="sm" variant="ghost" className="h-6 text-xs text-muted-foreground" onClick={() => { setChangingPlan(false); setChangePlanApp(""); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={key} className={`grid grid-cols-[160px_1fr] items-start gap-2 py-2 border-b border-border/30 ${isChanged ? "bg-orange-500/5" : ""} ${isNew ? "bg-emerald-500/5" : ""}`}>
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-xs font-mono text-muted-foreground truncate" title={key}>{key}</span>
          <span className="text-[9px] text-muted-foreground/60">{ft}</span>
          {isNew && <span className="text-[9px] text-emerald-500 font-medium">new</span>}
          {isChanged && <button onClick={() => revertField(key)} className="text-orange-500 hover:text-orange-400"><Undo2 className="w-3 h-3" /></button>}
          {isNew && <button onClick={() => removeNewField(key)} className="text-red-400 hover:text-red-300"><X className="w-3 h-3" /></button>}
        </div>
        <div>
          {ft === "boolean" ? (
            <div className="flex items-center gap-2 h-8">
              <Switch checked={!!value} onCheckedChange={v => setEditForm(p => ({ ...p, [key]: v }))} />
              <span className={`text-sm font-mono ${value ? "text-emerald-500" : "text-red-400"}`}>{String(value)}</span>
            </div>
          ) : ft === "date" ? (
            <Input type="datetime-local" value={toDatetimeLocal(String(value ?? ""))}
              onChange={e => setEditForm(p => ({ ...p, [key]: localToISO(e.target.value) }))} className="font-mono text-sm h-8" />
          ) : ft === "epoch" ? (
            <div className="space-y-0.5">
              <Input type="datetime-local" value={epochToLocal(Number(value ?? 0))}
                onChange={e => setEditForm(p => ({ ...p, [key]: localToEpoch(e.target.value) }))} className="font-mono text-sm h-8" />
              <p className="text-[10px] text-muted-foreground font-mono">{String(value)}</p>
            </div>
          ) : ft === "int32" ? (
            <Input type="number" step="1" value={String(value ?? "")}
              onChange={e => { const v = e.target.value === "" ? null : Math.trunc(Number(e.target.value)); if (v !== null && (v < -2147483648 || v > 2147483647)) return; setEditForm(p => ({ ...p, [key]: v })); }}
              className="font-mono text-sm h-8" placeholder="Int32 (-2³¹ to 2³¹-1)" />
          ) : ft === "int64" ? (
            <Input type="text" inputMode="numeric" value={String(value ?? "")}
              onChange={e => { const raw = e.target.value; if (raw === "" || raw === "-") { setEditForm(p => ({ ...p, [key]: raw === "" ? null : raw })); return; } const n = Number(raw); if (!isNaN(n) && Number.isInteger(n)) setEditForm(p => ({ ...p, [key]: n })); }}
              className="font-mono text-sm h-8" placeholder="Int64" />
          ) : ft === "float" ? (
            <Input type="number" step="any" value={String(value ?? "")}
              onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value === "" ? null : parseFloat(e.target.value) }))}
              className="font-mono text-sm h-8" placeholder="Float (e.g. 3.14)" />
          ) : (ft === "number") ? (
            <Input type="number" value={String(value ?? "")}
              onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value === "" ? null : Number(e.target.value) }))} className="font-mono text-sm h-8" />
          ) : (ft === "object" || ft === "array") ? (
            <textarea value={typeof value === "string" ? value : JSON.stringify(value, null, 2)}
              onChange={e => { try { setEditForm(p => ({ ...p, [key]: JSON.parse(e.target.value) })); } catch { setEditForm(p => ({ ...p, [key]: e.target.value })); } }}
              className="w-full font-mono text-xs border rounded p-2 bg-background min-h-[48px] resize-y" />
          ) : (
            <Input value={String(value ?? "")}
              onChange={e => setEditForm(p => ({ ...p, [key]: e.target.value }))} className="font-mono text-sm h-8" />
          )}
        </div>
      </div>
    );
  };

  // ── Effects ──
  useEffect(() => { checkHealth(); loadData(); }, [loadData]);
  useEffect(() => { setPage(0); }, [searchQuery, searchResults, sortKey, sortDir, quickFilters]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape" && searchQuery) setSearchQuery("");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [searchQuery]);

  // ═══════════════════════════════════════════
  //  RENDER
  // ═══════════════════════════════════════════
  return (
    <DashboardLayout>
      <TooltipProvider delayDuration={200}>
      <div className="space-y-5">

        {/* ═══ HEADER ═══ */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isProd ? "bg-orange-500/15 ring-1 ring-orange-500/30" : "bg-emerald-500/15 ring-1 ring-emerald-500/30"}`}>
              <Database className={`w-5 h-5 ${isProd ? "text-orange-400" : "text-emerald-400"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">WildDeer</h1>
                <Badge variant="outline" className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0 ${
                  isProd ? "border-orange-500/40 text-orange-400" : "border-emerald-500/40 text-emerald-400"
                }`}>{envMode}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">MongoDB Account Manager</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Environment Switcher */}
            <Popover open={envSwitchOpen} onOpenChange={setEnvSwitchOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 h-9">
                  <span className={`w-2 h-2 rounded-full ${envStatus === "connected" ? "bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.5)]" : envStatus === "checking" ? "bg-amber-400 animate-pulse" : "bg-red-400"}`} />
                  {isProd ? <Shield className="w-3.5 h-3.5 text-orange-400" /> : <FlaskConical className="w-3.5 h-3.5 text-emerald-400" />}
                  {isProd ? "Prod" : "Dev"}
                  <ChevronDown className="w-3 h-3 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end">
                <div className="px-3 py-2.5 border-b">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Switch Environment</p>
                </div>
                <div className="p-1.5 space-y-0.5">
                  {(["development", "production"] as const).map(mode => {
                    const info = ENV_INFO[mode];
                    const Icon = mode === "production" ? Shield : FlaskConical;
                    const active = envMode === mode;
                    return (
                      <button key={mode} onClick={() => switchEnv(mode)}
                        className={`w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all ${
                          active ? "bg-muted ring-1 ring-border" : "hover:bg-muted/60 text-muted-foreground"
                        }`}>
                        <Icon className={`w-4 h-4 shrink-0 ${mode === "production" ? "text-orange-400" : "text-emerald-400"}`} />
                        <div className="flex-1 text-left">
                          <p className={`font-medium ${active ? "text-foreground" : ""}`}>{info.label}</p>
                          <p className="text-[10px] text-muted-foreground">:{info.port} · {info.desc}</p>
                        </div>
                        {active && envStatus === "connected" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />}
                        {active && envStatus === "disconnected" && <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
                {envStatus === "disconnected" && (
                  <div className="px-3 py-2 border-t bg-red-500/5">
                    <p className="text-xs text-red-400 flex items-center gap-1.5"><XCircle className="w-3 h-3" /> Start {isProd ? "production.cjs" : "index.cjs"}</p>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            {/* Export */}
            {filteredAccounts.length > 0 && (
              <Tooltip><TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 w-9 p-0"
                  onClick={() => { exportCSV(filteredAccounts, visibleColumns, `wilddeer-${envMode}-${Date.now()}.csv`); toast.success(`Exported ${filteredAccounts.length} rows`); }}>
                  <Download className="w-3.5 h-3.5" />
                </Button>
              </TooltipTrigger><TooltipContent>Export CSV</TooltipContent></Tooltip>
            )}

            {/* Refresh */}
            <Button variant="outline" size="sm" className="gap-2 h-9" onClick={loadData} disabled={isLoading}>
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ═══ PRODUCTION BANNER ═══ */}
        {isProd && (
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-orange-500/30 bg-orange-500/10">
            <Shield className="w-4 h-4 text-orange-400 shrink-0" />
            <div className="flex-1">
              <span className="text-sm font-medium text-orange-300">Production Mode</span>
              <span className="text-xs text-orange-300/60 ml-2">Changes affect live data. Edits require confirmation.</span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-orange-300/50 font-mono">
              <span className="flex items-center gap-1"><Lock className="w-3 h-3" />AES-256</span>
              <span className="flex items-center gap-1"><Server className="w-3 h-3" />SSH</span>
            </div>
          </div>
        )}

        {/* ═══ STATS ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: searchResults ? "Results" : "Showing", value: stats.showing, sub: `of ${stats.total.toLocaleString()} total`, icon: Users, color: "primary" },
            { label: "Verified", value: stats.verified, icon: CheckCircle2, color: "green-500", progress: stats.total > 0 ? (stats.verified / stats.total) * 100 : 0 },
            { label: "Payment Issues", value: stats.payIssue, icon: XCircle, color: stats.payIssue > 0 ? "red-500" : "muted-foreground" },
            { label: "Plans", value: stats.plans, icon: Zap, color: "purple-500" },
          ].map(({ label, value, sub, icon: Icon, color, progress }) => (
            <Card key={label} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</p>
                    <p className="text-2xl font-bold mt-0.5">{isLoading && !accounts.length ? <Skeleton className="h-8 w-16" /> : value.toLocaleString()}</p>
                    {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
                  </div>
                  <div className={`w-9 h-9 rounded-lg bg-${color}/10 flex items-center justify-center`}>
                    <Icon className={`w-4 h-4 text-${color}`} />
                  </div>
                </div>
                {progress !== undefined && stats.total > 0 && <Progress value={progress} className="mt-2 h-1" />}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ═══ SEARCH + COLUMNS + QUICK FILTERS ═══ */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="relative flex-1">
              {isSearching ? (
                <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
              ) : (
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              )}
              <Input ref={searchRef} placeholder={`Search all ${totalCount.toLocaleString()} users by email, name, plan...   ⌘K`}
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 pr-20 h-10" />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {searchQuery && searchResults !== null && !isSearching && (
                  <span className="text-xs text-muted-foreground font-mono">{searchResults.length} found</span>
                )}
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            {/* Column Picker */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2 h-10 shrink-0">
                  <Columns3 className="w-4 h-4" /> Columns
                  <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0 h-5">{visibleColumns.length}</Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-0" align="end">
                <div className="p-2 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <Input placeholder="Search columns..." value={columnSearch} onChange={e => setColumnSearch(e.target.value)} className="pl-8 h-8 text-sm" />
                  </div>
                </div>
                <div className="px-2 py-1.5 border-b flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{visibleColumns.length}/{allColumns.length}</span>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setVisibleColumns([...allColumns])}>All</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setVisibleColumns([])}>None</Button>
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => setVisibleColumns([...DEFAULT_COLUMNS])}>Default</Button>
                  </div>
                </div>
                <ScrollArea className="h-64 p-1.5">
                  <div className="space-y-0.5">
                    {filteredColumns.map(col => (
                      <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-muted rounded px-2 py-1.5">
                        <Checkbox checked={visibleColumns.includes(col)} onCheckedChange={() => toggleColumn(col)} />
                        <span className="text-sm truncate">{columnLabel(col)}</span>
                        {DEFAULT_COLUMNS.includes(col) && <Badge variant="secondary" className="text-[9px] px-1 py-0 ml-auto shrink-0">default</Badge>}
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          </div>

          {/* Quick Filters */}
          {boolColumns.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground mr-1">Quick:</span>
              {boolColumns.slice(0, 8).map(key => {
                const isActive = key in quickFilters;
                const val = quickFilters[key];
                return (
                  <div key={key} className="flex items-center gap-0.5">
                    <button onClick={() => {
                      if (isActive && val === true) toggleQuickFilter(key, false);
                      else if (isActive && val === false) { setQuickFilters(p => { const n = { ...p }; delete n[key]; return n; }); }
                      else toggleQuickFilter(key, true);
                    }} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                      isActive ? val ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500" : "bg-red-500/10 border-red-500/30 text-red-400"
                        : "bg-muted/40 border-border text-muted-foreground hover:bg-muted"
                    }`}>
                      {isActive && <span className={`w-1.5 h-1.5 rounded-full ${val ? "bg-emerald-500" : "bg-red-500"}`} />}
                      {columnLabel(key)}{isActive && <span className="text-[10px] opacity-70 ml-0.5">= {val ? "Yes" : "No"}</span>}
                    </button>
                    {isActive && <button onClick={() => setQuickFilters(p => { const n = { ...p }; delete n[key]; return n; })}
                      className="text-muted-foreground hover:text-foreground p-0.5"><X className="w-3 h-3" /></button>}
                  </div>
                );
              })}
              {Object.keys(quickFilters).length > 0 && (
                <button onClick={() => setQuickFilters({})} className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Clear all</button>
              )}
            </div>
          )}
        </div>

        {/* ═══ DATA TABLE ═══ */}
        {isLoading && !accounts.length ? (
          /* Loading skeleton */
          <Card className="border-border overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/30 flex justify-between">
              <Skeleton className="h-3 w-24" /><Skeleton className="h-3 w-16" />
            </div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="px-4 py-3 border-b border-border/50 flex gap-4">
                <Skeleton className="h-3 w-6" /><Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16 flex-1" /><Skeleton className="h-3 w-10" />
              </div>
            ))}
          </Card>
        ) : !accounts.length ? (
          /* Empty state */
          <Card className="border-border"><CardContent className="p-12 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
              <Database className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="font-medium">No documents found</p>
            <p className="text-sm text-muted-foreground text-center max-w-xs">
              {envStatus === "disconnected" ? `Start ${isProd ? "production.cjs" : "index.cjs"} and try again.` : "The collection appears to be empty."}
            </p>
            <Button variant="outline" size="sm" onClick={loadData} className="mt-2 gap-2"><RefreshCw className="w-3.5 h-3.5" /> Try Again</Button>
          </CardContent></Card>
        ) : !visibleColumns.length ? (
          <Card className="border-border"><CardContent className="p-12 flex flex-col items-center gap-3">
            <Columns3 className="w-8 h-8 text-muted-foreground" />
            <p className="font-medium">No columns selected</p>
            <p className="text-sm text-muted-foreground">Use the Columns picker above.</p>
          </CardContent></Card>
        ) : (
          <Card className="border-border overflow-hidden">
            {/* Toolbar */}
            <div className="px-4 py-2 border-b flex items-center justify-between bg-muted/30">
              <p className="text-xs text-muted-foreground">
                {filteredAccounts.length !== accounts.length
                  ? <><span className="font-medium text-foreground">{filteredAccounts.length}</span> of {accounts.length} records</>
                  : <><span className="font-medium text-foreground">{accounts.length}</span> records</>}
                {sortKey && <span className="ml-1.5 opacity-70">· sorted by {columnLabel(sortKey)} {sortDir === "asc" ? "↑" : "↓"}</span>}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground hidden sm:inline">Rows:</span>
                <select value={rowsPerPage} onChange={e => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
                  className="text-xs bg-background border rounded px-1.5 py-1 h-7">
                  {ROWS_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-b bg-muted/20 hover:bg-muted/20">
                    <TableHead className="w-10 text-center text-xs sticky left-0 bg-muted/20 z-10">#</TableHead>
                    {visibleColumns.map(col => (
                      <TableHead key={col} className="text-xs whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors group"
                        onClick={() => handleSort(col)}>
                        <span className="flex items-center gap-1">
                          {columnLabel(col)}
                          {sortKey === col
                            ? <span className="text-foreground font-bold">{sortDir === "asc" ? "↑" : "↓"}</span>
                            : <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />}
                        </span>
                      </TableHead>
                    ))}
                    <TableHead className="text-xs text-right w-20 sticky right-0 bg-muted/20 z-10">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedAccounts.length === 0 ? (
                    <TableRow><TableCell colSpan={visibleColumns.length + 2} className="text-center py-10 text-muted-foreground">
                      No records match "{searchQuery}"
                      {searchQuery && <Button variant="link" size="sm" className="ml-2 text-xs" onClick={() => setSearchQuery("")}>Clear</Button>}
                    </TableCell></TableRow>
                  ) : pagedAccounts.map((acc, idx) => (
                    <TableRow key={acc._id} className={`border-b border-border/50 hover:bg-muted/40 transition-colors cursor-pointer group ${idx % 2 ? "bg-muted/10" : ""}`}
                      onClick={() => openView(acc)}>
                      <TableCell className="text-center text-xs text-muted-foreground tabular-nums sticky left-0 bg-card group-hover:bg-muted/40 z-10">
                        {page * rowsPerPage + idx + 1}
                      </TableCell>
                      {visibleColumns.map(col => (
                        <TableCell key={col} className={`text-sm max-w-[200px] truncate ${cellColor(col, acc[col])}`}>
                          {typeof acc[col] === "boolean" ? (
                            <span className="inline-flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full ${cellColor(col, acc[col]).includes("emerald") ? "bg-emerald-500" : "bg-red-500"}`} />
                              {acc[col] ? "Yes" : "No"}
                            </span>
                          ) : formatCell(col, acc[col])}
                        </TableCell>
                      ))}
                      <TableCell className="sticky right-0 bg-card group-hover:bg-muted/40 z-10">
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                              onClick={e => { e.stopPropagation(); openView(acc); }}><Eye className="w-3.5 h-3.5" /></Button>
                          </TooltipTrigger><TooltipContent>View</TooltipContent></Tooltip>
                          {canEdit && <Tooltip><TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                              onClick={e => { e.stopPropagation(); openEdit(acc); }}><Pencil className="w-3.5 h-3.5" /></Button>
                          </TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-2.5 border-t flex items-center justify-between bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
                <span className="ml-2 opacity-60">({filteredAccounts.length} total)</span>
              </p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(0)}>
                  <ChevronLeft className="w-3.5 h-3.5" /><ChevronLeft className="w-3.5 h-3.5 -ml-2" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <span className="text-xs font-medium px-2 tabular-nums">{page + 1}</span>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>
                  <ChevronRight className="w-3.5 h-3.5" /><ChevronRight className="w-3.5 h-3.5 -ml-2" />
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* ═══ VIEW DIALOG ═══ */}
        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-4 h-4" /> Document Details
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">{viewAccount?._id}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="flex-1 -mx-6 px-6">
              {viewAccount && (
                <div className="space-y-4 pb-4">
                  {FIELD_GROUPS.map(group => {
                    const fields = group.keys.filter(k => k in viewAccount);
                    if (!fields.length) return null;
                    return (
                      <div key={group.label}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <group.icon className="w-3 h-3" />{group.label}
                        </p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                          {fields.map(k => (
                            <div key={k} className="flex items-baseline justify-between gap-2 py-1 border-b border-border/30">
                              <span className="text-xs text-muted-foreground truncate">{columnLabel(k)}</span>
                              <span className={`text-sm font-medium text-right ${cellColor(k, viewAccount[k])}`}>{formatCell(k, viewAccount[k])}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {/* Other fields */}
                  {(() => {
                    const grouped = FIELD_GROUPS.flatMap(g => g.keys);
                    const others = Object.keys(viewAccount).filter(k => k !== "_id" && !grouped.includes(k));
                    if (!others.length) return null;
                    return (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Other</p>
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                          {others.map(k => (
                            <div key={k} className="flex items-baseline justify-between gap-2 py-1 border-b border-border/30">
                              <span className="text-xs text-muted-foreground truncate">{columnLabel(k)}</span>
                              <span className={`text-sm font-medium text-right break-all ${cellColor(k, viewAccount[k])}`}>{formatCell(k, viewAccount[k])}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
              {canEdit && <Button onClick={() => { setViewOpen(false); if (viewAccount) openEdit(viewAccount); }}>
                <Pencil className="w-3.5 h-3.5 mr-1.5" />Edit
              </Button>}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══ EDIT DIALOG ═══ */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between pr-8">
                <DialogTitle className="flex items-center gap-2 font-mono">
                  <Pencil className="w-4 h-4" /> Edit Document
                  {isProd && <Badge variant="outline" className="border-orange-500/40 text-orange-400 text-[10px]">PRODUCTION</Badge>}
                </DialogTitle>
                <Button size="sm" variant="outline" className="h-7 text-xs font-mono gap-1" onClick={() => setShowAddField(!showAddField)}>
                  {showAddField ? <X className="w-3 h-3" /> : <>+ Field</>}
                </Button>
              </div>
            <DialogDescription className="font-mono text-xs">_id: {editAccount?._id}</DialogDescription>
              {showAddField && (
                <div className="mt-2 p-3 rounded-md border border-dashed border-emerald-500/40 bg-emerald-500/5 space-y-2">
                  <p className="text-xs font-mono font-semibold text-emerald-500">Add New Field</p>
                  <div className="flex gap-2">
                    <Input placeholder="fieldName" value={newFieldName} onChange={e => setNewFieldName(e.target.value)}
                      className="font-mono text-sm h-8 flex-1" onKeyDown={e => e.key === "Enter" && addNewField()} />
                    <select value={newFieldType} onChange={e => setNewFieldType(e.target.value as FieldType)}
                      className="h-8 border rounded px-2 text-sm bg-background font-mono w-28">
                      <option value="string">String</option>
                      <option value="int32">Int32</option>
                      <option value="int64">Int64</option>
                      <option value="float">Float</option>
                      <option value="number">Number</option>
                      <option value="boolean">Boolean</option>
                      <option value="date">Date</option>
                      <option value="epoch">Epoch</option>
                      <option value="object">Object</option>
                      <option value="array">Array</option>
                    </select>
                    <Button size="sm" className="h-8 px-3" onClick={addNewField}>Add</Button>
                  </div>
                </div>
              )}
            </DialogHeader>
            <div className="flex-1 overflow-y-auto -mx-6 px-6" style={{ minHeight: 0 }}>
              <div className="pb-4">
                {/* ── Plan Info Banner ── */}
                {selectedPlan && (
                  <div className="mb-4 rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-purple-400" /> Current Plan
                      </span>
                      <Badge variant={(selectedPlan as Record<string,unknown>).activeNow ? "default" : "secondary"} className="text-[10px]">
                        {(selectedPlan as Record<string,unknown>).activeNow ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-x-4 gap-y-1">
                      {["planId","appName","planName","planMonthlyCost","planYearlyCost","planMaxUsers"].map(k => {
                        const v = (selectedPlan as Record<string,unknown>)[k];
                        if (v === undefined || v === null) return null;
                        return (
                          <div key={k} className="flex flex-col">
                            <span className="text-[9px] font-mono text-muted-foreground uppercase">{k}</span>
                            <span className="text-xs font-mono font-medium truncate">
                              {COST_KEYS.includes(k) ? `$${v}` : String(v)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {!(selectedPlan) && editForm.planId && (
                  <div className="mb-4 rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10 p-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-mono">Plan: <span className="text-foreground">{String(editForm.planId)}</span> — not found in Plans collection</span>
                  </div>
                )}
                {(() => {
                  const priorityKeys = FIELD_GROUPS.flatMap(g => g.keys).filter(k => k in editForm);
                  const rest = Object.keys(editForm).filter(k => !priorityKeys.includes(k)).sort();
                  // planId shown via Plan Info banner + Change button, appName auto-updated with it
                  const hiddenInForm = ["appName"];
                  return [...priorityKeys, ...rest]
                    .filter(k => !hiddenInForm.includes(k))
                    .map(key => renderEditField(key));
                })()}
              </div>
            </div>

            {/* Changes summary */}
            {changedFields.length > 0 && (
              <div className="rounded-md border border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 px-4 py-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                    {changedFields.length} field{changedFields.length > 1 ? "s" : ""} modified
                  </span>
                  <Button variant="ghost" size="sm" onClick={revertAll}
                    className="text-orange-600 hover:text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/40 h-7 px-2 text-xs">
                    <Undo2 className="w-3.5 h-3.5 mr-1" /> Revert All
                  </Button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {changedFields.map(f => (
                    <Badge key={f} variant="outline"
                      className="text-xs font-mono border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-300 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/40"
                      onClick={() => revertField(f)}>
                      {f} <Undo2 className="w-2.5 h-2.5 ml-1" />
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdate} disabled={isLoading || changedFields.length === 0}
                className={isProd ? "bg-orange-600 hover:bg-orange-700 text-white" : ""}>
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                {isProd ? "Save to Production" : "Save"} {changedFields.length > 0 && `(${changedFields.length})`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══ PRODUCTION CONFIRM SAVE ═══ */}
        <Dialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-orange-500">
                <Shield className="w-5 h-5" /> Confirm Production Update
              </DialogTitle>
              <DialogDescription>
                You are about to update <strong>{changedFields.length} field(s)</strong> in the <strong>production database</strong>.
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-md border border-orange-500/30 bg-orange-500/5 p-3">
              <p className="text-xs font-semibold text-orange-400 mb-2">Fields being changed:</p>
              <div className="flex flex-wrap gap-1">
                {changedFields.map(f => (
                  <Badge key={f} variant="outline" className="text-[10px] font-mono border-orange-500/30 text-orange-300">{columnLabel(f)}</Badge>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmSaveOpen(false)}>Cancel</Button>
              <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={handleUpdate}>
                Confirm & Save to Production
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default WildDeerPage;
