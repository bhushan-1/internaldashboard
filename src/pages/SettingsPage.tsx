import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Key, Bell, Shield, Database, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ChangePasswordDialog } from "@/components/auth/ChangePasswordDialog";

const SettingsPage = () => {
  const { user, userRole } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your dashboard and integrations
          </p>
        </div>

        <Card className="border-2 border-border">
          <CardHeader className="border-b-2 border-border">
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Account
            </CardTitle>
            <CardDescription>Manage your account settings</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email</p>
                <p className="text-sm text-muted-foreground font-mono">{user?.email}</p>
              </div>
              <Badge variant="outline" className="font-mono">{userRole || "user"}</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Password</p>
                <p className="text-sm text-muted-foreground">Update your password</p>
              </div>
              <ChangePasswordDialog />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border">
          <CardHeader className="border-b-2 border-border">
            <CardTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              API Keys
            </CardTitle>
            <CardDescription>Manage your API keys for integrations</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="wilddeer-key" className="font-mono text-xs uppercase">WildDeer API Key</Label>
              <div className="flex gap-2">
                <Input 
                  id="wilddeer-key" 
                  type="password" 
                  placeholder="wd_live_..." 
                  className="border-2 font-mono"
                />
                <Button variant="outline" className="border-2 shrink-0">Update</Button>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="stripe-key" className="font-mono text-xs uppercase">Stripe Secret Key</Label>
              <div className="flex gap-2">
                <Input 
                  id="stripe-key" 
                  type="password" 
                  placeholder="sk_live_..." 
                  className="border-2 font-mono"
                />
                <Button variant="outline" className="border-2 shrink-0">Update</Button>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="credits-key" className="font-mono text-xs uppercase">Credits API Key</Label>
              <div className="flex gap-2">
                <Input 
                  id="credits-key" 
                  type="password" 
                  placeholder="cr_..." 
                  className="border-2 font-mono"
                />
                <Button variant="outline" className="border-2 shrink-0">Update</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border">
          <CardHeader className="border-b-2 border-border">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </CardTitle>
            <CardDescription>Configure notification preferences</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Email Alerts</p>
                <p className="text-sm text-muted-foreground">Receive email for important events</p>
              </div>
              <Switch />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sync Failures</p>
                <p className="text-sm text-muted-foreground">Alert when sync operations fail</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Payment Events</p>
                <p className="text-sm text-muted-foreground">Notify on payment success/failure</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border">
          <CardHeader className="border-b-2 border-border">
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Sync
            </CardTitle>
            <CardDescription>Configure data synchronization settings</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Auto Sync</p>
                <p className="text-sm text-muted-foreground">Automatically sync data every 5 minutes</p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Webhook Processing</p>
                <p className="text-sm text-muted-foreground">Process webhooks in real-time</p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 border-border">
          <CardHeader className="border-b-2 border-border">
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security
            </CardTitle>
            <CardDescription>Security and access settings</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Two-Factor Authentication</p>
                <p className="text-sm text-muted-foreground">Add an extra layer of security</p>
              </div>
              <Badge variant="outline" className="font-mono">Coming Soon</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Session Timeout</p>
                <p className="text-sm text-muted-foreground">Auto logout after 30 minutes of inactivity</p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button className="border-2">Save All Changes</Button>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SettingsPage;
