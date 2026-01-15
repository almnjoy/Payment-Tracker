import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MOCK_ADMIN_STATS, MOCK_RECENT_ACTIVITY } from "@/lib/mockData";
import { DollarSign, Users, AlertCircle, TrendingUp, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";

const data = [
  { name: "Jan", total: 12000 },
  { name: "Feb", total: 18000 },
  { name: "Mar", total: 15000 },
  { name: "Apr", total: 22000 },
  { name: "May", total: 28000 },
  { name: "Jun", total: 32000 },
  { name: "Jul", total: 35000 },
];

export default function AdminDashboard() {
  const { totalCollected, outstandingBalance, overdueCount, activeClients } = MOCK_ADMIN_STATS;

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
              <div className="text-2xl font-bold text-gray-900">${totalCollected.toLocaleString()}</div>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                +12.5% from last month
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
              <div className="text-2xl font-bold text-gray-900">${outstandingBalance.toLocaleString()}</div>
              <p className="text-xs text-gray-500 mt-1">
                Across {overdueCount} overdue accounts
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
              <div className="text-2xl font-bold text-gray-900">{activeClients}</div>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                +3 new this month
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">
                Growth Rate
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">8.2%</div>
              <p className="text-xs text-gray-500 mt-1">
                Month over month
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
                <AreaChart data={data}>
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
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-8">
                {MOCK_RECENT_ACTIVITY.map((activity, index) => (
                  <div key={activity.id} className="flex items-start gap-4">
                    <div className="mt-1">
                       {activity.type === 'payment' && <div className="h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />}
                       {activity.type === 'invoice' && <div className="h-2 w-2 rounded-full bg-blue-500" />}
                       {activity.type === 'alert' && <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />}
                       {activity.type === 'document' && <div className="h-2 w-2 rounded-full bg-gray-400" />}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium leading-none text-gray-900">
                        {activity.user}
                        {activity.type === 'payment' && <span className="text-gray-500 font-normal"> made a payment of </span>}
                        {activity.type === 'invoice' && <span className="text-gray-500 font-normal"> - </span>}
                        {activity.type === 'alert' && <span className="text-gray-500 font-normal"> has an alert: </span>}
                        {activity.type === 'payment' && <span className="font-bold text-green-700">${activity.amount?.toFixed(2)}</span>}
                      </p>
                      <p className="text-sm text-gray-500">
                         {activity.message || activity.time}
                      </p>
                      {activity.message && <p className="text-xs text-gray-400">{activity.time}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
