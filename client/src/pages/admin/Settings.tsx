import { useState, useCallback, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Trash2, RefreshCw, Loader2 } from "lucide-react";
import { usePlaidLink } from "react-plaid-link";
import { 
  useAdminPlaidItems, 
  useCreatePlaidLinkToken, 
  useExchangePlaidToken, 
  useSyncPlaidTransactions, 
  useDeletePlaidItem,
  formatDate 
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

function PlaidLinkButton({ onSuccess }: { onSuccess: () => void }) {
  const createLinkToken = useCreatePlaidLinkToken();
  const exchangeToken = useExchangePlaidToken();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const { toast } = useToast();

  const handleGetLinkToken = async () => {
    try {
      const result = await createLinkToken.mutateAsync();
      setLinkToken(result.link_token);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const onPlaidSuccess = useCallback(async (publicToken: string, metadata: any) => {
    try {
      await exchangeToken.mutateAsync({
        public_token: publicToken,
        institution_id: metadata.institution?.institution_id || "",
        institution_name: metadata.institution?.name || "Unknown",
      });
      toast({ title: "Success", description: "Account linked successfully" });
      setLinkToken(null);
      onSuccess();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  }, [exchangeToken, toast, onSuccess]);

  const onPlaidExit = useCallback(() => {
    setLinkToken(null);
  }, []);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  });

  useEffect(() => {
    if (linkToken && ready) {
      open();
    }
  }, [linkToken, ready, open]);

  return (
    <Button 
      variant="outline" 
      className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all" 
      onClick={handleGetLinkToken}
      disabled={createLinkToken.isPending || exchangeToken.isPending}
      data-testid="button-link-plaid"
    >
      {(createLinkToken.isPending || exchangeToken.isPending) ? (
        <Loader2 className="h-6 w-6 animate-spin" />
      ) : (
        <>
          <div className="h-10 w-10 bg-black rounded-lg flex items-center justify-center text-white font-bold">P</div>
          <span>Plaid</span>
        </>
      )}
    </Button>
  );
}

export default function AdminSettings() {
  const { data: plaidItems, isLoading, refetch } = useAdminPlaidItems();
  const syncTransactions = useSyncPlaidTransactions();
  const deleteItem = useDeletePlaidItem();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);

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

  const handleUnlink = async (itemId: string) => {
    try {
      await deleteItem.mutateAsync(itemId);
      toast({ title: "Success", description: "Account unlinked" });
      refetch();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleLinkSuccess = () => {
    setModalOpen(false);
    refetch();
  };

  return (
    <Layout role="admin">
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Settings</h2>
          <p className="text-gray-500">Configure platform settings and integrations.</p>
        </div>

        <Card className="border-gray-200 shadow-sm">
           <CardHeader className="flex flex-row items-center justify-between">
              <div>
                 <CardTitle>External Accounts</CardTitle>
                 <CardDescription>Manage linked bank accounts and payment providers.</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  onClick={handleSync}
                  disabled={syncTransactions.isPending || !plaidItems?.length}
                  data-testid="button-sync-all"
                >
                  {syncTransactions.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sync Now
                </Button>
                <Dialog open={modalOpen} onOpenChange={setModalOpen}>
                   <DialogTrigger asChild>
                      <Button className="btn-primary-orange shadow-sm" data-testid="button-add-account">
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
                         <PlaidLinkButton onSuccess={handleLinkSuccess} />
                         <Button variant="outline" className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all opacity-50 cursor-not-allowed" disabled>
                            <div className="h-10 w-10 bg-[#635BFF] rounded-lg flex items-center justify-center text-white font-bold">S</div>
                            <span>Stripe (Coming)</span>
                         </Button>
                      </div>
                      <DialogFooter>
                         <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
                      </DialogFooter>
                   </DialogContent>
                </Dialog>
              </div>
           </CardHeader>
           <CardContent className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : plaidItems && plaidItems.length > 0 ? (
                plaidItems.map((item) => (
                   <div key={item.itemId} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg bg-gray-50/50" data-testid={`plaid-item-${item.itemId}`}>
                      <div className="flex items-center gap-4">
                         <div className="h-10 w-10 bg-black rounded-lg flex items-center justify-center text-white font-bold">
                            P
                         </div>
                         <div>
                            <h4 className="font-bold text-gray-900">{item.institutionName || "Linked Account"}</h4>
                            <p className="text-xs text-gray-500">
                              Plaid • Last sync: {item.last_sync_at ? formatDate(item.last_sync_at) : "Never"}
                            </p>
                         </div>
                      </div>
                      <div className="flex items-center gap-3">
                         <Badge variant="outline" className={
                            item.status === 'linked' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                         }>
                            {item.status}
                         </Badge>
                         <Button 
                           variant="ghost" 
                           size="icon" 
                           className="text-gray-400 hover:text-red-600" 
                           onClick={() => handleUnlink(item.itemId)}
                           disabled={deleteItem.isPending}
                           data-testid={`button-unlink-${item.itemId}`}
                         >
                            {deleteItem.isPending ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                         </Button>
                      </div>
                   </div>
                ))
              ) : (
                 <div className="text-center py-6 text-gray-400">
                    No linked accounts yet. Click "Add Account" to get started.
                 </div>
              )}
           </CardContent>
        </Card>

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
