import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Filter, Loader2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, RefreshCw, Building } from "lucide-react";
import { useAdminPlaidSpendingSummary, useSyncPlaidTransactions, formatCents } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

const COLORS = ['#007BFF', '#FF6A00', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export default function SpendingHabits() {
  const [dateRange, setDateRange] = useState("30");
  const { toast } = useToast();
  
  const { data: summary, isLoading, refetch } = useAdminPlaidSpendingSummary(parseInt(dateRange));
  const syncTransactions = useSyncPlaidTransactions();

  const handleSync = async () => {
    try {
      const result = await syncTransactions.mutateAsync();
      toast({ 
        title: "Sync Complete", 
        description: `Synced ${result.synced_items} items: ${result.added} added, ${result.modified} modified` 
      });
      refetch();
    } catch (error: any) {
      toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
    }
  };

  const chartData = summary?.categories.slice(0, 8).map(c => ({
    name: c.name,
    value: c.value / 100,
  })) || [];

  const topMerchants = summary?.top_merchants.slice(0, 5) || [];

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Spending Habits</h2>
            <p className="text-gray-500">Analyze expenses and track spending patterns from your linked accounts.</p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleSync}
            disabled={syncTransactions.isPending}
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

        <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mr-auto">
            <Filter size={16} /> Date Range:
          </div>
          
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[160px] h-9" data-testid="select-date-range">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : summary && summary.transaction_count > 0 ? (
          <>
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Inflow</p>
                      <p className="text-2xl font-bold text-green-600" data-testid="text-inflow">
                        {formatCents(summary.total_inflow)}
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                      <ArrowDownRight className="h-5 w-5 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Total Outflow</p>
                      <p className="text-2xl font-bold text-red-600" data-testid="text-outflow">
                        {formatCents(summary.total_outflow)}
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                      <ArrowUpRight className="h-5 w-5 text-red-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Net Cash Flow</p>
                      <p className={`text-2xl font-bold ${summary.net_cash_flow >= 0 ? 'text-green-600' : 'text-red-600'}`} data-testid="text-net-flow">
                        {formatCents(summary.net_cash_flow)}
                      </p>
                    </div>
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${summary.net_cash_flow >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                      {summary.net_cash_flow >= 0 ? (
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="border-gray-200 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Transactions</p>
                      <p className="text-2xl font-bold text-gray-900" data-testid="text-transaction-count">
                        {summary.transaction_count}
                      </p>
                    </div>
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <Building className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card className="border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Spending by Category</CardTitle>
                  <CardDescription>Distribution of expenses for the selected period.</CardDescription>
                </CardHeader>
                <CardContent>
                  {chartData.length > 0 ? (
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {chartData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip 
                            contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #f0f0f0' }}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No spending data available.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Top Merchants</CardTitle>
                  <CardDescription>Highest spending by merchant.</CardDescription>
                </CardHeader>
                <CardContent>
                  {topMerchants.length > 0 ? (
                    <div className="h-[300px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart 
                          data={topMerchants.map(m => ({ name: m.name.slice(0, 15), amount: m.amount_cents / 100 }))}
                          layout="vertical"
                          margin={{ left: 10, right: 30 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                          <YAxis type="category" dataKey="name" width={100} />
                          <RechartsTooltip 
                            formatter={(value: number) => [`$${value.toLocaleString()}`, 'Amount']}
                          />
                          <Bar dataKey="amount" fill="#007BFF" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-400">
                      No merchant data available.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="border-gray-200 shadow-sm">
              <CardHeader>
                <CardTitle>Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.categories.map((category, index) => (
                    <div key={category.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg" data-testid={`category-${index}`}>
                      <div className="flex items-center gap-3">
                        <div 
                          className="h-3 w-3 rounded-full" 
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <span className="font-medium text-gray-900">{category.name}</span>
                      </div>
                      <span className="font-bold text-gray-900">{formatCents(category.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center p-12 text-gray-400">
            <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3">
              <TrendingUp className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900">No Spending Data</h3>
            <p className="text-sm text-center mt-1 max-w-[300px] mb-4">
              Connect your bank accounts to analyze spending patterns.
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
