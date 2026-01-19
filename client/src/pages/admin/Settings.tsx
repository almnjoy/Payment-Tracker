import { useState, useCallback, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Trash2, RefreshCw, Loader2, DollarSign, Wallet, Building2, Save, ExternalLink, Zap, Mail } from "lucide-react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

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

interface PaymentSettings {
  id: string | null;
  cashAppHandle: string | null;
  cashAppLink: string | null;
  venmoHandle: string | null;
  venmoLink: string | null;
  bankInstructions: string | null;
  stripePlaceholderMessage: string | null;
}

function PaymentSettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<PaymentSettings>({
    id: null,
    cashAppHandle: "",
    cashAppLink: "",
    venmoHandle: "",
    venmoLink: "",
    bankInstructions: "",
    stripePlaceholderMessage: "Stripe payments coming soon!",
  });

  const { data: settings, isLoading } = useQuery<PaymentSettings>({
    queryKey: ["admin", "payment-settings"],
    queryFn: async () => {
      const response = await fetch("/api/admin/payment-settings", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch payment settings");
      return response.json();
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        id: settings.id,
        cashAppHandle: settings.cashAppHandle || "",
        cashAppLink: settings.cashAppLink || "",
        venmoHandle: settings.venmoHandle || "",
        venmoLink: settings.venmoLink || "",
        bankInstructions: settings.bankInstructions || "",
        stripePlaceholderMessage: settings.stripePlaceholderMessage || "Stripe payments coming soon!",
      });
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<PaymentSettings>) => {
      const response = await fetch("/api/admin/payment-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save payment settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "payment-settings"] });
      toast({ title: "Settings Saved", description: "Payment settings have been updated." });
      setIsEditing(false);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      cashAppHandle: formData.cashAppHandle || null,
      cashAppLink: formData.cashAppLink || null,
      venmoHandle: formData.venmoHandle || null,
      venmoLink: formData.venmoLink || null,
      bankInstructions: formData.bankInstructions || null,
      stripePlaceholderMessage: formData.stripePlaceholderMessage || null,
    });
  };

  const handleCancel = () => {
    if (settings) {
      setFormData({
        id: settings.id,
        cashAppHandle: settings.cashAppHandle || "",
        cashAppLink: settings.cashAppLink || "",
        venmoHandle: settings.venmoHandle || "",
        venmoLink: settings.venmoLink || "",
        bankInstructions: settings.bankInstructions || "",
        stripePlaceholderMessage: settings.stripePlaceholderMessage || "Stripe payments coming soon!",
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Client Payment Methods
          </CardTitle>
          <CardDescription>Configure payment methods available to clients for reporting payments.</CardDescription>
        </div>
        {!isEditing ? (
          <Button variant="outline" onClick={() => setIsEditing(true)} data-testid="button-edit-payment-settings">
            Edit Settings
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-payment-settings">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-payment-settings">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4 p-4 bg-green-50/50 rounded-lg border border-green-100">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-green-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">$</div>
              <h4 className="font-semibold text-gray-900">Cash App</h4>
            </div>
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-gray-600">Cash App Handle</Label>
                  <Input
                    placeholder="$YourCashTag"
                    value={formData.cashAppHandle || ""}
                    onChange={(e) => setFormData({ ...formData, cashAppHandle: e.target.value })}
                    data-testid="input-cashapp-handle"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Cash App Link (optional)</Label>
                  <Input
                    placeholder="https://cash.app/$YourCashTag"
                    value={formData.cashAppLink || ""}
                    onChange={(e) => setFormData({ ...formData, cashAppLink: e.target.value })}
                    data-testid="input-cashapp-link"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <p className="text-gray-600">Handle: <span className="font-medium text-gray-900">{settings?.cashAppHandle || "Not configured"}</span></p>
                {settings?.cashAppLink && (
                  <a href={settings.cashAppLink} target="_blank" rel="noopener noreferrer" className="text-green-600 hover:underline flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Open Link
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4 p-4 bg-blue-50/50 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">V</div>
              <h4 className="font-semibold text-gray-900">Venmo</h4>
            </div>
            {isEditing ? (
              <div className="space-y-3">
                <div>
                  <Label className="text-sm text-gray-600">Venmo Handle</Label>
                  <Input
                    placeholder="@YourVenmo"
                    value={formData.venmoHandle || ""}
                    onChange={(e) => setFormData({ ...formData, venmoHandle: e.target.value })}
                    data-testid="input-venmo-handle"
                  />
                </div>
                <div>
                  <Label className="text-sm text-gray-600">Venmo Link (optional)</Label>
                  <Input
                    placeholder="https://venmo.com/YourVenmo"
                    value={formData.venmoLink || ""}
                    onChange={(e) => setFormData({ ...formData, venmoLink: e.target.value })}
                    data-testid="input-venmo-link"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <p className="text-gray-600">Handle: <span className="font-medium text-gray-900">{settings?.venmoHandle || "Not configured"}</span></p>
                {settings?.venmoLink && (
                  <a href={settings.venmoLink} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Open Link
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 p-4 bg-gray-50/50 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-600" />
            <h4 className="font-semibold text-gray-900">Bank Transfer / Other Instructions</h4>
          </div>
          {isEditing ? (
            <Textarea
              placeholder="Enter bank transfer instructions, account details, or other payment information for clients..."
              className="min-h-[100px]"
              value={formData.bankInstructions || ""}
              onChange={(e) => setFormData({ ...formData, bankInstructions: e.target.value })}
              data-testid="textarea-bank-instructions"
            />
          ) : (
            <p className="text-sm text-gray-600 whitespace-pre-wrap">
              {settings?.bankInstructions || "No bank transfer instructions configured."}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface AutomationSettings {
  id: string | null;
  signupEmailWebhookUrl: string | null;
  hasAutomationToken: boolean;
}

interface StripeStatus {
  mode: string;
  secretKeyPresent: boolean;
  publishableKeyPresent: boolean;
  maskedPublishableKey: string | null;
}

function StripeGatewayCard() {
  const { toast } = useToast();
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: status, isLoading } = useQuery<StripeStatus>({
    queryKey: ["admin", "stripe-status"],
    queryFn: async () => {
      const response = await fetch("/api/admin/stripe/status", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch Stripe status");
      return response.json();
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/stripe/test", {
        method: "POST",
        credentials: "include",
      });
      return response.json();
    },
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        toast({ title: "Connection Successful", description: data.message });
      } else {
        toast({ title: "Connection Failed", description: data.message, variant: "destructive" });
      }
    },
    onError: (error: Error) => {
      setTestResult({ success: false, message: error.message });
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
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
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  const bothKeysPresent = status?.secretKeyPresent && status?.publishableKeyPresent;

  return (
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
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-xl bg-white">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-[#635BFF] rounded-lg flex items-center justify-center font-bold text-white text-xl">S</div>
            <div>
              <h4 className="font-bold text-gray-900">Stripe</h4>
              <p className="text-sm text-gray-500">
                {status?.maskedPublishableKey || "No publishable key configured"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
              status?.mode === "Test" 
                ? "bg-amber-50 text-amber-700 border-amber-200" 
                : "bg-green-50 text-green-700 border-green-200"
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${status?.mode === "Test" ? "bg-amber-500" : "bg-green-500"}`}></span>
              {status?.mode || "Test"} Mode
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-sm font-medium text-gray-900 mb-1">Publishable Key</p>
            <div className="flex items-center gap-2">
              <Badge variant={status?.publishableKeyPresent ? "default" : "destructive"} className={status?.publishableKeyPresent ? "bg-green-100 text-green-700 border-green-200" : ""}>
                {status?.publishableKeyPresent ? "Present" : "Missing"}
              </Badge>
              {status?.maskedPublishableKey && (
                <span className="text-xs text-gray-500 font-mono">{status.maskedPublishableKey}</span>
              )}
            </div>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-sm font-medium text-gray-900 mb-1">Secret Key</p>
            <Badge variant={status?.secretKeyPresent ? "default" : "destructive"} className={status?.secretKeyPresent ? "bg-green-100 text-green-700 border-green-200" : ""}>
              {status?.secretKeyPresent ? "Present" : "Missing"}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {testResult && (
              <p className={`text-sm ${testResult.success ? "text-green-600" : "text-red-600"}`}>
                {testResult.message}
              </p>
            )}
          </div>
          <Button
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending || !bothKeysPresent}
            variant="outline"
            data-testid="button-test-stripe"
          >
            {testMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Test Stripe Connection
          </Button>
        </div>

        {!bothKeysPresent && (
          <p className="text-xs text-gray-500">
            Configure STRIPE_SECRET_KEY_TEST and STRIPE_PUBLISHABLE_KEY_TEST in Replit Secrets to enable connection testing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function AutomationSettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    signupEmailWebhookUrl: "https://n8n.srv1077528.hstgr.cloud/webhook-test/client-signup-email",
    automationToken: "", // For new token entry only - never populated from server
  });

  const { data: settings, isLoading } = useQuery<AutomationSettings>({
    queryKey: ["admin", "automation-settings"],
    queryFn: async () => {
      const response = await fetch("/api/admin/automation-settings", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch automation settings");
      return response.json();
    },
  });

  useEffect(() => {
    if (settings) {
      setFormData(prev => ({
        ...prev,
        signupEmailWebhookUrl: settings.signupEmailWebhookUrl || "",
        // Don't populate automationToken from server - it's never returned
      }));
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: { signupEmailWebhookUrl: string | null; automationToken: string | null }) => {
      const response = await fetch("/api/admin/automation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save automation settings");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "automation-settings"] });
      toast({ title: "Settings Saved", description: "Automation settings have been updated." });
      setIsEditing(false);
      // Clear the token field after save
      setFormData(prev => ({ ...prev, automationToken: "" }));
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      signupEmailWebhookUrl: formData.signupEmailWebhookUrl || null,
      automationToken: formData.automationToken || null,
    });
  };

  const handleCancel = () => {
    if (settings) {
      setFormData({
        signupEmailWebhookUrl: settings.signupEmailWebhookUrl || "",
        automationToken: "", // Reset token field
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5" /> Automations</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-yellow-500" /> Automations</CardTitle>
          <CardDescription>Configure webhooks and automated workflows (n8n, Zapier, etc.)</CardDescription>
        </div>
        {isEditing ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCancel} disabled={saveMutation.isPending}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-automation-settings">
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setIsEditing(true)} data-testid="button-edit-automation-settings">Edit</Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4 p-4 bg-purple-50/50 rounded-lg border border-purple-100">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-purple-600" />
            <h4 className="font-semibold text-gray-900">Client Signup Email Webhook</h4>
          </div>
          <p className="text-sm text-gray-600">
            When you click "Send Signup Email" on a client's page, a POST request will be sent to this URL with the client's details.
          </p>
          {isEditing ? (
            <div className="space-y-3">
              <div>
                <Label className="text-sm text-gray-600">n8n Signup Email Webhook URL</Label>
                <Input
                  placeholder="https://n8n.example.com/webhook/client-signup"
                  value={formData.signupEmailWebhookUrl || ""}
                  onChange={(e) => setFormData({ ...formData, signupEmailWebhookUrl: e.target.value })}
                  data-testid="input-signup-webhook-url"
                />
              </div>
              <div>
                <Label className="text-sm text-gray-600">Automation Token (optional, sent as X-Automation-Token header)</Label>
                <Input
                  placeholder="your-secret-token"
                  type="password"
                  value={formData.automationToken || ""}
                  onChange={(e) => setFormData({ ...formData, automationToken: e.target.value })}
                  data-testid="input-automation-token"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-sm">
              <p className="text-gray-600">
                Webhook URL: <span className="font-medium text-gray-900 break-all">{settings?.signupEmailWebhookUrl || "Not configured"}</span>
              </p>
              <p className="text-gray-600">
                Token: <span className="font-medium text-gray-900">{settings?.hasAutomationToken ? "••••••••" : "Not set"}</span>
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
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

        <StripeGatewayCard />

        <PaymentSettingsCard />

        <AutomationSettingsCard />

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
