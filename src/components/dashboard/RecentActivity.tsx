import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ActivityItem {
  id: string;
  action: string;
  source: string;
  timestamp: string;
  type: "success" | "warning" | "error" | "info";
}

interface RecentActivityProps {
  activities: ActivityItem[];
  className?: string;
}

export function RecentActivity({ activities, className }: RecentActivityProps) {
  const typeConfig = {
    success: "bg-chart-2/10 text-chart-2 border-chart-2/20",
    warning: "bg-chart-4/10 text-chart-4 border-chart-4/20",
    error: "bg-destructive/10 text-destructive border-destructive/20",
    info: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  };

  return (
    <Card className={cn("border-2 border-border", className)}>
      <CardHeader className="border-b-2 border-border">
        <CardTitle className="font-mono text-sm uppercase tracking-wider">
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {activities.map((activity) => (
            <div 
              key={activity.id} 
              className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  activity.type === "success" && "bg-chart-2",
                  activity.type === "warning" && "bg-chart-4",
                  activity.type === "error" && "bg-destructive",
                  activity.type === "info" && "bg-chart-3"
                )} />
                <div>
                  <p className="font-medium text-sm">{activity.action}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {activity.timestamp}
                  </p>
                </div>
              </div>
              <Badge 
                variant="outline" 
                className={cn("font-mono text-xs border", typeConfig[activity.type])}
              >
                {activity.source}
              </Badge>
            </div>
          ))}
          {activities.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No recent activity
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
