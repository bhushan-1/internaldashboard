import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { DataTable } from "@/components/dashboard/DataTable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Zap, Play, CheckCircle, XCircle, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

type Product = 'scaleserp' | 'rainforest' | 'valueserp' | 'asindata' | 'serpwow' | 'bluecartapi' | 'redcircleapi' | 'bigboxapi' | 'backyardapi' | 'countdownapi';
type Operation = 'reset_to_zero' | 'increase_by' | 'decrease_by' | 'set' | 'set_topup' | 'topup_by';

interface TransactionLog {
  id: string;
  product: string;
  operation: string;
  amount: number | null;
  status: 'success' | 'error';
  timestamp: string;
  customerApiKey: string;
}

interface AccountData {
  [key: string]: string | number | boolean | null | undefined;
}

interface ExecutionResult {
  accountBefore: AccountData | null;
  accountAfter: AccountData | null;
  operationResult: Record<string, unknown> | null;
}

const products: { value: Product; label: string }[] = [
  { value: 'serpwow', label: 'SerpWow' },
  { value: 'scaleserp', label: 'Scale SERP' },
  { value: 'valueserp', label: 'VALUE SERP' },
  { value: 'rainforest', label: 'Rainforest API' },
  { value: 'asindata', label: 'ASIN Data API' },
  { value: 'countdownapi', label: 'Countdown API' },
  { value: 'bluecartapi', label: 'BlueCart API' },
  { value: 'bigboxapi', label: 'BigBox API' },
  { value: 'redcircleapi', label: 'RedCircle API' },
  { value: 'backyardapi', label: 'Backyard API' },
];

const productDomains: Record<Product, string> = {
  scaleserp: 'api.scaleserp.com',
  rainforest: 'api.rainforestapi.com',
  valueserp: 'api.valueserp.com',
  asindata: 'api.asindataapi.com',
  serpwow: 'api.serpwow.com',
  bluecartapi: 'api.bluecartapi.com',
  redcircleapi: 'api.redcircleapi.com',
  bigboxapi: 'api.bigboxapi.com',
  backyardapi: 'api.backyardapi.com',
  countdownapi: 'api.countdownapi.com',
};

const operations: { value: Operation; label: string; tooltip: string; requiresAmount: boolean; topUpOnly: boolean }[] = [
  { value: 'reset_to_zero', label: 'Reset to Zero', tooltip: 'This endpoint will reset the credits_used to zero.', requiresAmount: false, topUpOnly: false },
  { value: 'increase_by', label: 'Increase By (Charge)', tooltip: 'This endpoint will charge user credits. Using this will update the credits_used.', requiresAmount: true, topUpOnly: false },
  { value: 'decrease_by', label: 'Decrease By (Grant)', tooltip: 'This endpoint will grant user credits. Using this will update the credits_remaining.', requiresAmount: true, topUpOnly: false },
  { value: 'set', label: 'Set Credits Used', tooltip: 'This endpoint will set the credits_used of the user.', requiresAmount: true, topUpOnly: false },
  { value: 'set_topup', label: 'Set Top-Up Balance', tooltip: 'Credit Balance - Set Top Up (set the topup_credits_remaining)', requiresAmount: true, topUpOnly: true },
  { value: 'topup_by', label: 'Top-Up By', tooltip: 'Credit Balance - Top Up By (increase the topup_credits_remaining)', requiresAmount: true, topUpOnly: true },
];

const CreditsPage = () => {
  const [product, setProduct] = useState<Product | ''>('');
  const [customerApiKey, setCustomerApiKey] = useState('');
  const [authKey, setAuthKey] = useState('');
  const [operation, setOperation] = useState<Operation | ''>('');
  const [creditAmount, setCreditAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [transactionLogs, setTransactionLogs] = useState<TransactionLog[]>([]);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);

  const selectedOperation = operations.find(op => op.value === operation);
  const isTopUpProduct = product === 'valueserp' || product === 'asindata';

  const filteredOperations = operations.filter(op => !op.topUpOnly || isTopUpProduct);

  const fetchAccountData = async (productValue: Product, apiKey: string): Promise<AccountData | null> => {
    try {
      const domain = productDomains[productValue];
      const response = await fetch(`https://${domain}/account?api_key=${apiKey}`);
      if (!response.ok) {
        console.error('Failed to fetch account data:', response.status);
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('Error fetching account data:', error);
      return null;
    }
  };

  const handleExecute = async () => {
    if (!product || !customerApiKey || !operation) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (selectedOperation?.requiresAmount && !creditAmount) {
      toast.error('Please enter a credit amount for this operation');
      return;
    }

    setIsLoading(true);
    setExecutionResult(null);

    try {
      // Fetch account data BEFORE operation
      const accountBefore = await fetchAccountData(product, customerApiKey);

      // Execute the credit operation via direct API call
      // Note: The set-credits edge function is no longer available.
      // Credit operations now go directly to the product APIs.
      const domain = productDomains[product];
      let operationResult: Record<string, unknown> = {};
      try {
        const params = new URLSearchParams({ api_key: customerApiKey });
        if (selectedOperation?.requiresAmount) params.append('credit_adjustment', creditAmount);
        if (authKey) params.append('auth_key', authKey);
        const res = await fetch(`https://${domain}/account/credits/${operation}?${params.toString()}`, { method: 'POST' });
        operationResult = await res.json();
      } catch (apiErr) {
        operationResult = { error: apiErr instanceof Error ? apiErr.message : 'API call failed' };
      }

      // Fetch account data AFTER operation
      const accountAfter = await fetchAccountData(product, customerApiKey);

      // Set execution result for display
      setExecutionResult({
        accountBefore,
        accountAfter,
        operationResult,
      });

      const hasError = 'error' in operationResult;

      const newLog: TransactionLog = {
        id: `TXN-${Date.now()}`,
        product: products.find(p => p.value === product)?.label || product,
        operation: selectedOperation?.label || operation,
        amount: selectedOperation?.requiresAmount ? parseInt(creditAmount, 10) : null,
        status: hasError ? 'error' : 'success',
        timestamp: new Date().toLocaleString(),
        customerApiKey: `${customerApiKey.slice(0, 8)}...`,
      };

      setTransactionLogs(prev => [newLog, ...prev]);

      if (hasError) {
        toast.error(`API Error: ${String(operationResult.error)}`);
      } else {
        toast.success('Operation executed successfully');
        setCreditAmount('');
      }
    } catch (err) {
      console.error('Error executing credits operation:', err);
      toast.error('Failed to execute operation');
    } finally {
      setIsLoading(false);
    }
  };

  const logsColumns = [
    { key: "id", header: "Transaction", render: (item: TransactionLog) => (
      <span className="font-mono text-xs">{item.id}</span>
    )},
    { key: "product", header: "Product", render: (item: TransactionLog) => (
      <Badge variant="outline" className="font-mono text-xs">{item.product}</Badge>
    )},
    { key: "operation", header: "Operation", render: (item: TransactionLog) => (
      <span className="text-sm">{item.operation}</span>
    )},
    { key: "amount", header: "Amount", render: (item: TransactionLog) => (
      <span className="font-mono">{item.amount !== null ? item.amount.toLocaleString() : '—'}</span>
    )},
    { key: "status", header: "Status", render: (item: TransactionLog) => (
      <Badge 
        variant={item.status === 'success' ? "default" : "destructive"}
        className="font-mono text-xs"
      >
        {item.status === 'success' ? (
          <><CheckCircle className="w-3 h-3 mr-1" /> Success</>
        ) : (
          <><XCircle className="w-3 h-3 mr-1" /> Error</>
        )}
      </Badge>
    )},
    { key: "timestamp", header: "Timestamp", render: (item: TransactionLog) => (
      <span className="text-muted-foreground text-sm">{item.timestamp}</span>
    )},
  ];

  // Get all unique keys from account data for display
  const getAccountKeys = (): string[] => {
    const keys = new Set<string>();
    if (executionResult?.accountBefore) {
      Object.keys(executionResult.accountBefore).forEach(k => keys.add(k));
    }
    if (executionResult?.accountAfter) {
      Object.keys(executionResult.accountAfter).forEach(k => keys.add(k));
    }
    return Array.from(keys);
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Credits API</h1>
                <p className="text-muted-foreground mt-1">
                  Credit management via API execution
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              title="Operations Today"
              value={transactionLogs.length.toString()}
              description="API calls made"
              icon={<Zap className="w-4 h-4 text-primary-foreground" />}
            />
            <MetricCard
              title="Successful"
              value={transactionLogs.filter(l => l.status === 'success').length.toString()}
              description="operations completed"
            />
            <MetricCard
              title="Failed"
              value={transactionLogs.filter(l => l.status === 'error').length.toString()}
              description="operations failed"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-2 border-border lg:col-span-1">
              <CardHeader className="border-b-2 border-border">
                <CardTitle className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
                  <Play className="w-4 h-4" />
                  Execute Credit Operation
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="product" className="font-mono text-xs uppercase">Product / API</Label>
                  <Select value={product} onValueChange={(value) => {
                    setProduct(value as Product);
                    if (operation && operations.find(op => op.value === operation)?.topUpOnly) {
                      const newIsTopUp = value === 'valueserp' || value === 'asindata';
                      if (!newIsTopUp) {
                        setOperation('');
                      }
                    }
                  }}>
                    <SelectTrigger className="border-2">
                      <SelectValue placeholder="Select product" />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerApiKey" className="font-mono text-xs uppercase">Customer API Key</Label>
                  <Input 
                    id="customerApiKey" 
                    placeholder="Enter customer's API key" 
                    className="border-2 font-mono"
                    value={customerApiKey}
                    onChange={(e) => setCustomerApiKey(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="authKey" className="font-mono text-xs uppercase">Auth Key (Optional)</Label>
                  <Input 
                    id="authKey" 
                    type="password"
                    placeholder="Enter auth key for authorized operations" 
                    className="border-2 font-mono"
                    value={authKey}
                    onChange={(e) => setAuthKey(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Required for certain administrative credit operations
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="operation" className="font-mono text-xs uppercase">Operation</Label>
                  <Select value={operation} onValueChange={(value) => setOperation(value as Operation)}>
                    <SelectTrigger className="border-2">
                      <SelectValue placeholder="Select operation" />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {filteredOperations.map((op) => (
                        <SelectItem key={op.value} value={op.value}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2 cursor-pointer">
                                <span>{op.label}</span>
                                <Info className="w-3 h-3 text-muted-foreground" />
                              </div>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-xs z-[300]">
                              <p className="text-sm">{op.tooltip}</p>
                            </TooltipContent>
                          </Tooltip>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedOperation?.requiresAmount && (
                  <div className="space-y-2">
                    <Label htmlFor="creditAmount" className="font-mono text-xs uppercase">Credit Amount</Label>
                    <Input 
                      id="creditAmount" 
                      type="number" 
                      placeholder="e.g., 1000" 
                      className="border-2 font-mono"
                      value={creditAmount}
                      onChange={(e) => setCreditAmount(e.target.value)}
                      min="0"
                    />
                  </div>
                )}

                <Button 
                  className="w-full border-2" 
                  onClick={handleExecute}
                  disabled={isLoading || !product || !customerApiKey || !operation}
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executing...</>
                  ) : (
                    <><Play className="w-4 h-4 mr-2" /> Execute Operation</>
                  )}
                </Button>

                <div className="pt-4 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    <strong>Note:</strong> For subscription-based accounts, credits reset when the subscription rolls over. 
                    Top-up operations are only available for ValueSERP and ASIN DATA.
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="lg:col-span-2 space-y-6">
              {/* Account Data Before/After Comparison */}
              {executionResult && (executionResult.accountBefore || executionResult.accountAfter) && (
                <Card className="border-2 border-border">
                  <CardHeader className="border-b-2 border-border">
                    <CardTitle className="font-mono text-sm uppercase tracking-wider">
                      Account Data Comparison
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-border hover:bg-transparent">
                          <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-12">Field</TableHead>
                          <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-12">Before</TableHead>
                          <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-12">After</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getAccountKeys().map((key) => {
                          const beforeVal = executionResult.accountBefore?.[key];
                          const afterVal = executionResult.accountAfter?.[key];
                          const hasChanged = formatValue(beforeVal) !== formatValue(afterVal);
                          return (
                            <TableRow key={key} className="border-b border-border/50 hover:bg-accent/50">
                              <TableCell className="font-mono text-sm font-medium">{key}</TableCell>
                              <TableCell className="font-mono text-sm">{formatValue(beforeVal)}</TableCell>
                              <TableCell className={`font-mono text-sm ${hasChanged ? 'text-primary font-bold' : ''}`}>
                                {formatValue(afterVal)}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              {/* Operation Result Output */}
              {executionResult?.operationResult && (
                <Card className="border-2 border-border">
                  <CardHeader className="border-b-2 border-border">
                    <CardTitle className="font-mono text-sm uppercase tracking-wider">
                      Operation Result
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b-2 border-border hover:bg-transparent">
                          {Object.keys(executionResult.operationResult).map((key) => (
                            <TableHead key={key} className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-12">
                              {key}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow className="border-b border-border/50 hover:bg-accent/50">
                          {Object.values(executionResult.operationResult).map((value, index) => (
                            <TableCell key={index} className="font-mono text-sm">
                              {formatValue(value)}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}

              <DataTable
                title="Transaction Logs"
                data={transactionLogs}
                columns={logsColumns}
              />
            </div>
          </div>

        </div>
      </TooltipProvider>
    </DashboardLayout>
  );
};

export default CreditsPage;
