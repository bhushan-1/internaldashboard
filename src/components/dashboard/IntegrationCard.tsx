import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface IntegrationCardProps {
  name: string;
  description: string;
  icon: ReactNode;
  status: "connected" | "disconnected" | "pending";
  lastSync?: string;
  onConfigure?: () => void;
  className?: string;
}

export function IntegrationCard({ 
  name, 
  description, 
  icon, 
  status, 
  lastSync,
  onConfigure,
  className 
}: IntegrationCardProps) {
  const statusConfig = {
    connected: { label: "Connected", variant: "default" as const },
    disconnected: { label: "Disconnected", variant: "secondary" as const },
    pending: { label: "Pending", variant: "outline" as const },
  };

  return (
    <Card className={cn("border-2 border-border shadow-sm hover:shadow-md transition-shadow", className)}>
      <CardHeader className="flex flex-row items-start gap-4">
        <div className="w-12 h-12 bg-primary flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-lg font-bold">{name}</CardTitle>
            <Badge variant={statusConfig[status].variant} className="font-mono text-xs">
              {statusConfig[status].label}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          {lastSync && (
            <span className="text-xs text-muted-foreground font-mono">
              Last sync: {lastSync}
            </span>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onConfigure}
            className="ml-auto border-2"
          >
            Configure
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
