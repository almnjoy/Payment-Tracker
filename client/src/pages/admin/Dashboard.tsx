import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, AlertCircle, TrendingUp, ArrowUpRight, Loader2, BarChart3 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useAdminStats, useAdminPayments, formatCents, formatDate } from "@/lib/api";
import { useMemo } from "react";

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: payments, isLoading: paymentsLoading } = useAdminPayments();

  const chartData = useMemo(() => {
    if (!payments || payments.length === 0) return [];
    
    const monthlyTotals: Record<string, { name: string; total: number; sortKey: string }> = {};
    
    payments.forEach(payment => {
      if (payment.status === 'paid' && payment.paidAt) {
        const date = new Date(payment.paidAt);
        const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        
        if (!monthlyTotals[sortKey]) {
          monthlyTotals[sortKey] = { name: monthName, total: 0, sortKey };
        }
        monthlyTotals[sortKey].total += payment.amountCents / 100;
      }
    });
    
    return Object.values(monthlyTotals)
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map(({ name, total }) => ({ name, total }));
  }, [payments]);

  if (statsLoading) {
    return (
      <Layout role="admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  const recentPayments = payments?.slice(0, 5) || [];
  const hasData = stats && (stats.totalCollectedCents > 0 || stats.outstandingCents > 0 || stats.activeClients > 0);

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Admin Overview</h2>
          <p className="text-gray-500">Platform activity and financial health.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Total Collected
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900" data-testid="text-total-collected">
                {stats ? formatCents(stats.totalCollectedCents) : '$0.00'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stats?.totalCollectedCents === 0 ? 'No payments yet' : 'All time payments received'}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Outstanding Balance
              </CardTitle>
              <AlertCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900" data-testid="text-outstanding">
                {stats ? formatCents(stats.outstandingCents) : '$0.00'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stats?.overdueCount === 0 ? 'No overdue accounts' : `Across ${stats?.overdueCount || 0} overdue accounts`}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Active Clients
              </CardTitle>
              <Users className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900" data-testid="text-active-clients">
                {stats?.activeClients || 0}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stats?.activeClients === 0 ? 'No clients yet' : 'Total registered clients'}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Collection Rate
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {stats && stats.totalCollectedCents > 0 
                  ? `${Math.round((stats.totalCollectedCents / (stats.totalCollectedCents + stats.outstandingCents)) * 100)}%`
                  : 'N/A'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stats?.totalCollectedCents === 0 ? 'No data yet' : 'Payments collected vs outstanding'}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-7">
          <Card className="md:col-span-4 shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle>Revenue Overview</CardTitle>
            </CardHeader>
            <CardContent className="pl-2">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#007BFF" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#007BFF" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                    />
                    <YAxis 
                      stroke="#888888" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false} 
                      tickFormatter={(value) => `$${value}`} 
                    />
                    <Tooltip 
                       contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #f0f0f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                       itemStyle={{ color: '#007BFF', fontWeight: 600 }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="total" 
                      stroke="#007BFF" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorTotal)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                  <BarChart3 className="h-12 w-12 mb-3 text-gray-300" />
                  <p className="font-medium text-gray-900">No revenue data yet</p>
                  <p className="text-sm">Payment history will appear here once clients make payments.</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="md:col-span-3 shadow-sm border-gray-200">
            <CardHeader>
              <CardTitle>Recent Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentsLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : recentPayments.length > 0 ? (
                <div className="space-y-6">
                  {recentPayments.map((payment) => (
                    <div key={payment.paymentId} className="flex items-start gap-4">
                      <div className="mt-1">
                        <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium leading-none text-gray-900">
                          Payment received
                          <span className="font-bold text-green-700 ml-1">
                            {formatCents(payment.amountCents)}
                          </span>
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(payment.paidAt || payment.createdAt)} • {payment.method}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <DollarSign className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p className="font-medium text-gray-900">No payments yet</p>
                  <p className="text-sm">Payments will appear here once recorded.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
