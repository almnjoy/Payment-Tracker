import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { MOCK_FINANCE_ENTRIES } from "@/lib/mockData";
import { Plus, Link, AlertCircle } from "lucide-react";

export default function FinanceTracker() {
  const [activeTab, setActiveTab] = useState("income");

  const getEntries = (type: string) => {
    return MOCK_FINANCE_ENTRIES[type as keyof typeof MOCK_FINANCE_ENTRIES] || [];
  };

  const currentEntries = getEntries(activeTab);
  const totalAmount = currentEntries.reduce((sum, entry) => sum + entry.amount, 0);

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Finance Tracker</h2>
            <p className="text-gray-500">Manually track and organize your financial records.</p>
          </div>
          
          <Dialog>
             <DialogTrigger asChild>
                <Button className="btn-primary-orange">
                   <Plus className="mr-2 h-4 w-4" /> Add Entry
                </Button>
             </DialogTrigger>
             <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                   <DialogTitle>Add New {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Entry</DialogTitle>
                   <DialogDescription>
                      Create a new record manually.
                   </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                   <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="name" className="text-right">Name</Label>
                      <Input id="name" placeholder="e.g. Salary" className="col-span-3" />
                   </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="amount" className="text-right">Amount</Label>
                      <Input id="amount" type="number" placeholder="0.00" className="col-span-3" />
                   </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="date" className="text-right">Date</Label>
                      <Input id="date" type="date" className="col-span-3" />
                   </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="recurring" className="text-right">Recurring</Label>
                      <div className="col-span-3 flex items-center gap-2">
                         <Switch id="recurring" />
                         <span className="text-sm text-gray-500">Repeat this entry?</span>
                      </div>
                   </div>
                   <div className="grid grid-cols-4 items-center gap-4">
                      <Label htmlFor="freq" className="text-right">Frequency</Label>
                      <Select>
                         <SelectTrigger className="col-span-3">
                            <SelectValue placeholder="Select frequency" />
                         </SelectTrigger>
                         <SelectContent>
                            <SelectItem value="weekly">Weekly</SelectItem>
                            <SelectItem value="biweekly">Bi-weekly</SelectItem>
                            <SelectItem value="monthly">Monthly</SelectItem>
                            <SelectItem value="yearly">Yearly</SelectItem>
                         </SelectContent>
                      </Select>
                   </div>
                </div>
                <DialogFooter>
                   <Button type="submit" className="btn-primary-orange">Save Entry</Button>
                </DialogFooter>
             </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="income" onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-white border border-gray-200 p-1 rounded-xl h-auto shadow-sm">
            <TabsTrigger value="income" className="rounded-lg data-[state=active]:bg-[#007BFF] data-[state=active]:text-white px-6 py-2">Income</TabsTrigger>
            <TabsTrigger value="bills" className="rounded-lg data-[state=active]:bg-[#007BFF] data-[state=active]:text-white px-6 py-2">Bills</TabsTrigger>
            <TabsTrigger value="debts" className="rounded-lg data-[state=active]:bg-[#007BFF] data-[state=active]:text-white px-6 py-2">Debts</TabsTrigger>
            <TabsTrigger value="holdings" className="rounded-lg data-[state=active]:bg-[#007BFF] data-[state=active]:text-white px-6 py-2">Holdings</TabsTrigger>
          </TabsList>
          
          <div className="grid gap-6 md:grid-cols-3">
             {/* Summary Card */}
             <Card className="md:col-span-1 shadow-sm border-gray-200 h-fit">
                <CardHeader>
                   <CardTitle className="text-lg">Total {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="text-3xl font-bold text-gray-900 mb-2">
                      ${totalAmount.toLocaleString()}
                   </div>
                   <p className="text-sm text-gray-500">
                      Based on {currentEntries.length} manual entries.
                   </p>
                </CardContent>
             </Card>

             {/* Entries List */}
             <Card className="md:col-span-2 shadow-sm border-gray-200">
                <CardHeader>
                   <CardTitle>Manual Entries</CardTitle>
                </CardHeader>
                <CardContent>
                   <div className="space-y-4">
                      {currentEntries.map((entry) => (
                         <div key={entry.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                            <div>
                               <h4 className="font-bold text-gray-900">{entry.name}</h4>
                               <p className="text-sm text-gray-500">{new Date(entry.date).toLocaleDateString()} • {entry.recurring}</p>
                            </div>
                            <span className="font-bold text-gray-900 text-lg">
                               ${entry.amount.toLocaleString()}
                            </span>
                         </div>
                      ))}
                      
                      {currentEntries.length === 0 && (
                         <div className="text-center py-8 text-gray-400">
                            No entries found. Add one to get started.
                         </div>
                      )}
                   </div>
                </CardContent>
             </Card>
          </div>

          {/* Coming Soon Section */}
          <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 bg-gray-50/50 mt-8">
             <div className="flex flex-col items-center justify-center text-center opacity-70">
                <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center mb-4">
                   <Link className="h-6 w-6 text-gray-500" />
                </div>
                <h3 className="text-lg font-bold text-gray-900">Auto-Sync from External Accounts</h3>
                <p className="text-gray-500 max-w-md mt-2">
                   Soon you'll be able to automatically pull {activeTab} data directly from your linked bank accounts and credit cards.
                </p>
                <Button disabled variant="outline" className="mt-4">
                   Coming Soon
                </Button>
             </div>
          </div>
        </Tabs>
      </div>
    </Layout>
  );
}
