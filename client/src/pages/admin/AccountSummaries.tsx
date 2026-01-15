import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MOCK_EXTERNAL_ACCOUNTS } from "@/lib/mockData";
import { DollarSign, Wallet, CreditCard, Building, ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

export default function AccountSummaries() {
  const totalCash = MOCK_EXTERNAL_ACCOUNTS
    .filter(acc => ['checking', 'savings', 'payments'].includes(acc.type))
    .reduce((sum, acc) => sum + acc.balance, 0);
    
  const netWorth = MOCK_EXTERNAL_ACCOUNTS.reduce((sum, acc) => sum + acc.balance, 0);

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Account Summaries</h2>
          <p className="text-gray-500">Overview of all linked financial accounts and balances.</p>
        </div>

        {/* Top KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Cash</CardTitle>
              <DollarSign className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">${totalCash.toLocaleString()}</div>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Liquid Assets
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total Debt</CardTitle>
              <CreditCard className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">$50,000.00</div>
              <p className="text-xs text-orange-600 flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                Business Loan
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Monthly Bills</CardTitle>
              <Building className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">$3,450.00</div>
              <p className="text-xs text-gray-500 flex items-center mt-1">
                Recurring Expenses
              </p>
            </CardContent>
          </Card>
          
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Net Worth</CardTitle>
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">${(netWorth - 50000).toLocaleString()}</div>
              <p className="text-xs text-green-600 flex items-center mt-1">
                <ArrowUpRight className="h-3 w-3 mr-1" />
                +2.4% this month
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Account Cards Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {MOCK_EXTERNAL_ACCOUNTS.map((account, index) => (
            <motion.div
              key={account.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`relative overflow-hidden border-gray-200 shadow-sm hover:shadow-md transition-shadow group`}>
                <div className={`absolute left-0 top-0 bottom-0 w-1 ${index % 2 === 0 ? 'bg-[#007BFF]' : 'bg-[#FF6A00]'}`} />
                <CardContent className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{account.name}</h3>
                      <p className="text-sm text-gray-500">{account.provider} • {account.type}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <Wallet className="h-5 w-5 text-gray-400" />
                    </div>
                  </div>
                  
                  <div className="space-y-1 mb-4">
                    <div className="text-3xl font-bold text-gray-900 tracking-tight">
                      ${account.balance.toLocaleString()}
                    </div>
                    <div className={`text-sm font-medium flex items-center ${account.change.startsWith('+') ? 'text-green-600' : 'text-red-600'}`}>
                      {account.change.startsWith('+') ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                      {account.change} <span className="text-gray-400 ml-1 font-normal">last 30 days</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                     <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                       account.status === 'Linked' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                     }`}>
                       {account.status}
                     </span>
                     <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/5 hover:text-primary">
                       View Details
                     </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          
          {/* Add Account Placeholder Card */}
          <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50 flex flex-col items-center justify-center p-6 text-gray-400 hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer min-h-[220px]">
            <div className="h-12 w-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3">
              <DollarSign className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900">Add New Account</h3>
            <p className="text-sm text-center mt-1 max-w-[200px]">Connect another bank account or credit card</p>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
