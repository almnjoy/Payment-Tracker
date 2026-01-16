import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, AlertCircle, TrendingUp, ArrowUpRight, Loader2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useAdminStats, useAdminPayments, formatCents, formatDate } from "@/lib/api";

const chartData = [
  { name: "Jan", total: 12000 },
  { name: "Feb", total: 18000 },
  { name: "Mar", total: 15000 },
  { name: "Apr", total: 22000 },
  { name: "May", total: 28000 },
  { name: "Jun", total: 32000 },
  { name: "Jul", total: 35000 },
];

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: payments, isLoading: paymentsLoading } = useAdminPayments();

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
              <p className="text-xs text-green-600 flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                All time payments received
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
                Across {stats?.overdueCount || 0} overdue accounts
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
              <p className="text-xs text-green-600 flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Total registered clients
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
                  : '0%'}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Payments collected vs outstanding
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
                <p className="text-center text-gray-500 py-8">No payments yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
