import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Search, 
  Download, 
  Loader2, 
  User, 
  AlertCircle, 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft,
  ArrowUpDown,
  FileSearch
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

type Product = 'scaleserp' | 'rainforest' | 'valueserp' | 'asindata' | 'serpwow' | 'bluecartapi' | 'redcircleapi' | 'bigboxapi' | 'backyardapi' | 'countdownapi';
type EndpointType = 'account' | 'errorlogs';
type SortBy = 'date' | 'count';
type SortDirection = 'ascending' | 'descending';
type ExportFormat = 'csv' | 'json';

interface LookupData {
  [key: string]: unknown;
}

interface AccountInfo {
  api_key?: string;
  name?: string;
  email?: string;
  plan?: string;
  credits_used?: number;
  credits_remaining?: number;
  credits_reset_at?: string;
  destinations_used?: number;
  destinations_limit?: number;
  destinations_available?: number;
  destinations_external_ips?: string[];
  overage_allowed?: boolean;
  batches_used?: number;
  batches_limit?: number;
  batches_available?: number;
  usage_history?: UsageMonth[];
  [key: string]: unknown;
}

interface UsageMonth {
  month: string;
  year: number;
  month_number: number;
  is_current_month: boolean;
  credits_total_for_month: number;
  credits_total_per_day: Record<string, number>;
}

interface ErrorLog {
  id: string;
  engine_url: string;
  api_url: string;
  date: string;
  count: number;
  parameters: Record<string, unknown>;
  result: {
    request_info: {
      success: boolean;
      message?: string;
    };
  };
}

interface ErrorLogsResponse {
  request_info: { success: boolean };
  logs: ErrorLog[];
  page: number;
  page_count_total: number;
  results_count: number;
  results_count_total: number;
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

const fieldLabels: Record<string, string> = {
  api_key: 'API Key',
  name: 'Account Name',
  email: 'Email Address',
  plan: 'Plan Type',
  credits_used: 'Credits Used',
  credits_remaining: 'Credits Remaining',
  credits_reset_at: 'Credits Reset Date',
  destinations_used: 'Destinations Used',
  destinations_limit: 'Destinations Limit',
  destinations_available: 'Destinations Available',
  destinations_external_ips: 'External IP Addresses',
  overage_allowed: 'Overage Allowed',
  batches_used: 'Batches Used',
  batches_limit: 'Batches Limit',
  batches_available: 'Batches Available',
  success: 'Request Status',
  id: 'Log ID',
  engine_url: 'Engine URL',
  api_url: 'API URL',
  date: 'Date',
  count: 'Occurrence Count',
  parameters: 'Parameters',
  result: 'Result',
};

const AccountLookupPage = () => {
  const [product, setProduct] = useState<Product | ''>('');
  const [apiKey, setApiKey] = useState('');
  const [endpointType, setEndpointType] = useState<EndpointType>('account');
  const [isLoading, setIsLoading] = useState(false);
  const [lookupData, setLookupData] = useState<LookupData | null>(null);
  const [statusExpanded, setStatusExpanded] = useState(false);

  // Error Logs specific state
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('descending');
  const [errorLogsData, setErrorLogsData] = useState<ErrorLogsResponse | null>(null);
  const [pagesToFetch, setPagesToFetch] = useState<string>('1');
  const [allPagesData, setAllPagesData] = useState<ErrorLog[]>([]);
  const [isFetchingAll, setIsFetchingAll] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [fetchProgress, setFetchProgress] = useState<{ current: number; total: number } | null>(null);

  const handleEndpointChange = (newType: EndpointType) => {
    setEndpointType(newType);
    setLookupData(null);
    setErrorLogsData(null);
    setCurrentPage(1);
    setSearchTerm('');
    setPagesToFetch('1');
    setAllPagesData([]);
    setFetchProgress(null);
  };

  const fetchErrorLogsPage = async (page: number): Promise<ErrorLogsResponse> => {
    const domain = productDomains[product];
    const params = new URLSearchParams({ api_key: apiKey });
    params.append('page', page.toString());
    params.append('sort_by', sortBy);
    params.append('sort_direction', sortDirection);
    if (searchTerm.trim()) {
      params.append('search_term', searchTerm.trim());
    }

    const response = await fetch(`https://${domain}/errorlogs?${params.toString()}`);
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait before retrying (60 requests/minute limit).');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
  };

  const fetchData = async (page: number = 1) => {
    if (!product || !apiKey) {
      toast.error('Please select a product and enter an API key');
      return;
    }

    setIsLoading(true);
    if (endpointType === 'account') {
      setLookupData(null);
    }
    setAllPagesData([]);
    setFetchProgress(null);

    try {
      const domain = productDomains[product];
      
      if (endpointType === 'account') {
        const response = await fetch(`https://${domain}/account?api_key=${apiKey}`);
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error('Rate limit exceeded. Please wait before retrying (60 requests/minute limit).');
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        setLookupData(data);
        toast.success('Account data fetched successfully');
      } else {
        // Single page fetch for display
        const data = await fetchErrorLogsPage(page);
        setErrorLogsData(data);
        setCurrentPage(page);
        toast.success(`Error logs fetched successfully (${data.results_count} of ${data.results_count_total} total)`);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(`Failed to fetch data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMultiplePages = async () => {
    if (!product || !apiKey) {
      toast.error('Please select a product and enter an API key');
      return;
    }

    const numPages = parseInt(pagesToFetch) || 1;
    setIsFetchingAll(true);
    setAllPagesData([]);
    setFetchProgress({ current: 0, total: numPages });

    try {
      // First fetch to get page_count_total and first page data
      const firstPage = await fetchErrorLogsPage(1);
      const totalAvailable = firstPage.page_count_total;
      
      if (totalAvailable === 0) {
        setErrorLogsData(firstPage);
        toast.info('No error logs found');
        setIsFetchingAll(false);
        setFetchProgress(null);
        return;
      }

      // Cap pages to fetch at what's actually available
      const actualPages = Math.min(numPages, totalAvailable);
      setFetchProgress({ current: 1, total: actualPages });

      let allLogs: ErrorLog[] = [...firstPage.logs];
      setErrorLogsData(firstPage);

      // Fetch remaining pages in background
      for (let page = 2; page <= actualPages; page++) {
        setFetchProgress({ current: page, total: actualPages });
        
        // Small delay to avoid rate limiting (60 req/min = 1 per second max)
        await new Promise(resolve => setTimeout(resolve, 1100));
        
        const pageData = await fetchErrorLogsPage(page);
        allLogs = [...allLogs, ...pageData.logs];
        
        // Update state incrementally so user sees progress
        setAllPagesData([...allLogs]);
      }

      setAllPagesData(allLogs);
      toast.success(`Fetched ${allLogs.length} error logs from ${actualPages} page${actualPages > 1 ? 's' : ''}`);
    } catch (error) {
      console.error('Error fetching pages:', error);
      toast.error(`Failed to fetch pages: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsFetchingAll(false);
      setFetchProgress(null);
    }
  };

  const handleFetchClick = () => {
    if (endpointType === 'errorlogs') {
      const numPages = parseInt(pagesToFetch) || 1;
      if (numPages > 1) {
        fetchMultiplePages();
      } else {
        fetchData(1);
      }
    } else {
      fetchData(1);
    }
  };

  const formatValue = (value: unknown, key?: string): string => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (key?.includes('reset_at') || key?.includes('date') || key?.includes('_at')) {
      try {
        return new Date(String(value)).toLocaleString();
      } catch {
        return String(value);
      }
    }
    if (typeof value === 'number') return value.toLocaleString();
    if (Array.isArray(value)) {
      if (value.every(v => typeof v === 'string')) {
        return value.join(', ');
      }
      return JSON.stringify(value);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const getLabel = (key: string): string => {
    return fieldLabels[key] || key.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const downloadData = () => {
    if (endpointType === 'account' && !lookupData) {
      toast.error('No data to download');
      return;
    }
    if (endpointType === 'errorlogs' && !errorLogsData && allPagesData.length === 0) {
      toast.error('No data to download');
      return;
    }

    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const pagesLabel = allPagesData.length > 0 ? `${pagesToFetch}pages_` : '';

      if (endpointType === 'account') {
        // Account data always downloads as XLSX (multi-sheet)
        const workbook = XLSX.utils.book_new();
        const accountInfo = (lookupData as LookupData).account_info as AccountInfo | undefined;
        const requestInfo = (lookupData as LookupData).request_info as Record<string, unknown> | undefined;

        const overviewData: { Field: string; Value: string }[] = [];
        if (requestInfo) {
          Object.entries(requestInfo).forEach(([key, value]) => {
            overviewData.push({ Field: getLabel(key), Value: formatValue(value, key) });
          });
        }
        if (accountInfo) {
          const excludeKeys = ['usage_history', 'destinations_external_ips'];
          Object.entries(accountInfo).forEach(([key, value]) => {
            if (!excludeKeys.includes(key)) {
              overviewData.push({ Field: getLabel(key), Value: formatValue(value, key) });
            }
          });
          if (accountInfo.destinations_external_ips) {
            overviewData.push({
              Field: getLabel('destinations_external_ips'),
              Value: accountInfo.destinations_external_ips.join(', ')
            });
          }
        }

        const overviewSheet = XLSX.utils.json_to_sheet(overviewData);
        XLSX.utils.book_append_sheet(workbook, overviewSheet, 'Account Overview');

        if (accountInfo?.usage_history && accountInfo.usage_history.length > 0) {
          const usageData = accountInfo.usage_history.map(month => ({
            'Month': month.month,
            'Year': month.year,
            'Current Month': month.is_current_month ? 'Yes' : 'No',
            'Total Credits': month.credits_total_for_month.toLocaleString(),
          }));
          const usageSheet = XLSX.utils.json_to_sheet(usageData);
          XLSX.utils.book_append_sheet(workbook, usageSheet, 'Usage History');

          accountInfo.usage_history.forEach((month) => {
            const dailyData = Object.entries(month.credits_total_per_day).map(([day, credits]) => ({
              'Day': parseInt(day),
              'Credits Used': (credits as number).toLocaleString(),
            }));
            if (dailyData.length > 0) {
              const sheetName = `Daily - ${month.month} ${month.year}`.substring(0, 31);
              const dailySheet = XLSX.utils.json_to_sheet(dailyData);
              XLSX.utils.book_append_sheet(workbook, dailySheet, sheetName);
            }
          });
        }

        const fileName = `${product}_account_${timestamp}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        toast.success(`Downloaded ${fileName}`);
      } else {
        // Error logs — download in user-selected format
        const logsToExport = allPagesData.length > 0 ? allPagesData : (errorLogsData?.logs || []);

        if (exportFormat === 'json') {
          const jsonData = {
            product,
            exported_at: new Date().toISOString(),
            total_logs: logsToExport.length,
            pages_fetched: allPagesData.length > 0 ? parseInt(pagesToFetch) || 1 : 1,
            total_pages_available: errorLogsData?.page_count_total || 0,
            logs: logsToExport.map(log => ({
              id: log.id,
              date: log.date,
              count: log.count,
              engine_url: log.engine_url,
              api_url: log.api_url,
              parameters: log.parameters,
              success: log.result?.request_info?.success ?? null,
              message: log.result?.request_info?.message || null,
            })),
          };

          const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${product}_errorlogs_${pagesLabel}${timestamp}.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success(`Downloaded ${a.download}`);
        } else {
          // CSV format
          const rows = logsToExport.map(log => ({
            'Log ID': log.id,
            'Date': new Date(log.date).toISOString(),
            'Occurrence Count': log.count,
            'Engine URL': log.engine_url,
            'API URL': log.api_url,
            'Parameters': JSON.stringify(log.parameters),
            'Success': log.result?.request_info?.success ? 'Yes' : 'No',
            'Message': log.result?.request_info?.message || '',
          }));

          const worksheet = XLSX.utils.json_to_sheet(rows);
          const csvContent = XLSX.utils.sheet_to_csv(worksheet);
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${product}_errorlogs_${pagesLabel}${timestamp}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success(`Downloaded ${a.download}`);
        }
      }
    } catch (error) {
      console.error('Error downloading:', error);
      toast.error('Failed to download file');
    }
  };

  const renderAccountData = () => {
    if (!lookupData) return null;

    const accountInfo = (lookupData as LookupData).account_info as AccountInfo | undefined;
    const requestInfo = (lookupData as LookupData).request_info as Record<string, unknown> | undefined;

    const mainFields: { key: string; value: unknown }[] = [];
    const statusFields: { key: string; value: unknown }[] = [];
    
    if (requestInfo) {
      Object.entries(requestInfo).forEach(([key, value]) => {
        if (key === 'success' || key === 'status') {
          statusFields.push({ key, value });
        } else {
          mainFields.push({ key, value });
        }
      });
    }

    if (accountInfo) {
      const excludeKeys = ['usage_history'];
      Object.entries(accountInfo).forEach(([key, value]) => {
        if (!excludeKeys.includes(key)) {
          mainFields.push({ key, value });
        }
      });
    }

    return (
      <div className="space-y-6">
        {statusFields.length > 0 && (
          <Collapsible open={statusExpanded} onOpenChange={setStatusExpanded}>
            <CollapsibleTrigger className="flex items-center gap-2 font-mono text-sm uppercase tracking-wider text-muted-foreground mb-3 hover:text-foreground transition-colors cursor-pointer">
              {statusExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Request Status
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-b-2 border-border hover:bg-transparent">
                    <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10 w-1/3">Field</TableHead>
                    <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusFields.map(({ key, value }) => (
                    <TableRow key={key} className="border-b border-border/50 hover:bg-accent/50">
                      <TableCell className="text-sm font-medium py-2">{getLabel(key)}</TableCell>
                      <TableCell className="text-sm py-2">{formatValue(value, key)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div>
          <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-3">Account Overview</h3>
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-border hover:bg-transparent">
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10 w-1/3">Field</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10">Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mainFields.map(({ key, value }) => (
                <TableRow key={key} className="border-b border-border/50 hover:bg-accent/50">
                  <TableCell className="text-sm font-medium py-2">{getLabel(key)}</TableCell>
                  <TableCell className="text-sm py-2">{formatValue(value, key)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {accountInfo?.usage_history && accountInfo.usage_history.length > 0 && (
          <div>
            <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-3">Monthly Usage History</h3>
            <Table>
              <TableHeader>
                <TableRow className="border-b-2 border-border hover:bg-transparent">
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10">Month</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10">Year</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10">Current</TableHead>
                  <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10 text-right">Total Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accountInfo.usage_history.map((month, idx) => (
                  <TableRow key={idx} className="border-b border-border/50 hover:bg-accent/50">
                    <TableCell className="text-sm py-2">{month.month}</TableCell>
                    <TableCell className="text-sm py-2">{month.year}</TableCell>
                    <TableCell className="text-sm py-2">{month.is_current_month ? 'Yes' : 'No'}</TableCell>
                    <TableCell className="text-sm py-2 text-right font-mono">{month.credits_total_for_month.toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {accountInfo?.usage_history && accountInfo.usage_history.map((month, monthIdx) => {
          const dailyEntries = Object.entries(month.credits_total_per_day)
            .map(([day, credits]) => ({ day: parseInt(day), credits: credits as number }))
            .sort((a, b) => a.day - b.day);

          if (dailyEntries.length === 0) return null;

          return (
            <div key={monthIdx}>
              <h3 className="font-mono text-sm uppercase tracking-wider text-muted-foreground mb-3">
                Daily Usage - {month.month} {month.year} {month.is_current_month && <span className="text-primary">(Current)</span>}
              </h3>
              <div className="grid grid-cols-7 gap-2">
                {dailyEntries.map(({ day, credits }) => (
                  <div 
                    key={day} 
                    className={`p-2 border rounded text-center ${credits > 0 ? 'bg-primary/10 border-primary/30' : 'border-border'}`}
                  >
                    <div className="text-xs text-muted-foreground">Day {day}</div>
                    <div className={`text-sm font-mono ${credits > 0 ? 'font-medium' : 'text-muted-foreground'}`}>
                      {credits.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderErrorLogs = () => {
    // If we have allPagesData, show that instead
    const showAllPages = allPagesData.length > 0;
    const logsToDisplay = showAllPages ? allPagesData : (errorLogsData?.logs || []);
    
    if (!errorLogsData && !showAllPages) return null;

    const { page = 1, page_count_total = 1, results_count = 0, results_count_total = 0 } = errorLogsData || {};
    
    if (logsToDisplay.length === 0 && !isFetchingAll) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No error logs found
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Pagination Info */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {showAllPages ? (
              <>Showing {allPagesData.length} logs from {Math.min(parseInt(pagesToFetch) || 1, page_count_total)} page{(Math.min(parseInt(pagesToFetch) || 1, page_count_total)) > 1 ? 's' : ''} (of {page_count_total} available)</>
            ) : (
              <>Showing {results_count} of {results_count_total} total logs (Page {page} of {page_count_total})</>
            )}
          </span>
          <span className="text-xs">
            Rate limit: 60 requests/minute
          </span>
        </div>

        {isFetchingAll && (
          <div className="flex items-center gap-2 text-sm text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            Fetching pages... {fetchProgress ? `(${fetchProgress.current} of ${fetchProgress.total})` : ''} — {allPagesData.length} logs loaded so far
          </div>
        )}

        {/* Error Logs Table */}
        <div className="overflow-x-auto border-2 border-border rounded-md">
          <Table>
            <TableHeader>
              <TableRow className="border-b-2 border-border hover:bg-transparent">
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10 whitespace-nowrap">Log ID</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10 whitespace-nowrap">Date</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10 whitespace-nowrap text-right">Count</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10 whitespace-nowrap">Status</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10">Message</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10">API URL</TableHead>
                <TableHead className="font-mono text-xs uppercase tracking-wider text-muted-foreground h-10">Parameters</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logsToDisplay.map((log, idx) => (
                <TableRow key={`${log.id}-${idx}`} className="border-b border-border/50 hover:bg-accent/50">
                  <TableCell className="font-mono text-xs py-2">{log.id.substring(0, 12)}...</TableCell>
                  <TableCell className="text-sm py-2 whitespace-nowrap">{new Date(log.date).toLocaleString()}</TableCell>
                  <TableCell className="text-sm py-2 text-right font-mono font-medium">{log.count}</TableCell>
                  <TableCell className="py-2">
                    <Badge variant={log.result?.request_info?.success ? "default" : "destructive"} className="font-mono text-xs">
                      {log.result?.request_info?.success ? 'Success' : 'Failed'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm py-2 max-w-xs truncate" title={log.result?.request_info?.message}>
                    {log.result?.request_info?.message || '—'}
                  </TableCell>
                  <TableCell className="text-xs py-2 font-mono max-w-xs truncate" title={log.api_url}>
                    {log.api_url}
                  </TableCell>
                  <TableCell className="py-2">
                    <code className="text-xs bg-muted px-2 py-1 rounded max-w-xs block truncate" title={JSON.stringify(log.parameters)}>
                      {JSON.stringify(log.parameters)}
                    </code>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls - only show when not viewing all pages */}
        {page_count_total > 1 && !showAllPages && (
          <div className="flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(page - 1)}
              disabled={page <= 1 || isLoading}
              className="border-2"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground px-4">
              Page {page} of {page_count_total}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchData(page + 1)}
              disabled={page >= page_count_total || isLoading}
              className="border-2"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  const hasData = endpointType === 'account' ? !!lookupData : (!!errorLogsData || allPagesData.length > 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-primary flex items-center justify-center">
              <FileSearch className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Account Lookup</h1>
              <p className="text-muted-foreground mt-1">
                Inspect account details and error logs for all products
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Configuration Panel */}
          <Card className="border-2 border-border lg:col-span-1">
            <CardHeader className="border-b-2 border-border">
              <CardTitle className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
                <Search className="w-4 h-4" />
                Lookup Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="lookup-product" className="font-mono text-xs uppercase">Product / API</Label>
                <Select value={product} onValueChange={(value) => setProduct(value as Product)}>
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
                <Label htmlFor="lookup-apikey" className="font-mono text-xs uppercase">Customer API Key</Label>
                <Input 
                  id="lookup-apikey" 
                  placeholder="Enter API key" 
                  className="border-2 font-mono"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Endpoint</Label>
                <Tabs value={endpointType} onValueChange={(v) => handleEndpointChange(v as EndpointType)} className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="account" className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Account
                    </TabsTrigger>
                    <TabsTrigger value="errorlogs" className="flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      Error Logs
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Error Logs Specific Filters */}
              {endpointType === 'errorlogs' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="search-term" className="font-mono text-xs uppercase">Search Parameters</Label>
                    <Input 
                      id="search-term" 
                      placeholder="Filter by parameter value" 
                      className="border-2"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">Sort By</Label>
                      <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                        <SelectTrigger className="border-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="date">Date</SelectItem>
                          <SelectItem value="count">Count</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">Direction</Label>
                      <Select value={sortDirection} onValueChange={(value) => setSortDirection(value as SortDirection)}>
                        <SelectTrigger className="border-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="descending">Descending</SelectItem>
                          <SelectItem value="ascending">Ascending</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Pages to Fetch */}
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Pages to Fetch</Label>
                    <Input 
                      type="number"
                      min="1"
                      placeholder="Number of pages"
                      className="border-2"
                      value={pagesToFetch}
                      onChange={(e) => setPagesToFetch(e.target.value)}
                    />
                    {errorLogsData && errorLogsData.page_count_total > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Total pages available: {errorLogsData.page_count_total}
                      </p>
                    )}
                  </div>

                  {/* Export Format */}
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">Export Format</Label>
                    <Select value={exportFormat} onValueChange={(value) => setExportFormat(value as ExportFormat)}>
                      <SelectTrigger className="border-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="csv">CSV</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <Button 
                  onClick={handleFetchClick}
                  disabled={isLoading || isFetchingAll || !product || !apiKey}
                  className="flex-1"
                >
                  {isLoading || isFetchingAll ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {isFetchingAll ? 'Fetching All...' : 'Fetching...'}</>
                  ) : (
                    <><Search className="w-4 h-4 mr-2" /> {endpointType === 'errorlogs' && (parseInt(pagesToFetch) || 1) > 1 ? `Fetch ${pagesToFetch} Pages` : 'Fetch Data'}</>
                  )}
                </Button>

                <Button 
                  variant="outline"
                  onClick={downloadData}
                  disabled={!hasData}
                  className="border-2"
                >
                  <Download className="w-4 h-4" />
                </Button>
              </div>

              <div className="pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> Error Logs API has a rate limit of 60 requests per minute.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Results Panel */}
          <div className="lg:col-span-3">
            {hasData ? (
              <Card className="border-2 border-border">
                <CardHeader className="border-b-2 border-border">
                  <CardTitle className="font-mono text-sm uppercase tracking-wider flex items-center gap-2">
                    {endpointType === 'account' ? (
                      <><User className="w-4 h-4" /> Account Details</>
                    ) : (
                      <><AlertCircle className="w-4 h-4" /> Error Logs</>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="max-h-[700px] overflow-auto">
                    {endpointType === 'account' ? renderAccountData() : renderErrorLogs()}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-2 border-border">
                <CardContent className="p-12 text-center">
                  <FileSearch className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Data Yet</h3>
                  <p className="text-muted-foreground">
                    Select a product, enter an API key, and click "Fetch Data" to view {endpointType === 'account' ? 'account details' : 'error logs'}.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AccountLookupPage;