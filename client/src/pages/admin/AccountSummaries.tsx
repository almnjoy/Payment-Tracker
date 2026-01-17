import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { DollarSign, Wallet, CreditCard, Building, ArrowUpRight, TrendingUp, RefreshCw, Loader2, Search, X } from "lucide-react";
import { motion } from "framer-motion";
import { useAdminPlaidAccountSummaries, useAdminPlaidAccountTransactions, useAdminPlaidBulkTransactions, useSyncPlaidTransactions, formatCents, formatDate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const DATE_PRESETS = [
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "6 months", days: 180 },
  { label: "12 months", days: 365 },
  { label: "24 months", days: 730 },
];

type TileType = "cash" | "credit" | "linked" | "netWorth" | null;

export default function AccountSummaries() {
  const { data: summaries, isLoading, refetch } = useAdminPlaidAccountSummaries();
  const syncTransactions = useSyncPlaidTransactions();
  const { toast } = useToast();
  
  const [selectedAccount, setSelectedAccount] = useState<{
    plaidAccountId: string;
    institutionName: string;
  } | null>(null);
  
  const [selectedTile, setSelectedTile] = useState<TileType>(null);
  const [tileSearchQuery, setTileSearchQuery] = useState("");
  const [tileDatePreset, setTileDatePreset] = useState("30");
  
  const [datePreset, setDatePreset] = useState("30");
  const [searchQuery, setSearchQuery] = useState("");
  const [groupByMonth, setGroupByMonth] = useState(false);
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(datePreset));
  
  const tileEndDate = new Date();
  const tileStartDate = new Date();
  tileStartDate.setDate(tileStartDate.getDate() - parseInt(tileDatePreset));
  
  const { data: accountData, isLoading: transactionsLoading } = useAdminPlaidAccountTransactions(
    selectedAccount?.plaidAccountId || null,
    {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      search: searchQuery || undefined,
    }
  );

  const allAccounts = useMemo(() => summaries?.flatMap(s => 
    s.accounts.map(a => ({ ...a, institutionName: s.institution_name }))
  ) || [], [summaries]);

  const cashAccounts = useMemo(() => 
    allAccounts.filter(acc => ['checking', 'savings', 'depository'].includes(acc.type?.toLowerCase() || '')),
    [allAccounts]
  );

  const creditAccounts = useMemo(() => 
    allAccounts.filter(acc => acc.type?.toLowerCase() === 'credit'),
    [allAccounts]
  );

  const totalCash = cashAccounts.reduce((sum, acc) => sum + (acc.current_balance_cents || 0), 0);
  const totalCredit = creditAccounts.reduce((sum, acc) => sum + (acc.current_balance_cents || 0), 0);
  const netWorth = totalCash - totalCredit;

  const selectedTileAccountIds = useMemo(() => {
    if (selectedTile === "cash") return cashAccounts.map(a => a.plaid_account_id);
    if (selectedTile === "credit") return creditAccounts.map(a => a.plaid_account_id);
    if (selectedTile === "netWorth") return [...cashAccounts, ...creditAccounts].map(a => a.plaid_account_id);
    return [];
  }, [selectedTile, cashAccounts, creditAccounts]);

  const { data: bulkTransactionsData, isLoading: bulkTransactionsLoading } = useAdminPlaidBulkTransactions(
    selectedTileAccountIds,
    {
      startDate: tileStartDate.toISOString().split('T')[0],
      endDate: tileEndDate.toISOString().split('T')[0],
      search: tileSearchQuery || undefined,
    }
  );

  const handleSync = async () => {
    try {
      const result = await syncTransactions.mutateAsync();
      toast({ 
        title: "Sync Complete", 
        description: `Synced ${result.synced_items} items: ${result.added} added, ${result.modified} modified, ${result.removed} removed` 
      });
      refetch();
    } catch (error: any) {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    }
  };

  const groupTransactionsByMonth = (transactions: NonNullable<typeof accountData>['transactions']) => {
    const groups: Record<string, typeof transactions> = {};
    
    for (const txn of transactions) {
      const date = new Date(txn.date);
      const label = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      
      if (!groups[label]) {
        groups[label] = [];
      }
      groups[label].push(txn);
    }
    
    return groups;
  };

  const handleTileClick = (tile: TileType) => {
    setSelectedTile(tile);
    setTileSearchQuery("");
    setTileDatePreset("30");
  };

  const closeTileModal = () => {
    setSelectedTile(null);
    setTileSearchQuery("");
  };

  const getTileModalTitle = () => {
    switch (selectedTile) {
      case "cash": return "Total Cash Breakdown";
      case "credit": return "Total Credit Breakdown";
      case "linked": return "Linked Accounts";
      case "netWorth": return "Net Worth Calculation";
      default: return "";
    }
  };

  const renderTileModalContent = () => {
    if (selectedTile === "linked") {
      return (
        <div className="space-y-6 overflow-y-auto max-h-[70vh]">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg text-gray-900">All Linked Accounts</h3>
                <p className="text-sm text-gray-500">{allAccounts.length} accounts from {summaries?.length || 0} institutions</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-gray-900">{allAccounts.length}</p>
                <p className="text-sm text-gray-500">Total Accounts</p>
              </div>
            </div>
          </div>

          {summaries?.map((summary) => (
            <div key={summary.item_id} className="border rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Building className="h-4 w-4 text-blue-500" />
                {summary.institution_name || "Unknown Institution"}
              </h4>
              <div className="space-y-2">
                {summary.accounts.map((account) => (
                  <div 
                    key={account.plaid_account_id} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => {
                      closeTileModal();
                      setSelectedAccount({
                        plaidAccountId: account.plaid_account_id,
                        institutionName: summary.institution_name || "Unknown",
                      });
                    }}
                    data-testid={`linked-account-${account.mask}`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{account.name}</p>
                      <p className="text-xs text-gray-500">
                        {account.type} • {account.subtype} {account.mask && `• ••${account.mask}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{formatCents(account.current_balance_cents || 0)}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">View Transactions</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (selectedTile === "netWorth") {
      return (
        <div className="space-y-6 overflow-y-auto max-h-[70vh]">
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-center mb-4">
              <p className="text-sm text-gray-600 mb-2">Net Worth Formula</p>
              <p className="text-xl font-bold text-purple-900">
                Total Cash − Total Credit = Net Worth
              </p>
              <p className="text-lg text-gray-700 mt-2">
                {formatCents(totalCash)} − {formatCents(totalCredit)} = <span className="font-bold text-purple-700">{formatCents(netWorth)}</span>
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="border border-green-200 rounded-lg p-4 bg-green-50/50">
              <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Cash Accounts ({cashAccounts.length})
              </h4>
              <div className="space-y-2">
                {cashAccounts.map((account) => (
                  <div key={account.plaid_account_id} className="flex justify-between p-2 bg-white rounded border border-green-100">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{account.name}</p>
                      <p className="text-xs text-gray-500">{account.institutionName} {account.mask && `• ••${account.mask}`}</p>
                    </div>
                    <p className="font-bold text-green-700">{formatCents(account.current_balance_cents || 0)}</p>
                  </div>
                ))}
                <div className="flex justify-between p-2 bg-green-100 rounded font-bold">
                  <span>Total Cash</span>
                  <span className="text-green-800">{formatCents(totalCash)}</span>
                </div>
              </div>
            </div>

            <div className="border border-orange-200 rounded-lg p-4 bg-orange-50/50">
              <h4 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Credit Accounts ({creditAccounts.length})
              </h4>
              <div className="space-y-2">
                {creditAccounts.length > 0 ? creditAccounts.map((account) => (
                  <div key={account.plaid_account_id} className="flex justify-between p-2 bg-white rounded border border-orange-100">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{account.name}</p>
                      <p className="text-xs text-gray-500">{account.institutionName} {account.mask && `• ••${account.mask}`}</p>
                    </div>
                    <p className="font-bold text-orange-700">{formatCents(account.current_balance_cents || 0)}</p>
                  </div>
                )) : (
                  <p className="text-sm text-gray-500 italic">No credit accounts linked</p>
                )}
                <div className="flex justify-between p-2 bg-orange-100 rounded font-bold">
                  <span>Total Credit</span>
                  <span className="text-orange-800">{formatCents(totalCredit)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-purple-100 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="font-bold text-purple-900">Net Worth</span>
              <span className="text-2xl font-bold text-purple-900">{formatCents(netWorth)}</span>
            </div>
          </div>
        </div>
      );
    }

    const isCash = selectedTile === "cash";
    const accounts = isCash ? cashAccounts : creditAccounts;
    const total = isCash ? totalCash : totalCredit;
    const colorClass = isCash ? "green" : "orange";

    return (
      <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
        <div className={`bg-${colorClass}-50 rounded-lg p-4`} style={{ backgroundColor: isCash ? '#f0fdf4' : '#fff7ed' }}>
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-lg text-gray-900">
                {isCash ? "Total Cash" : "Total Credit"} Calculation
              </h3>
              <p className="text-sm text-gray-500">
                Accounts included: {accounts.length}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">{formatCents(total)}</p>
              <p className="text-sm text-gray-500">
                {isCash ? "Sum of all cash balances" : "Sum of all credit balances"}
              </p>
            </div>
          </div>
        </div>

        <div className="border rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Included Accounts</h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {accounts.map((account) => (
              <div key={account.plaid_account_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{account.name}</p>
                  <p className="text-xs text-gray-500">
                    {account.institutionName} • {account.type} {account.mask && `• ••${account.mask}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">{formatCents(account.current_balance_cents || 0)}</p>
                  {account.available_balance_cents !== null && account.available_balance_cents !== account.current_balance_cents && (
                    <p className="text-xs text-gray-500">Avail: {formatCents(account.available_balance_cents)}</p>
                  )}
                </div>
              </div>
            ))}
            <div className={`flex justify-between p-3 rounded-lg font-bold`} style={{ backgroundColor: isCash ? '#dcfce7' : '#ffedd5' }}>
              <span>{isCash ? "Total Cash" : "Total Credit"}</span>
              <span>{formatCents(total)}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input 
                placeholder="Search transactions..." 
                className="pl-9"
                value={tileSearchQuery}
                onChange={(e) => setTileSearchQuery(e.target.value)}
                data-testid="input-tile-search"
              />
            </div>
          </div>
          
          <Select value={tileDatePreset} onValueChange={setTileDatePreset}>
            <SelectTrigger className="w-[140px]" data-testid="select-tile-date-preset">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_PRESETS.map(preset => (
                <SelectItem key={preset.days} value={preset.days.toString()}>
                  {preset.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-sm text-gray-500">
          Transactions shown: last {tileDatePreset} days
        </div>

        <div className="flex-1 overflow-y-auto">
          {bulkTransactionsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : bulkTransactionsData && bulkTransactionsData.transactions.length > 0 ? (
            <div className="space-y-2">
              {bulkTransactionsData.transactions.map((txn) => {
                const account = bulkTransactionsData.accounts.find(a => a.plaid_account_id === txn.plaid_account_id);
                return (
                  <div 
                    key={txn.transaction_id} 
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    data-testid={`tile-txn-${txn.transaction_id}`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{txn.merchant_name || txn.name}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(txn.date)}
                        {account && ` • ${account.name}`}
                        {txn.category_primary && ` • ${txn.category_primary}`}
                        {txn.pending && " • Pending"}
                      </p>
                    </div>
                    <span className={`font-bold ${txn.amount_cents > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {txn.amount_cents > 0 ? '-' : '+'}{formatCents(Math.abs(txn.amount_cents))}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              No transactions found for this period.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Account Summaries</h2>
            <p className="text-gray-500">Overview of all linked financial accounts and balances.</p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleSync}
            disabled={syncTransactions.isPending || !summaries?.length}
            data-testid="button-sync"
          >
            {syncTransactions.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Sync Now
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card 
            className="shadow-sm border-gray-200 cursor-pointer hover:shadow-md transition-shadow hover:border-green-200"
            onClick={() => handleTileClick("cash")}
            data-testid="tile-total-cash"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Cash</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900" data-testid="text-total-cash">
                {formatCents(totalCash)}
              </div>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Click for breakdown
              </p>
            </CardContent>
          </Card>
          
          <Card 
            className="shadow-sm border-gray-200 cursor-pointer hover:shadow-md transition-shadow hover:border-orange-200"
            onClick={() => handleTileClick("credit")}
            data-testid="tile-total-credit"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Credit</CardTitle>
              <CreditCard className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900" data-testid="text-total-credit">
                {formatCents(totalCredit)}
              </div>
              <p className="text-xs text-orange-600 flex items-center mt-1">
                Click for breakdown
              </p>
            </CardContent>
          </Card>
          
          <Card 
            className="shadow-sm border-gray-200 cursor-pointer hover:shadow-md transition-shadow hover:border-blue-200"
            onClick={() => handleTileClick("linked")}
            data-testid="tile-linked-accounts"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Linked Accounts</CardTitle>
              <Building className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900" data-testid="text-account-count">
                {allAccounts.length}
              </div>
              <p className="text-xs text-gray-500 flex items-center mt-1">
                Click to view all
              </p>
            </CardContent>
          </Card>
          
          <Card 
            className="shadow-sm border-gray-200 cursor-pointer hover:shadow-md transition-shadow hover:border-purple-200"
            onClick={() => handleTileClick("netWorth")}
            data-testid="tile-net-worth"
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Net Worth</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900" data-testid="text-net-worth">
                {formatCents(netWorth)}
              </div>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Click for calculation
              </p>
            </CardContent>
          </Card>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : summaries && summaries.length > 0 ? (
          <div className="space-y-6">
            {summaries.map((summary, institutionIndex) => (
              <div key={summary.item_id}>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {summary.institution_name || "Linked Institution"}
                  </h3>
                  <span className="text-xs text-gray-500">
                    Last sync: {summary.last_sync_at ? formatDate(summary.last_sync_at) : "Never"}
                  </span>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {summary.accounts.map((account, index) => (
                    <motion.div
                      key={`${summary.item_id}-${account.mask || index}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Card 
                        className="relative overflow-hidden border-gray-200 shadow-sm hover:shadow-md transition-shadow group cursor-pointer" 
                        data-testid={`card-account-${account.mask || index}`}
                        onClick={() => setSelectedAccount({
                          plaidAccountId: account.plaid_account_id,
                          institutionName: summary.institution_name || "Unknown",
                        })}
                      >
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${institutionIndex % 2 === 0 ? 'bg-[#007BFF]' : 'bg-[#FF6A00]'}`} />
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-bold text-gray-900 text-lg">{account.name}</h3>
                              <p className="text-sm text-gray-500">
                                {account.type} • {account.subtype} {account.mask && `• ••${account.mask}`}
                              </p>
                            </div>
                            <div className="p-2 bg-gray-50 rounded-lg group-hover:bg-blue-50 transition-colors">
                              <Wallet className="h-5 w-5 text-gray-400 group-hover:text-blue-500" />
                            </div>
                          </div>
                          
                          <div className="space-y-1 mb-4">
                            <div className="text-3xl font-bold text-gray-900 tracking-tight">
                              {formatCents(account.current_balance_cents || 0)}
                            </div>
                            {account.available_balance_cents !== null && account.available_balance_cents !== account.current_balance_cents && (
                              <div className="text-sm text-gray-500">
                                Available: {formatCents(account.available_balance_cents)}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-700">
                              Click for transactions
                            </span>
                            <span className="text-xs text-gray-400">
                              {account.iso_currency_code || "USD"}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center p-12 text-gray-400">
            <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3">
              <DollarSign className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900">No Linked Accounts</h3>
            <p className="text-sm text-center mt-1 max-w-[300px] mb-4">
              Connect your bank accounts to see balances and transactions here.
            </p>
            <Link href="/admin/settings">
              <Button className="btn-primary-orange" data-testid="button-go-to-settings">
                Go to Settings
              </Button>
            </Link>
          </Card>
        )}
      </div>

      <Dialog open={!!selectedAccount} onOpenChange={(open) => !open && setSelectedAccount(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Transaction History</span>
              <Button variant="ghost" size="icon" onClick={() => setSelectedAccount(null)}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {accountData && (
            <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{accountData.account.name}</h3>
                    <p className="text-sm text-gray-500">
                      {accountData.account.institution_name} • {accountData.account.type} • {accountData.account.subtype}
                      {accountData.account.mask && ` • ••${accountData.account.mask}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-gray-900">{formatCents(accountData.account.currentBalanceCents || 0)}</p>
                    {accountData.account.availableBalanceCents !== null && (
                      <p className="text-sm text-gray-500">Available: {formatCents(accountData.account.availableBalanceCents)}</p>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Last sync: {accountData.account.last_sync_at ? formatDate(accountData.account.last_sync_at) : "Never"}
                </p>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="Search by merchant/name..." 
                      className="pl-9"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      data-testid="input-search"
                    />
                  </div>
                </div>
                
                <Select value={datePreset} onValueChange={setDatePreset}>
                  <SelectTrigger className="w-[140px]" data-testid="select-date-preset">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_PRESETS.map(preset => (
                      <SelectItem key={preset.days} value={preset.days.toString()}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                <Button 
                  variant={groupByMonth ? "default" : "outline"}
                  size="sm"
                  onClick={() => setGroupByMonth(!groupByMonth)}
                  data-testid="button-group-by-month"
                >
                  Group by Month
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {transactionsLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : accountData.transactions.length > 0 ? (
                  groupByMonth ? (
                    Object.entries(groupTransactionsByMonth(accountData.transactions)).map(([month, txns]) => (
                      <div key={month} className="mb-6">
                        <h4 className="font-semibold text-gray-700 mb-2 sticky top-0 bg-white py-2">{month}</h4>
                        <div className="space-y-2">
                          {txns.map((txn) => (
                            <div 
                              key={txn.transaction_id} 
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                              data-testid={`txn-${txn.transaction_id}`}
                            >
                              <div>
                                <p className="font-medium text-gray-900">{txn.merchant_name || txn.name}</p>
                                <p className="text-xs text-gray-500">
                                  {formatDate(txn.date)}
                                  {txn.category_primary && ` • ${txn.category_primary}`}
                                  {txn.pending && " • Pending"}
                                </p>
                              </div>
                              <span className={`font-bold ${txn.amount_cents > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                {txn.amount_cents > 0 ? '-' : '+'}{formatCents(Math.abs(txn.amount_cents))}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="space-y-2">
                      {accountData.transactions.map((txn) => (
                        <div 
                          key={txn.transaction_id} 
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                          data-testid={`txn-${txn.transaction_id}`}
                        >
                          <div>
                            <p className="font-medium text-gray-900">{txn.merchant_name || txn.name}</p>
                            <p className="text-xs text-gray-500">
                              {formatDate(txn.date)}
                              {txn.category_primary && ` • ${txn.category_primary}`}
                              {txn.pending && " • Pending"}
                            </p>
                          </div>
                          <span className={`font-bold ${txn.amount_cents > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {txn.amount_cents > 0 ? '-' : '+'}{formatCents(Math.abs(txn.amount_cents))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    No transactions found for this period.
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedTile} onOpenChange={(open) => !open && closeTileModal()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{getTileModalTitle()}</span>
              <Button variant="ghost" size="icon" onClick={closeTileModal}>
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
            <DialogDescription>
              {selectedTile === "cash" && "Breakdown of all cash and depository accounts"}
              {selectedTile === "credit" && "Breakdown of all credit accounts"}
              {selectedTile === "linked" && "All linked accounts grouped by institution"}
              {selectedTile === "netWorth" && "Net worth calculation breakdown"}
            </DialogDescription>
          </DialogHeader>
          
          {renderTileModalContent()}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
