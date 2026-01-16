import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Link as LinkIcon, Trash2, ExternalLink, RefreshCw, Loader2, Building, Clock, Wallet } from "lucide-react";
import { 
  useAdminPlaidSyncStatus, 
  useAdminPlaidFinanceTotals, 
  useAdminFinanceEntries, 
  useCreateFinanceEntry,
  useDeleteFinanceEntry,
  useAdminPlaidAllAccounts,
  useSyncPlaidTransactions,
  useAllBillingItems,
  useAdminClients,
  formatCents,
  formatDate
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function FinanceTracker() {
  const [activeTab, setActiveTab] = useState("income");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dateRange, setDateRange] = useState("30");
  const [formData, setFormData] = useState({
    entryType: "manual",
    title: "",
    amountCents: "",
    date: new Date().toISOString().split("T")[0],
    recurrence: "one_time",
    plaidAccountId: "",
    externalUrl: "",
  });
  
  const { toast } = useToast();
  const syncStatus = useAdminPlaidSyncStatus();
  const financeTotals = useAdminPlaidFinanceTotals(parseInt(dateRange));
  const entries = useAdminFinanceEntries(activeTab);
  const plaidAccounts = useAdminPlaidAllAccounts();
  const createEntry = useCreateFinanceEntry();
  const deleteEntry = useDeleteFinanceEntry();
  const syncTransactions = useSyncPlaidTransactions();
  const billingItems = useAllBillingItems();
  const clients = useAdminClients();

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

  const currentEntries = entries.data || [];
  const manualTotal = currentEntries.reduce((sum, entry) => sum + entry.amountCents, 0);

  const clientBillingItemsList = billingItems.data || [];
  const monthlyBillingTotal = clientBillingItemsList
    .filter(item => item.frequency === "monthly" && item.status === "active")
    .reduce((sum, item) => sum + item.amountCents, 0);

  const getClientName = (clientId: string) => {
    const client = clients.data?.find(c => c.clientId === clientId);
    return client?.displayName || "Unknown Client";
  };

  const getPlaidTotalForTab = () => {
    if (!financeTotals.data) return 0;
    switch (activeTab) {
      case "income": return financeTotals.data.income;
      case "bills": return financeTotals.data.spending;
      case "debts": return financeTotals.data.debts;
      case "holdings": return financeTotals.data.holdings;
      default: return 0;
    }
  };

  const plaidTotal = getPlaidTotalForTab();

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Finance Tracker</h2>
            <p className="text-gray-500">Track and organize your financial records.</p>
          </div>
          
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary-orange" data-testid="button-add-entry">
                <Plus className="mr-2 h-4 w-4" /> Add Entry
              </Button>
            </DialogTrigger>
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
                  <Select value={formData.recurrence} onValueChange={(v) => setFormData({ ...formData, recurrence: v })}>
                    <SelectTrigger className="col-span-3" data-testid="select-recurrence">
                      <SelectValue placeholder="Select frequency" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_time">One-time</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                    </SelectContent>
                  </Select>
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
        </div>

        <Tabs defaultValue="income" onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-white border border-gray-200 p-1 rounded-xl h-auto shadow-sm">
            <TabsTrigger value="income" className="rounded-lg data-[state=active]:bg-[#007BFF] data-[state=active]:text-white px-6 py-2" data-testid="tab-income">Income</TabsTrigger>
            <TabsTrigger value="bills" className="rounded-lg data-[state=active]:bg-[#007BFF] data-[state=active]:text-white px-6 py-2" data-testid="tab-bills">Bills</TabsTrigger>
            <TabsTrigger value="debts" className="rounded-lg data-[state=active]:bg-[#007BFF] data-[state=active]:text-white px-6 py-2" data-testid="tab-debts">Debts</TabsTrigger>
            <TabsTrigger value="holdings" className="rounded-lg data-[state=active]:bg-[#007BFF] data-[state=active]:text-white px-6 py-2" data-testid="tab-holdings">Holdings</TabsTrigger>
          </TabsList>
          
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
                  <p>From Plaid ({dateRange}d): {formatCents(plaidTotal)}</p>
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
                    currentEntries.map((entry) => (
                      <div key={entry.entryId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100" data-testid={`entry-${entry.entryId}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-gray-900">{entry.title}</h4>
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
                            {formatDate(entry.date)} {entry.recurrence && `• ${entry.recurrence}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-gray-900 text-lg">
                            {formatCents(entry.amountCents)}
                          </span>
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
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No entries found. Add one to get started.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <LinkIcon className="h-5 w-5 text-[#007BFF]" />
                  Auto-Sync from Linked Accounts
                </CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-[140px] h-9" data-testid="select-date-range">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="180">Last 6 months</SelectItem>
                    <SelectItem value="365">Last 12 months</SelectItem>
                  </SelectContent>
                </Select>
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
            <CardContent>
              {syncStatus.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : syncStatus.data && syncStatus.data.linked_accounts > 0 ? (
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Building className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900" data-testid="text-institutions">{syncStatus.data.linked_institutions}</p>
                      <p className="text-xs text-gray-500">Institutions</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <Wallet className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900" data-testid="text-accounts">{syncStatus.data.linked_accounts}</p>
                      <p className="text-xs text-gray-500">Accounts</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                    <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900" data-testid="text-last-sync">
                        {syncStatus.data.last_sync_at ? formatDate(syncStatus.data.last_sync_at) : "Never"}
                      </p>
                      <p className="text-xs text-gray-500">Last Sync</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="text-lg font-bold text-gray-900" data-testid="text-plaid-total">
                        {formatCents(plaidTotal)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} ({dateRange}d)
                      </p>
                    </div>
                  </div>
                </div>
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
    </Layout>
  );
}
