import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download, Activity } from "lucide-react";

const mockActivities = [
  { id: "1", action: "New user synced from WildDeer", source: "WildDeer", timestamp: "2 min ago", type: "success" as const },
  { id: "2", action: "Document uploaded to Confluence", source: "Confluence", timestamp: "15 min ago", type: "success" as const },
  { id: "3", action: "User permission updated", source: "Admin", timestamp: "1 hour ago", type: "info" as const },
  { id: "4", action: "Sync failed - retrying", source: "WildDeer", timestamp: "2 hours ago", type: "warning" as const },
  { id: "5", action: "New user logged in", source: "Auth", timestamp: "3 hours ago", type: "info" as const },
  { id: "6", action: "User profile updated", source: "WildDeer", timestamp: "4 hours ago", type: "success" as const },
  { id: "7", action: "Confluence AI query", source: "Confluence", timestamp: "5 hours ago", type: "info" as const },
  { id: "8", action: "Bulk export completed", source: "WildDeer", timestamp: "7 hours ago", type: "success" as const },
];

const typeColors: Record<string, string> = {
  success: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  info: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  warning: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  error: "bg-red-500/10 text-red-500 border-red-500/20",
};

const ActivityPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary flex items-center justify-center rounded-lg">
              <Activity className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
              <p className="text-muted-foreground mt-1">Monitor all events</p>
            </div>
          </div>
        </div>
        <Card>
          <CardContent className="p-0 divide-y">
            {mockActivities.map(a => (
              <div key={a.id} className="flex items-center gap-4 px-4 py-3 hover:bg-muted/30 transition-colors">
                <Badge variant="outline" className={`text-[10px] font-mono ${typeColors[a.type]}`}>{a.type}</Badge>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{a.action}</p>
                  <p className="text-xs text-muted-foreground">{a.source}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{a.timestamp}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ActivityPage;
