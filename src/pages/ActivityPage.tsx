import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, Download } from "lucide-react";

const mockActivities = [
  { id: "1", action: "New user synced from WildDeer", source: "WildDeer", timestamp: "2 min ago", type: "success" as const },
  { id: "2", action: "Payment received via Stripe", source: "Stripe", timestamp: "15 min ago", type: "success" as const },
  { id: "3", action: "Credits added via API", source: "Credits", timestamp: "1 hour ago", type: "info" as const },
  { id: "4", action: "Sync failed - retrying", source: "WildDeer", timestamp: "2 hours ago", type: "warning" as const },
  { id: "5", action: "Webhook received", source: "Stripe", timestamp: "3 hours ago", type: "info" as const },
  { id: "6", action: "User profile updated", source: "WildDeer", timestamp: "4 hours ago", type: "success" as const },
  { id: "7", action: "Subscription renewed", source: "Stripe", timestamp: "5 hours ago", type: "success" as const },
  { id: "8", action: "API rate limit warning", source: "Credits", timestamp: "6 hours ago", type: "warning" as const },
  { id: "9", action: "Bulk import completed", source: "WildDeer", timestamp: "7 hours ago", type: "success" as const },
  { id: "10", action: "Payment failed - card declined", source: "Stripe", timestamp: "8 hours ago", type: "error" as const },
];

const ActivityPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
            <p className="text-muted-foreground mt-1">
              Monitor all events across integrations
            </p>
          </div>
          <Button variant="outline" className="border-2">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search activity..." 
              className="pl-10 border-2"
            />
          </div>
          <Button variant="outline" className="border-2">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-2 border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-mono uppercase">Total</span>
                <Badge variant="outline" className="font-mono">1,234</Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-mono uppercase">Success</span>
                <Badge className="font-mono bg-chart-2 text-background">892</Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-mono uppercase">Warnings</span>
                <Badge className="font-mono bg-chart-4 text-background">45</Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="border-2 border-border">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground font-mono uppercase">Errors</span>
                <Badge className="font-mono bg-destructive text-destructive-foreground">12</Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        <RecentActivity activities={mockActivities} />
      </div>
    </DashboardLayout>
  );
};

export default ActivityPage;
