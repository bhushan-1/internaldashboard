import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { IntegrationCard } from "@/components/dashboard/IntegrationCard";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { DataTable } from "@/components/dashboard/DataTable";
import { 
  Users, 
  CreditCard, 
  Database, 
  Zap, 
  TrendingUp,
  DollarSign
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const mockActivities = [
  { id: "1", action: "New user synced from WildDeer", source: "WildDeer", timestamp: "2 min ago", type: "success" as const },
  { id: "2", action: "Payment received via Stripe", source: "Stripe", timestamp: "15 min ago", type: "success" as const },
  { id: "3", action: "Credits added via API", source: "Credits", timestamp: "1 hour ago", type: "info" as const },
  { id: "4", action: "Sync failed - retrying", source: "WildDeer", timestamp: "2 hours ago", type: "warning" as const },
  { id: "5", action: "Webhook received", source: "Stripe", timestamp: "3 hours ago", type: "info" as const },
];

const mockUsers = [
  { id: "USR001", name: "John Doe", email: "john@example.com", credits: 150, status: "active" },
  { id: "USR002", name: "Jane Smith", email: "jane@example.com", credits: 320, status: "active" },
  { id: "USR003", name: "Bob Wilson", email: "bob@example.com", credits: 0, status: "inactive" },
  { id: "USR004", name: "Alice Brown", email: "alice@example.com", credits: 75, status: "active" },
  { id: "USR005", name: "Charlie Davis", email: "charlie@example.com", credits: 500, status: "active" },
];

const userColumns = [
  { key: "id", header: "ID" },
  { key: "name", header: "Name" },
  { key: "email", header: "Email" },
  { key: "credits", header: "Credits", render: (item: typeof mockUsers[0]) => (
    <span className="font-mono">{item.credits}</span>
  )},
  { key: "status", header: "Status", render: (item: typeof mockUsers[0]) => (
    <Badge 
      variant={item.status === "active" ? "default" : "secondary"}
      className="font-mono text-xs"
    >
      {item.status}
    </Badge>
  )},
];

const Index = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your integrations and user data
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Total Users"
            value="1,234"
            trend={{ value: 12, isPositive: true }}
            description="from last month"
            icon={<Users className="w-4 h-4 text-primary-foreground" />}
          />
          <MetricCard
            title="Active Credits"
            value="45,678"
            trend={{ value: 8, isPositive: true }}
            description="available credits"
            icon={<Zap className="w-4 h-4 text-primary-foreground" />}
          />
          <MetricCard
            title="Revenue"
            value="$12,345"
            trend={{ value: 23, isPositive: true }}
            description="this month"
            icon={<DollarSign className="w-4 h-4 text-primary-foreground" />}
          />
          <MetricCard
            title="API Calls"
            value="89,012"
            trend={{ value: -3, isPositive: false }}
            description="this week"
            icon={<TrendingUp className="w-4 h-4 text-primary-foreground" />}
          />
        </div>

        {/* Integrations */}
        <div>
          <h2 className="text-xl font-bold mb-4">Integrations</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <IntegrationCard
              name="WildDeer"
              description="User management and analytics platform"
              icon={<Database className="w-6 h-6 text-primary-foreground" />}
              status="connected"
              lastSync="5 minutes ago"
            />
            <IntegrationCard
              name="Stripe"
              description="Payment processing and subscriptions"
              icon={<CreditCard className="w-6 h-6 text-primary-foreground" />}
              status="connected"
              lastSync="2 minutes ago"
            />
            <IntegrationCard
              name="Credits API"
              description="Credit management via API execution"
              icon={<Zap className="w-6 h-6 text-primary-foreground" />}
              status="pending"
              lastSync="Never"
            />
          </div>
        </div>

        {/* Data & Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <DataTable
              title="Recent Users"
              data={mockUsers}
              columns={userColumns}
            />
          </div>
          <div>
            <RecentActivity activities={mockActivities} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
