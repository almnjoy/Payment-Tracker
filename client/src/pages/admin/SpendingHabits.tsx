import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOCK_SPENDING_CATEGORIES, MOCK_TRANSACTIONS } from "@/lib/mockData";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from "recharts";
import { Filter, Download } from "lucide-react";

const COLORS = ['#007BFF', '#FF6A00', '#00C49F', '#FFBB28', '#FF8042'];

export default function SpendingHabits() {
  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Spending Habits</h2>
          <p className="text-gray-500">Analyze expenses and track budget categories.</p>
        </div>

        {/* Filters Row */}
        <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-500 mr-auto">
             <Filter size={16} /> Filters:
          </div>
          
          <Select defaultValue="jan">
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="jan">January 2026</SelectItem>
              <SelectItem value="dec">December 2025</SelectItem>
              <SelectItem value="nov">November 2025</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="all">
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              <SelectItem value="checking">Main Checking</SelectItem>
              <SelectItem value="credit">Business Credit</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="all-cat">
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-cat">All Categories</SelectItem>
              <SelectItem value="ops">Operations</SelectItem>
              <SelectItem value="payroll">Payroll</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Chart Section */}
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Spending by Category</CardTitle>
              <CardDescription>Distribution of expenses for the selected period.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={MOCK_SPENDING_CATEGORIES}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {MOCK_SPENDING_CATEGORIES.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: 'white', borderRadius: '8px', border: '1px solid #f0f0f0' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Transactions List */}
          <Card className="border-gray-200 shadow-sm">
             <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Recent Transactions</CardTitle>
                <Button variant="ghost" size="sm" className="h-8">
                   <Download className="mr-2 h-3 w-3" /> Export
                </Button>
             </CardHeader>
             <CardContent>
                <div className="space-y-4">
                   {MOCK_TRANSACTIONS.map((tx) => (
                      <div key={tx.id} className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                         <div className="flex flex-col">
                            <span className="font-medium text-gray-900">{tx.merchant}</span>
                            <span className="text-xs text-gray-500">{new Date(tx.date).toLocaleDateString()}</span>
                         </div>
                         <div className="text-right">
                            <span className="block font-bold text-gray-900">${tx.amount.toLocaleString()}</span>
                            <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 font-medium mt-1">
                               {tx.category}
                            </span>
                         </div>
                      </div>
                   ))}
                </div>
                <Button variant="ghost" className="w-full mt-4 text-primary text-sm">
                   View All Transactions
                </Button>
             </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
