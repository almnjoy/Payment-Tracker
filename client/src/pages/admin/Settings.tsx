import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CreditCard, Bell, Shield, Globe } from "lucide-react";

export default function AdminSettings() {
  return (
    <Layout role="admin">
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Settings</h2>
          <p className="text-gray-500">Configure platform settings and integrations.</p>
        </div>

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
