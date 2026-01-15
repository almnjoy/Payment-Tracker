import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Bell, Shield, Globe, Plus, Link, Trash2 } from "lucide-react";
import { MOCK_EXTERNAL_ACCOUNTS } from "@/lib/mockData";

export default function AdminSettings() {
  const [accounts, setAccounts] = useState(MOCK_EXTERNAL_ACCOUNTS);
  const [modalOpen, setModalOpen] = useState(false);

  const handleAddAccount = (provider: string) => {
    // Fake adding an account
    const newAccount = {
      id: Date.now(),
      provider: provider,
      name: "New Linked Account",
      type: "checking",
      balance: 1500.00,
      status: "Linked",
      lastSync: "Just now",
      change: "+0.0%"
    };
    setAccounts([...accounts, newAccount]);
    setModalOpen(false);
  };

  const handleUnlink = (id: number) => {
    setAccounts(accounts.filter(acc => acc.id !== id));
  };

  return (
    <Layout role="admin">
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Settings</h2>
          <p className="text-gray-500">Configure platform settings and integrations.</p>
        </div>

        {/* External Accounts Section */}
        <Card className="border-gray-200 shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between">
              <div>
                 <CardTitle>External Accounts</CardTitle>
                 <CardDescription>Manage linked bank accounts and payment providers.</CardDescription>
              </div>
              <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                 <DialogTrigger asChild>
                    <Button className="btn-primary-orange shadow-sm">
                       <Plus className="mr-2 h-4 w-4" /> Add Account
                    </Button>
                 </DialogTrigger>
                 <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                       <DialogTitle>Link an Account</DialogTitle>
                       <DialogDescription>
                          Select a provider to connect a new financial account.
                       </DialogDescription>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 py-4">
                       <Button variant="outline" className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all" onClick={() => handleAddAccount("Plaid")}>
                          <div className="h-10 w-10 bg-black rounded-lg flex items-center justify-center text-white font-bold">P</div>
                          <span>Plaid</span>
                       </Button>
                       <Button variant="outline" className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all" onClick={() => handleAddAccount("Stripe")}>
                          <div className="h-10 w-10 bg-[#635BFF] rounded-lg flex items-center justify-center text-white font-bold">S</div>
                          <span>Stripe</span>
                       </Button>
                       <Button variant="outline" className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all" onClick={() => handleAddAccount("Manual")}>
                          <div className="h-10 w-10 bg-gray-200 rounded-lg flex items-center justify-center text-gray-600 font-bold">M</div>
                          <span>Manual</span>
                       </Button>
                    </div>
                    <DialogFooter>
                       <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                    </DialogFooter>
                 </DialogContent>
              </Dialog>
           </CardHeader>
           <CardContent className="space-y-4">
              {accounts.map((acc) => (
                 <div key={acc.id} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-gray-50/50">
                    <div className="flex items-center gap-4">
                       <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold ${
                          acc.provider.includes('Stripe') ? 'bg-[#635BFF]' : 
                          acc.provider.includes('Plaid') ? 'bg-black' : 'bg-gray-400'
                       }`}>
                          {acc.provider.charAt(0)}
                       </div>
                       <div>
                          <h4 className="font-bold text-gray-900">{acc.name}</h4>
                          <p className="text-xs text-gray-500">{acc.provider} • Last sync: {acc.lastSync}</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-3">
                       <Badge variant="outline" className={
                          acc.status === 'Linked' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                       }>
                          {acc.status}
                       </Badge>
                       <Button variant="ghost" size="sm">Manage</Button>
                       <Button variant="ghost" size="icon" className="text-gray-400 hover:text-red-600" onClick={() => handleUnlink(acc.id)}>
                          <Trash2 size={16} />
                       </Button>
                    </div>
                 </div>
              ))}
              {accounts.length === 0 && (
                 <div className="text-center py-6 text-gray-400">
                    No linked accounts yet.
                 </div>
              )}
           </CardContent>
        </Card>

        {/* Existing Payment Gateway Card */}
        <Card className="border-gray-200 shadow-sm overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-gray-900 to-gray-800 text-white">
            <div className="flex items-center gap-3">
               <div className="p-2 bg-white/10 rounded-lg">
                  <CreditCard className="h-6 w-6 text-white" />
               </div>
               <div>
                 <CardTitle className="text-white">Payment Gateway</CardTitle>
                 <CardDescription className="text-gray-300">Manage Stripe connection and payment processing.</CardDescription>
               </div>
            </div>
          </CardHeader>
          <CardContent className="p-6">
             <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-white">
                <div className="flex items-center gap-4">
                   <div className="h-12 w-12 bg-[#635BFF] rounded-lg flex items-center justify-center font-bold text-white text-xl">S</div>
                   <div>
                      <h4 className="font-bold text-gray-900">Stripe Payments</h4>
                      <p className="text-sm text-gray-500">Connected account: Quick IT Projects Inc.</p>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                      Live
                   </div>
                   <Button variant="outline" size="sm">Manage</Button>
                </div>
             </div>
             
             <div className="grid md:grid-cols-2 gap-4 mt-4">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                   <p className="text-sm font-medium text-gray-900 mb-1">Currency</p>
                   <p className="text-sm text-gray-500">USD - US Dollar</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
                   <p className="text-sm font-medium text-gray-900 mb-1">Payout Schedule</p>
                   <p className="text-sm text-gray-500">Automatic - Daily</p>
                </div>
             </div>
          </CardContent>
        </Card>

        {/* Existing Notifications Card */}
        <Card className="border-gray-200 shadow-sm">
           <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Control what alerts you and your clients receive.</CardDescription>
           </CardHeader>
           <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                 <div className="space-y-0.5">
                    <Label className="text-base">Payment Received Alerts</Label>
                    <p className="text-sm text-gray-500">Get notified when a client makes a payment</p>
                 </div>
                 <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                 <div className="space-y-0.5">
                    <Label className="text-base">Overdue Reminders</Label>
                    <p className="text-sm text-gray-500">Automatically email clients about overdue invoices</p>
                 </div>
                 <Switch defaultChecked />
              </div>
              <div className="flex items-center justify-between">
                 <div className="space-y-0.5">
                    <Label className="text-base">Daily Summary</Label>
                    <p className="text-sm text-gray-500">Receive a daily breakdown of activity</p>
                 </div>
                 <Switch />
              </div>
           </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
