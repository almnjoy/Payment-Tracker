import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, Wallet, CreditCard, Building, ArrowUpRight, TrendingUp, RefreshCw, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useAdminPlaidAccountSummaries, useSyncPlaidTransactions, formatCents, formatDate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function AccountSummaries() {
  const { data: summaries, isLoading, refetch } = useAdminPlaidAccountSummaries();
  const syncTransactions = useSyncPlaidTransactions();
  const { toast } = useToast();

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

  const allAccounts = summaries?.flatMap(s => 
    s.accounts.map(a => ({ ...a, institutionName: s.institution_name }))
  ) || [];

  const totalCash = allAccounts
    .filter(acc => ['checking', 'savings', 'depository'].includes(acc.type?.toLowerCase() || ''))
    .reduce((sum, acc) => sum + (acc.current_balance_cents || 0), 0);

  const totalCredit = allAccounts
    .filter(acc => acc.type?.toLowerCase() === 'credit')
    .reduce((sum, acc) => sum + (acc.current_balance_cents || 0), 0);

  const netWorth = totalCash - totalCredit;

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
          <Card className="shadow-sm border-gray-200">
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
                Liquid Assets
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Credit</CardTitle>
              <CreditCard className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900" data-testid="text-total-credit">
                {formatCents(totalCredit)}
              </div>
              <p className="text-xs text-orange-600 flex items-center mt-1">
                Credit Card Balance
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Linked Accounts</CardTitle>
              <Building className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900" data-testid="text-account-count">
                {allAccounts.length}
              </div>
              <p className="text-xs text-gray-500 flex items-center mt-1">
                From {summaries?.length || 0} institutions
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-gray-200">
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
                Cash - Credit
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
                      <Card className="relative overflow-hidden border-gray-200 shadow-sm hover:shadow-md transition-shadow group" data-testid={`card-account-${account.mask || index}`}>
                        <div className={`absolute left-0 top-0 bottom-0 w-1 ${institutionIndex % 2 === 0 ? 'bg-[#007BFF]' : 'bg-[#FF6A00]'}`} />
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <h3 className="font-bold text-gray-900 text-lg">{account.name}</h3>
                              <p className="text-sm text-gray-500">
                                {account.type} • {account.subtype} {account.mask && `• ••${account.mask}`}
                              </p>
                            </div>
                            <div className="p-2 bg-gray-50 rounded-lg">
                              <Wallet className="h-5 w-5 text-gray-400" />
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
                               Linked
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
    </Layout>
  );
}
