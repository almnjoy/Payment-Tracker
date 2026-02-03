import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Link as LinkIcon, Trash2, ExternalLink, RefreshCw, Loader2, Building, Clock, Wallet, Eye, DollarSign, ChevronRight, Pencil, RotateCcw, Mail } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { 
  useAdminPlaidSyncStatus, 
  useAdminPlaidFinanceTotals, 
  useAdminFinanceEntries, 
  useCreateFinanceEntry,
  useDeleteFinanceEntry,
  useUpdateFinanceEntry,
  useAdminPlaidAllAccounts,
  useSyncPlaidTransactions,
  useAllBillingItems,
  useAdminClients,
  useAdminPlaidAccountSummaries,
  useAdminPlaidAccountTransactions,
  useAdminPlaidTypedTransactions,
  useUpdateAccountDefaultType,
  useUpdateTransactionType,
  useUpdateTransactionRecurrence,
  formatCents,
  formatDate,
  FinanceType,
  TimePeriod,
  RecurrenceType
} from "@/lib/api";
import { 
  getRecurrenceMultiplier as sharedGetRecurrenceMultiplier, 
  getMultiplierLabel as sharedGetMultiplierLabel,
  isOneTimeInRange,
  isStaticRecurrence,
  getDefaultRecurrenceForCategory,
  STATIC_DEFAULT_CATEGORIES
} from "@shared/recurrence";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

type FinanceTypeValue = "income" | "bill" | "debt" | "holding" | "other";
const FINANCE_TYPES: { value: FinanceTypeValue | "none"; label: string }[] = [
  { value: "none", label: "None" },
  { value: "income", label: "Income" },
  { value: "bill", label: "Bill" },
  { value: "debt", label: "Debt" },
  { value: "holding", label: "Holding" },
  { value: "other", label: "Other" },
];

const PERIOD_OPTIONS: { value: TimePeriod; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

const RECURRENCE_OPTIONS: { value: RecurrenceType | "one_time"; label: string }[] = [
  { value: "one_time", label: "One-time" },
  { value: "static", label: "Static (snapshot)" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

// Use shared recurrence utilities for consistency
const getRecurrenceMultiplier = sharedGetRecurrenceMultiplier;
const getMultiplierLabel = sharedGetMultiplierLabel;

export default function FinanceTracker() {
  const [activeTab, setActiveTab] = useState("income");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>("monthly");
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    entryType: "manual",
    title: "",
    amountCents: "",
    date: new Date().toISOString().split("T")[0],
    recurrence: "one_time",
    plaidAccountId: "",
    externalUrl: "",
  });
  
  // Modal states
  const [institutionsModalOpen, setInstitutionsModalOpen] = useState(false);
  const [accountsModalOpen, setAccountsModalOpen] = useState(false);
  const [lastSyncModalOpen, setLastSyncModalOpen] = useState(false);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [transactionsModalOpen, setTransactionsModalOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [transactionSearch, setTransactionSearch] = useState("");
  
  const { toast } = useToast();
  
  // Generate Summary Email mutation
  const generateSummaryMutation = useMutation({
    mutationFn: async ({ timeframe }: { timeframe: TimePeriod }) => {
      // Compute date range based on timeframe
      const periodDays: Record<TimePeriod, number> = { weekly: 7, biweekly: 14, monthly: 30, yearly: 365 };
      const days = periodDays[timeframe];
      const endDate = new Date();
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      
      const response = await fetch("/api/admin/generate-monthly-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          timeframe,
          start: startDate.toISOString().split("T")[0],
          end: endDate.toISOString().split("T")[0],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Failed to generate summary");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: "Summary Sent", description: data.message });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Error", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });
  
  const syncStatus = useAdminPlaidSyncStatus();
  const financeTotals = useAdminPlaidFinanceTotals(selectedPeriod);
  const entries = useAdminFinanceEntries(activeTab);
  const plaidAccounts = useAdminPlaidAllAccounts();
  const accountSummaries = useAdminPlaidAccountSummaries();
  const createEntry = useCreateFinanceEntry();
  const deleteEntry = useDeleteFinanceEntry();
  const updateEntry = useUpdateFinanceEntry();
  const syncTransactions = useSyncPlaidTransactions();
  const billingItems = useAllBillingItems();
  const clients = useAdminClients();
  const updateAccountType = useUpdateAccountDefaultType();
  const updateTransactionType = useUpdateTransactionType();
  const updateTransactionRecurrence = useUpdateTransactionRecurrence();
  
  // Period-based date range for transactions
  const periodDays = { weekly: 7, biweekly: 14, monthly: 30, yearly: 365 };
  const dateRangeMs = periodDays[selectedPeriod] * 24 * 60 * 60 * 1000;
  const endDate = new Date().toISOString().split("T")[0];
  const startDate = new Date(Date.now() - dateRangeMs).toISOString().split("T")[0];
  
  const accountTransactions = useAdminPlaidAccountTransactions(
    selectedAccountId,
    { startDate, endDate, search: transactionSearch || undefined }
  );
  
  // Typed Plaid transactions for the current tab
  const typedTransactions = useAdminPlaidTypedTransactions(activeTab, selectedPeriod);

  const handleCreateEntry = async () => {
    if (!formData.title || !formData.amountCents) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    
    try {
      await createEntry.mutateAsync({
        entryType: formData.entryType,
        categoryGroup: activeTab,
        title: formData.title,
        amountCents: Math.round(parseFloat(formData.amountCents) * 100),
        date: formData.date,
        recurrence: formData.recurrence === "one_time" ? null : formData.recurrence,
        plaidAccountId: formData.entryType === "linked" ? formData.plaidAccountId : null,
        externalUrl: formData.externalUrl || null,
      });
      
      setDialogOpen(false);
      setFormData({
        entryType: "manual",
        title: "",
        amountCents: "",
        date: new Date().toISOString().split("T")[0],
        recurrence: "one_time",
        plaidAccountId: "",
        externalUrl: "",
      });
      toast({ title: "Entry created" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteEntry = async (entryId: string) => {
    try {
      await deleteEntry.mutateAsync(entryId);
      toast({ title: "Entry deleted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncTransactions.mutateAsync();
      toast({ 
        title: "Sync Complete", 
        description: `Synced ${result.synced_items} items: ${result.added} added, ${result.modified} modified` 
      });
    } catch (error: any) {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    }
  };

  const handleAccountTypeChange = async (accountId: string, value: string) => {
    const newType = value === "none" ? null : value as FinanceType;
    try {
      await updateAccountType.mutateAsync({ accountId, defaultFinanceType: newType });
      toast({ title: "Account type updated" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleTransactionTypeChange = async (transactionId: string, value: string) => {
    const newType = value === "none" ? null : value as FinanceType;
    try {
      await updateTransactionType.mutateAsync({ transactionId, overrideFinanceType: newType });
      toast({ title: "Transaction type updated" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openTransactionsModal = (plaidAccountId: string) => {
    setSelectedAccountId(plaidAccountId);
    setTransactionSearch("");
    setTransactionsModalOpen(true);
  };

  const currentEntries = entries.data || [];
  
  // Calculate manual total with proper recurrence handling
  // Static entries always count at full value (never scaled)
  // One-time entries only count if within the selected period's date range
  const manualTotal = useMemo(() => {
    return currentEntries.reduce((sum, entry) => {
      // Static entries always count at full value, regardless of timeframe
      if (isStaticRecurrence(entry.recurrence)) {
        return sum + entry.amountCents;
      }
      
      const isOneTime = !entry.recurrence || entry.recurrence === "one_time";
      
      if (isOneTime) {
        // One-time entries only count if within date range
        if (!entry.date || !isOneTimeInRange(entry.date, selectedPeriod)) {
          return sum;
        }
        return sum + entry.amountCents;
      }
      
      // Recurring entries get multiplied
      const multiplier = getRecurrenceMultiplier(entry.recurrence, selectedPeriod);
      return sum + Math.round(entry.amountCents * multiplier);
    }, 0);
  }, [currentEntries, selectedPeriod]);

  const clientBillingItemsList = billingItems.data || [];
  const monthlyBillingTotal = clientBillingItemsList
    .filter(item => item.frequency === "monthly" && item.status === "active")
    .reduce((sum, item) => sum + item.amountCents, 0);

  const getClientName = (clientId: string) => {
    const client = clients.data?.find(c => c.clientId === clientId);
    return client?.displayName || "Unknown Client";
  };

  // Calculate Plaid total from typed transactions with proper recurrence multipliers
  // Note: The API already filters transactions by date range based on selected period
  // One-time transactions (no recurrence) are already in range, so include as-is
  // Recurring transactions get multiplied by the appropriate factor
  const plaidTotal = useMemo(() => {
    if (!typedTransactions.data?.transactions) return 0;
    
    return typedTransactions.data.transactions.reduce((sum, tx) => {
      const txRecurrence = tx.override_recurrence || null;
      const baseAmount = Math.abs(tx.amount_cents);
      
      // For one-time transactions (already filtered by API date range), include as-is
      if (!txRecurrence || txRecurrence === "one_time") {
        return sum + baseAmount;
      }
      
      // For recurring transactions, apply the multiplier
      const multiplier = getRecurrenceMultiplier(txRecurrence, selectedPeriod);
      return sum + Math.round(baseAmount * multiplier);
    }, 0);
  }, [typedTransactions.data?.transactions, selectedPeriod]);

  // Group accounts by institution for the institutions modal
  const accountsByInstitution = useMemo(() => {
    const grouped: Record<string, typeof plaidAccounts.data> = {};
    plaidAccounts.data?.forEach(acc => {
      const inst = acc.institutionName || "Unknown";
      if (!grouped[inst]) grouped[inst] = [];
      grouped[inst]!.push(acc);
    });
    return grouped;
  }, [plaidAccounts.data]);

  // Calculate income transactions for the date range
  const incomeTransactions = useMemo(() => {
    // We'd need a separate hook to get all income transactions
    // For now, show the total from financeTotals
    return financeTotals.data?.income || 0;
  }, [financeTotals.data]);

  const getFinanceTypeBadge = (type: string | null) => {
    if (!type) return null;
    const colors: Record<string, string> = {
      income: "bg-green-100 text-green-800",
      bill: "bg-red-100 text-red-800",
      debt: "bg-orange-100 text-orange-800",
      holding: "bg-blue-100 text-blue-800",
      other: "bg-gray-100 text-gray-800",
    };
    return (
      <Badge className={colors[type] || colors.other}>
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </Badge>
    );
  };

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Finance Tracker</h2>
            <p className="text-gray-500">Track and organize your financial records.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="outline"
              size="default"
              onClick={() => generateSummaryMutation.mutate({ timeframe: selectedPeriod })}
              disabled={generateSummaryMutation.isPending}
              data-testid="button-generate-summary"
            >
              {generateSummaryMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Generate Summary Email
            </Button>
            
            <Button 
              className="btn-primary-orange" 
              onClick={() => {
                // Set default recurrence based on category (static for debt/holding/other)
                const defaultRecurrence = getDefaultRecurrenceForCategory(activeTab);
                setFormData(prev => ({ ...prev, recurrence: defaultRecurrence }));
                setDialogOpen(true);
              }} 
              data-testid="button-add-entry"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Entry
            </Button>
          </div>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Entry</DialogTitle>
                <DialogDescription>
                  Create a new financial record.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="entryType" className="text-right">Type</Label>
                  <Select value={formData.entryType} onValueChange={(v) => setFormData({ ...formData, entryType: v })}>
                    <SelectTrigger className="col-span-3" data-testid="select-entry-type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual</SelectItem>
                      <SelectItem value="linked">Linked (Plaid)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.entryType === "linked" && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="plaidAccount" className="text-right">Account</Label>
                    <Select value={formData.plaidAccountId} onValueChange={(v) => setFormData({ ...formData, plaidAccountId: v })}>
                      <SelectTrigger className="col-span-3" data-testid="select-plaid-account">
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent>
                        {plaidAccounts.data?.map((acc) => (
                          <SelectItem key={acc.plaidAccountId} value={acc.plaidAccountId}>
                            {acc.institutionName} - {acc.name} {acc.mask && `(••${acc.mask})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="title" className="text-right">Name</Label>
                  <Input 
                    id="title" 
                    placeholder="e.g. Salary" 
                    className="col-span-3"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    data-testid="input-title"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="amount" className="text-right">Amount</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    placeholder="0.00" 
                    className="col-span-3"
                    value={formData.amountCents}
                    onChange={(e) => setFormData({ ...formData, amountCents: e.target.value })}
                    data-testid="input-amount"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="date" className="text-right">Date</Label>
                  <Input 
                    id="date" 
                    type="date" 
                    className="col-span-3"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    data-testid="input-date"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="recurrence" className="text-right">Frequency</Label>
                  <div className="col-span-3 space-y-1">
                    <Select value={formData.recurrence} onValueChange={(v) => setFormData({ ...formData, recurrence: v })}>
                      <SelectTrigger data-testid="select-recurrence">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        {RECURRENCE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.recurrence === "static" && (
                      <p className="text-xs text-blue-600">
                        Snapshot value - not scaled by timeframe
                      </p>
                    )}
                    {formData.recurrence && formData.recurrence !== "one_time" && formData.recurrence !== "static" && (
                      <p className="text-xs text-purple-600">
                        {getMultiplierLabel(formData.recurrence, selectedPeriod) || `Recurs ${formData.recurrence}`}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="externalUrl" className="text-right">Link URL</Label>
                  <Input 
                    id="externalUrl" 
                    type="url" 
                    placeholder="https://..." 
                    className="col-span-3"
                    value={formData.externalUrl}
                    onChange={(e) => setFormData({ ...formData, externalUrl: e.target.value })}
                    data-testid="input-external-url"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  onClick={handleCreateEntry} 
                  className="btn-primary-orange"
                  disabled={createEntry.isPending}
                  data-testid="button-save-entry"
                >
                  {createEntry.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Entry
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

        <Tabs defaultValue="income" onValueChange={setActiveTab} className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <TabsList className="bg-white border border-gray-200 p-1 rounded-xl h-auto shadow-sm">
              <TabsTrigger value="income" className="rounded-lg data-[state=active]:bg-[#007BFF] data-[state=active]:text-white px-6 py-2" data-testid="tab-income">Income</TabsTrigger>
              <TabsTrigger value="bills" className="rounded-lg data-[state=active]:bg-[#007BFF] data-[state=active]:text-white px-6 py-2" data-testid="tab-bills">Bills</TabsTrigger>
              <TabsTrigger value="debts" className="rounded-lg data-[state=active]:bg-[#007BFF] data-[state=active]:text-white px-6 py-2" data-testid="tab-debts">Debts</TabsTrigger>
              <TabsTrigger value="holdings" className="rounded-lg data-[state=active]:bg-[#007BFF] data-[state=active]:text-white px-6 py-2" data-testid="tab-holdings">Holdings</TabsTrigger>
              <TabsTrigger value="other" className="rounded-lg data-[state=active]:bg-[#007BFF] data-[state=active]:text-white px-6 py-2" data-testid="tab-other">Other</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm">
              <span className="text-sm text-gray-600 font-medium">View:</span>
              <Select value={selectedPeriod} onValueChange={(v) => setSelectedPeriod(v as TimePeriod)}>
                <SelectTrigger className="w-[120px] h-8 border-0 shadow-none focus:ring-0" data-testid="select-period-global">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {activeTab === "income" && monthlyBillingTotal > 0 && (
            <Card className="shadow-sm border-gray-200 border-l-4 border-l-green-500">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-green-600" />
                  Client Rent Income
                </CardTitle>
                <span className="text-lg font-bold text-green-600">{formatCents(monthlyBillingTotal)}/mo</span>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {clientBillingItemsList
                    .filter(item => item.frequency === "monthly" && item.status === "active")
                    .map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-green-50/50 rounded-lg border border-green-100">
                        <div>
                          <p className="font-medium text-gray-900">{item.title}</p>
                          <p className="text-sm text-gray-500">{getClientName(item.clientId)}</p>
                        </div>
                        <span className="font-bold text-gray-900">{formatCents(item.amountCents)}</span>
                      </div>
                    ))
                  }
                </div>
              </CardContent>
            </Card>
          )}
          
          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-1 shadow-sm border-gray-200 h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Total {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900 mb-2" data-testid="text-total">
                  {formatCents(manualTotal + plaidTotal + (activeTab === "income" ? monthlyBillingTotal : 0))}
                </div>
                <div className="space-y-1 text-sm text-gray-500">
                  <p>Manual entries: {formatCents(manualTotal)}</p>
                  <p>From Plaid ({selectedPeriod}): {formatCents(plaidTotal)}</p>
                  {activeTab === "income" && (
                    <p className="text-green-600 font-medium">Client rent (monthly): {formatCents(monthlyBillingTotal)}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-2 shadow-sm border-gray-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Manual Entries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {entries.isLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                  ) : currentEntries.length > 0 ? (
                    currentEntries.map((entry) => {
                      const multiplier = getRecurrenceMultiplier(entry.recurrence, selectedPeriod);
                      const multiplierLabel = getMultiplierLabel(entry.recurrence, selectedPeriod);
                      const effectiveAmount = Math.round(entry.amountCents * multiplier);
                      
                      return (
                        <div key={entry.entryId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100" data-testid={`entry-${entry.entryId}`}>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-gray-900">{entry.title}</h4>
                              {entry.recurrence && (
                                <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 flex items-center gap-1">
                                  <RotateCcw className="h-3 w-3" />
                                  {entry.recurrence}
                                </span>
                              )}
                              {entry.entryType === "linked" && (
                                <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">Linked</span>
                              )}
                              {entry.externalUrl && (
                                <a href={entry.externalUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-blue-500">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {formatDate(entry.date)}
                              {multiplierLabel && (
                                <span className="ml-2 text-purple-600" title={multiplierLabel}>
                                  ({multiplier.toFixed(1)}x for {selectedPeriod})
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="font-bold text-gray-900 text-lg">
                                {formatCents(effectiveAmount)}
                              </span>
                              {multiplier !== 1 && (
                                <p className="text-xs text-gray-400">
                                  base: {formatCents(entry.amountCents)}
                                </p>
                              )}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => {
                                setEditingEntry(entry);
                                setEditDialogOpen(true);
                              }}
                              data-testid={`button-edit-${entry.entryId}`}
                            >
                              <Pencil className="h-4 w-4 text-gray-400 hover:text-blue-500" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon"
                              onClick={() => handleDeleteEntry(entry.entryId)}
                              disabled={deleteEntry.isPending}
                              data-testid={`button-delete-${entry.entryId}`}
                            >
                              <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No entries found. Add one to get started.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Plaid Entries Section - Shows transactions with assigned types */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-[#007BFF]" />
                Plaid Entries ({selectedPeriod})
              </CardTitle>
              <span className="text-sm text-gray-500">
                {typedTransactions.data?.transactions.length || 0} transactions assigned to {activeTab}
              </span>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {typedTransactions.isLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : typedTransactions.data && typedTransactions.data.transactions.length > 0 ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {typedTransactions.data.transactions.map((tx) => {
                        const txRecurrence = tx.override_recurrence || null;
                        const multiplier = getRecurrenceMultiplier(txRecurrence, selectedPeriod);
                        const multiplierLabel = getMultiplierLabel(txRecurrence, selectedPeriod);
                        const baseAmount = Math.abs(tx.amount_cents);
                        const effectiveAmount = Math.round(baseAmount * multiplier);
                        const isOneTime = !txRecurrence || txRecurrence === "one_time";
                        
                        return (
                          <div 
                            key={tx.transaction_id} 
                            className="flex items-center justify-between p-3 bg-blue-50/50 rounded-lg border border-blue-100"
                            data-testid={`plaid-entry-${tx.transaction_id}`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium text-gray-900 truncate">{tx.merchant_name || tx.name}</h4>
                                {tx.pending && (
                                  <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-700">Pending</span>
                                )}
                                {!isOneTime && (
                                  <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                    {RECURRENCE_OPTIONS.find(r => r.value === txRecurrence)?.label || txRecurrence}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm text-gray-500 truncate">
                                  {formatDate(tx.date)} • {tx.account_name}
                                </p>
                                {multiplierLabel && (
                                  <span className="text-xs text-purple-600 font-medium">{multiplierLabel}</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Select 
                                value={txRecurrence || "one_time"} 
                                onValueChange={(v) => {
                                  updateTransactionRecurrence.mutate({
                                    transactionId: tx.transaction_id,
                                    recurrence: v === "one_time" ? null : v as RecurrenceType
                                  });
                                }}
                              >
                                <SelectTrigger className="w-[100px] h-8 text-xs" data-testid={`select-frequency-${tx.transaction_id}`}>
                                  <SelectValue placeholder="Freq" />
                                </SelectTrigger>
                                <SelectContent>
                                  {RECURRENCE_OPTIONS.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="text-right min-w-[80px]">
                                {multiplier !== 1 && (
                                  <p className="text-xs text-gray-400 line-through">{formatCents(baseAmount)}</p>
                                )}
                                <span className={`font-bold text-lg ${tx.amount_cents < 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                  {formatCents(effectiveAmount)}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <p>No Plaid transactions assigned to {activeTab}.</p>
                    <p className="text-sm mt-1">Assign types to transactions in the Linked Accounts section below.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Auto-Sync Section */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-[#007BFF]" />
                  Auto-Sync from Linked Accounts
                </CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleSync}
                  disabled={syncTransactions.isPending || !syncStatus.data?.linked_accounts}
                  data-testid="button-sync"
                >
                  {syncTransactions.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Sync Now
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {syncStatus.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : syncStatus.data && syncStatus.data.linked_accounts > 0 ? (
                <>
                  {/* Clickable Summary Cards */}
                  <div className="grid md:grid-cols-4 gap-4">
                    <button
                      onClick={() => setInstitutionsModalOpen(true)}
                      className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                      data-testid="button-institutions-card"
                    >
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Building className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-2xl font-bold text-gray-900" data-testid="text-institutions">{syncStatus.data.linked_institutions}</p>
                        <p className="text-xs text-gray-500">Institutions</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </button>
                    
                    <button
                      onClick={() => setAccountsModalOpen(true)}
                      className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                      data-testid="button-accounts-card"
                    >
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Wallet className="h-5 w-5 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-2xl font-bold text-gray-900" data-testid="text-accounts">{syncStatus.data.linked_accounts}</p>
                        <p className="text-xs text-gray-500">Accounts</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </button>
                    
                    <button
                      onClick={() => setLastSyncModalOpen(true)}
                      className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                      data-testid="button-last-sync-card"
                    >
                      <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                        <Clock className="h-5 w-5 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900" data-testid="text-last-sync">
                          {syncStatus.data.last_sync_at ? formatDate(syncStatus.data.last_sync_at) : "Never"}
                        </p>
                        <p className="text-xs text-gray-500">Last Sync</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </button>
                    
                    <button
                      onClick={() => setIncomeModalOpen(true)}
                      className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors text-left"
                      data-testid="button-income-card"
                    >
                      <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                        <DollarSign className="h-5 w-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-bold text-gray-900" data-testid="text-plaid-total">
                          {formatCents(plaidTotal)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} ({selectedPeriod})
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </button>
                  </div>

                  {/* Linked Accounts Table */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Linked Accounts</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Account Name</TableHead>
                            <TableHead>Institution</TableHead>
                            <TableHead>Last 4</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead className="text-right">Balance</TableHead>
                            <TableHead>Default Type</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {plaidAccounts.data?.map((account) => (
                            <TableRow key={account.accountId} data-testid={`row-account-${account.accountId}`}>
                              <TableCell className="font-medium">{account.name}</TableCell>
                              <TableCell>{account.institutionName || "—"}</TableCell>
                              <TableCell>{account.mask ? `••${account.mask}` : "—"}</TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600">
                                  {account.subtype || account.type || "—"}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                {account.currentBalanceCents != null 
                                  ? formatCents(account.currentBalanceCents) 
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={account.defaultFinanceType || "none"}
                                  onValueChange={(v) => handleAccountTypeChange(account.accountId, v)}
                                >
                                  <SelectTrigger className="w-[120px] h-8" data-testid={`select-default-type-${account.accountId}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {FINANCE_TYPES.map((type) => (
                                      <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openTransactionsModal(account.plaidAccountId)}
                                  data-testid={`button-view-transactions-${account.accountId}`}
                                >
                                  <Eye className="h-4 w-4 mr-1" />
                                  Transactions
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-8">
                  <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center mb-4">
                    <LinkIcon className="h-6 w-6 text-gray-500" />
                  </div>
                  <h3 className="text-lg font-bold text-gray-900">No Linked Accounts</h3>
                  <p className="text-gray-500 max-w-md mt-2">
                    Connect your bank accounts to automatically pull {activeTab} data.
                  </p>
                  <Link href="/admin/settings">
                    <Button className="btn-primary-orange mt-4" data-testid="button-go-to-settings">
                      Go to Settings
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </Tabs>
      </div>

      {/* Institutions Modal */}
      <Dialog open={institutionsModalOpen} onOpenChange={setInstitutionsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-blue-600" />
              Linked Institutions
            </DialogTitle>
            <DialogDescription>
              {Object.keys(accountsByInstitution).length} institution(s) connected
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-4">
              {Object.entries(accountsByInstitution).map(([institution, accounts]) => (
                <div key={institution} className="border rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">{institution}</h4>
                  <div className="space-y-2">
                    {accounts?.map((acc) => (
                      <div key={acc.accountId} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                        <span className="text-sm">{acc.name} {acc.mask && `(••${acc.mask})`}</span>
                        <span className="text-sm text-gray-500">{acc.subtype || acc.type}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Accounts Modal */}
      <Dialog open={accountsModalOpen} onOpenChange={setAccountsModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-600" />
              All Linked Accounts
            </DialogTitle>
            <DialogDescription>
              {plaidAccounts.data?.length || 0} account(s) linked
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Default Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plaidAccounts.data?.map((acc) => (
                  <TableRow key={acc.accountId}>
                    <TableCell className="font-medium">
                      {acc.name} {acc.mask && <span className="text-gray-500">(••{acc.mask})</span>}
                    </TableCell>
                    <TableCell>{acc.institutionName}</TableCell>
                    <TableCell>{acc.subtype || acc.type || "—"}</TableCell>
                    <TableCell className="text-right">
                      {acc.currentBalanceCents != null ? formatCents(acc.currentBalanceCents) : "—"}
                    </TableCell>
                    <TableCell>
                      {getFinanceTypeBadge(acc.defaultFinanceType)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Last Sync Modal */}
      <Dialog open={lastSyncModalOpen} onOpenChange={setLastSyncModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-orange-600" />
              Sync Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500">Last Sync</p>
              <p className="text-lg font-semibold">
                {syncStatus.data?.last_sync_at 
                  ? new Date(syncStatus.data.last_sync_at).toLocaleString()
                  : "Never synced"}
              </p>
            </div>
            <p className="text-sm text-gray-600">
              Last sync applies to all {syncStatus.data?.linked_accounts || 0} linked account(s) across {syncStatus.data?.linked_institutions || 0} institution(s).
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Income/Category Total Modal */}
      <Dialog open={incomeModalOpen} onOpenChange={setIncomeModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-600" />
              {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Summary ({selectedPeriod})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-gray-500">Total from Linked Accounts</p>
              <p className="text-3xl font-bold text-gray-900">{formatCents(plaidTotal)}</p>
            </div>
            <p className="text-sm text-gray-600">
              This total is calculated from transactions categorized as "{activeTab}" across all linked accounts for the selected period ({selectedPeriod}).
            </p>
            <p className="text-sm text-gray-500">
              To see detailed transactions, click "View Transactions" on any account in the table above.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transactions Modal */}
      <Dialog open={transactionsModalOpen} onOpenChange={setTransactionsModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-blue-600" />
              Transaction History
            </DialogTitle>
            <DialogDescription>
              {accountTransactions.data?.account?.name} {accountTransactions.data?.account?.mask && `(••${accountTransactions.data.account.mask})`}
              {accountTransactions.data?.account?.institution_name && ` • ${accountTransactions.data.account.institution_name}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Input
                placeholder="Search transactions..."
                value={transactionSearch}
                onChange={(e) => setTransactionSearch(e.target.value)}
                className="max-w-xs"
                data-testid="input-transaction-search"
              />
              <span className="text-sm text-gray-500">
                {accountTransactions.data?.transactions?.length || 0} transactions
              </span>
            </div>

            <ScrollArea className="h-[50vh]">
              {accountTransactions.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : accountTransactions.data?.transactions?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Type</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountTransactions.data.transactions.map((txn) => (
                      <TableRow key={txn.transaction_id} data-testid={`row-transaction-${txn.transaction_id}`}>
                        <TableCell className="whitespace-nowrap">{formatDate(txn.date)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{txn.name}</p>
                            {txn.merchant_name && txn.merchant_name !== txn.name && (
                              <p className="text-sm text-gray-500">{txn.merchant_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {txn.category_primary && (
                            <Badge variant="outline">{txn.category_primary}</Badge>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${txn.amount_cents < 0 ? "text-green-600" : "text-gray-900"}`}>
                          {formatCents(Math.abs(txn.amount_cents))}
                          {txn.amount_cents < 0 && <span className="text-xs ml-1">(credit)</span>}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={txn.override_finance_type || (accountTransactions.data?.account?.default_finance_type ? "inherited" : "none")}
                            onValueChange={(v) => {
                              if (v === "inherited") {
                                handleTransactionTypeChange(txn.transaction_id, "none");
                              } else {
                                handleTransactionTypeChange(txn.transaction_id, v);
                              }
                            }}
                          >
                            <SelectTrigger className="w-[130px] h-8" data-testid={`select-txn-type-${txn.transaction_id}`}>
                              <SelectValue>
                                {txn.override_finance_type 
                                  ? FINANCE_TYPES.find(t => t.value === txn.override_finance_type)?.label
                                  : txn.effective_finance_type 
                                    ? `(${FINANCE_TYPES.find(t => t.value === txn.effective_finance_type)?.label})`
                                    : "None"
                                }
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">None</SelectItem>
                              {accountTransactions.data?.account?.default_finance_type && (
                                <SelectItem value="inherited">
                                  Use default ({accountTransactions.data.account.default_finance_type})
                                </SelectItem>
                              )}
                              {FINANCE_TYPES.filter(t => t.value !== "none").map((type) => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  No transactions found for this period.
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5 text-blue-600" />
              Edit Entry
            </DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input 
                  value={editingEntry.title}
                  onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
                  data-testid="input-edit-title"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Amount</label>
                <Input 
                  type="number"
                  step="0.01"
                  value={(editingEntry.amountCents / 100).toFixed(2)}
                  onChange={(e) => setEditingEntry({ ...editingEntry, amountCents: Math.round(parseFloat(e.target.value || "0") * 100) })}
                  data-testid="input-edit-amount"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date</label>
                <Input 
                  type="date"
                  value={editingEntry.date?.split("T")[0] || ""}
                  onChange={(e) => setEditingEntry({ ...editingEntry, date: e.target.value })}
                  data-testid="input-edit-date"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Recurrence</label>
                <Select 
                  value={editingEntry.recurrence || "one_time"}
                  onValueChange={(v) => setEditingEntry({ ...editingEntry, recurrence: v === "one_time" ? null : v })}
                >
                  <SelectTrigger data-testid="select-edit-recurrence">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingEntry.recurrence === "static" && (
                  <p className="text-xs text-blue-600">
                    Snapshot value - not scaled by timeframe
                  </p>
                )}
                {editingEntry.recurrence && editingEntry.recurrence !== "static" && (
                  <p className="text-xs text-purple-600">
                    {getMultiplierLabel(editingEntry.recurrence, selectedPeriod) || `Recurs ${editingEntry.recurrence}`}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">External URL (optional)</label>
                <Input 
                  value={editingEntry.externalUrl || ""}
                  onChange={(e) => setEditingEntry({ ...editingEntry, externalUrl: e.target.value || null })}
                  placeholder="https://..."
                  data-testid="input-edit-url"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={async () => {
                    if (!editingEntry.title?.trim()) {
                      toast({ title: "Error", description: "Title is required", variant: "destructive" });
                      return;
                    }
                    if (!editingEntry.amountCents || editingEntry.amountCents <= 0) {
                      toast({ title: "Error", description: "Amount must be greater than 0", variant: "destructive" });
                      return;
                    }
                    const dateStr = editingEntry.date?.split("T")[0];
                    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
                      toast({ title: "Error", description: "Valid date is required", variant: "destructive" });
                      return;
                    }
                    try {
                      await updateEntry.mutateAsync({
                        entryId: editingEntry.entryId,
                        title: editingEntry.title.trim(),
                        amountCents: editingEntry.amountCents,
                        date: dateStr,
                        recurrence: editingEntry.recurrence,
                        externalUrl: editingEntry.externalUrl?.trim() || null,
                      });
                      setEditDialogOpen(false);
                      setEditingEntry(null);
                      toast({ title: "Entry updated" });
                    } catch (error: any) {
                      toast({ title: "Error", description: error.message, variant: "destructive" });
                    }
                  }}
                  disabled={updateEntry.isPending}
                  data-testid="button-save-edit"
                >
                  {updateEntry.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
