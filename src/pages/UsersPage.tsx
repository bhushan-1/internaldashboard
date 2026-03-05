import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { DataTable } from "@/components/dashboard/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Download } from "lucide-react";

const mockUsers = [
  { id: "USR001", name: "John Doe", email: "john@example.com", credits: 150, status: "active", source: "WildDeer", joinedAt: "2024-01-15" },
  { id: "USR002", name: "Jane Smith", email: "jane@example.com", credits: 320, status: "active", source: "Stripe", joinedAt: "2024-01-12" },
  { id: "USR003", name: "Bob Wilson", email: "bob@example.com", credits: 0, status: "inactive", source: "WildDeer", joinedAt: "2024-01-10" },
  { id: "USR004", name: "Alice Brown", email: "alice@example.com", credits: 75, status: "active", source: "API", joinedAt: "2024-01-08" },
  { id: "USR005", name: "Charlie Davis", email: "charlie@example.com", credits: 500, status: "active", source: "Stripe", joinedAt: "2024-01-05" },
  { id: "USR006", name: "Eva Martinez", email: "eva@example.com", credits: 200, status: "active", source: "WildDeer", joinedAt: "2024-01-03" },
  { id: "USR007", name: "Frank Lee", email: "frank@example.com", credits: 50, status: "pending", source: "API", joinedAt: "2024-01-02" },
];

const userColumns = [
  { key: "id", header: "ID", render: (item: typeof mockUsers[0]) => (
    <span className="font-mono text-xs">{item.id}</span>
  )},
  { key: "name", header: "Name" },
  { key: "email", header: "Email", render: (item: typeof mockUsers[0]) => (
    <span className="text-muted-foreground">{item.email}</span>
  )},
  { key: "credits", header: "Credits", render: (item: typeof mockUsers[0]) => (
    <span className="font-mono font-bold">{item.credits}</span>
  )},
  { key: "source", header: "Source", render: (item: typeof mockUsers[0]) => (
    <Badge variant="outline" className="font-mono text-xs">{item.source}</Badge>
  )},
  { key: "status", header: "Status", render: (item: typeof mockUsers[0]) => (
    <Badge 
      variant={item.status === "active" ? "default" : item.status === "pending" ? "outline" : "secondary"}
      className="font-mono text-xs"
    >
      {item.status}
    </Badge>
  )},
  { key: "joinedAt", header: "Joined", render: (item: typeof mockUsers[0]) => (
    <span className="text-muted-foreground text-sm">{item.joinedAt}</span>
  )},
];

const UsersPage = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Users</h1>
            <p className="text-muted-foreground mt-1">
              Manage all users across integrations
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" className="border-2">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
            <Button className="border-2">
              <Plus className="w-4 h-4 mr-2" />
              Add User
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search users..." 
              className="pl-10 border-2"
            />
          </div>
        </div>

        <DataTable
          data={mockUsers}
          columns={userColumns}
        />
      </div>
    </DashboardLayout>
  );
};

export default UsersPage;
