import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DataTable } from "@/components/dashboard/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, RefreshCw, Settings, CheckCircle, DollarSign } from "lucide-react";

const mockStripeData = [
  { id: "pi_001", customerId: "cus_001", amount: 99.99, status: "succeeded", created: "2024-01-20 14:32:00" },
  { id: "pi_002", customerId: "cus_002", amount: 49.99, status: "succeeded", created: "2024-01-20 13:15:00" },
  { id: "pi_003", customerId: "cus_003", amount: 199.99, status: "pending", created: "2024-01-20 12:00:00" },
  { id: "pi_004", customerId: "cus_001", amount: 29.99, status: "succeeded", created: "2024-01-20 10:45:00" },
  { id: "pi_005", customerId: "cus_004", amount: 149.99, status: "failed", created: "2024-01-20 09:30:00" },
];

const stripeColumns = [
  { key: "id", header: "Payment ID", render: (item: typeof mockStripeData[0]) => (
    <span className="font-mono text-xs">{item.id}</span>
  )},
  { key: "customerId", header: "Customer", render: (item: typeof mockStripeData[0]) => (
    <span className="font-mono">{item.customerId}</span>
  )},
  { key: "amount", header: "Amount", render: (item: typeof mockStripeData[0]) => (
    <span className="font-bold">${item.amount.toFixed(2)}</span>
  )},
  { key: "status", header: "Status", render: (item: typeof mockStripeData[0]) => (
    <Badge 
      variant={item.status === "succeeded" ? "default" : item.status === "pending" ? "outline" : "destructive"}
      className="font-mono text-xs"
    >
      {item.status}
    </Badge>
  )},
  { key: "created", header: "Created", render: (item: typeof mockStripeData[0]) => (
    <span className="text-muted-foreground text-sm">{item.created}</span>
  )},
];

const StripePage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Stripe</h1>
              <p className="text-muted-foreground mt-1">
                Payment processing and subscriptions
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-2">
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </Button>
            <Button className="border-2">
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync Now
            </Button>
          </div>
        </div>

        <Card className="border-2 border-border">
          <CardHeader className="border-b-2 border-border">
            <CardTitle className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-chart-2" />
              Connection Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Webhook Connected</p>
                <p className="text-sm text-muted-foreground">Last event: 2 minutes ago</p>
              </div>
              <Badge className="font-mono">Active</Badge>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="Total Revenue"
            value="$45,678"
            trend={{ value: 23, isPositive: true }}
            description="this month"
            icon={<DollarSign className="w-4 h-4 text-primary-foreground" />}
          />
          <MetricCard
            title="Transactions"
            value="1,234"
            trend={{ value: 12, isPositive: true }}
            description="this month"
          />
          <MetricCard
            title="Success Rate"
            value="98.5%"
            description="payment success"
          />
          <MetricCard
            title="Avg. Order"
            value="$37.02"
            trend={{ value: 5, isPositive: true }}
            description="per transaction"
          />
        </div>

        <DataTable
          title="Recent Transactions"
          data={mockStripeData}
          columns={stripeColumns}
        />
      </div>
    </DashboardLayout>
  );
};

export default StripePage;
