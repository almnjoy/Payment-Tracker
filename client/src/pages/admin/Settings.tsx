import { useState, useCallback, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Plus, Trash2, RefreshCw, Loader2, DollarSign, Wallet, Building2, Save, ExternalLink, Zap, Mail, ChevronDown, ChevronRight, Bell, Calendar, Copy, Play } from "lucide-react";
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

function PlaidLinkButton({ onSuccess, onClose, onPlaidLaunchingChange }: { onSuccess: () => void; onClose?: () => void; onPlaidLaunchingChange?: (launching: boolean) => void }) {
  const createLinkToken = useCreatePlaidLinkToken();
  const exchangeToken = useExchangePlaidToken();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isPlaidLaunching, setIsPlaidLaunching] = useState(false);
  const { toast } = useToast();
  
  const updatePlaidLaunching = (launching: boolean) => {
    setIsPlaidLaunching(launching);
    if (onPlaidLaunchingChange) onPlaidLaunchingChange(launching);
  };

  const handleGetLinkToken = async () => {
    try {
      updatePlaidLaunching(true);
      const result = await createLinkToken.mutateAsync();
      console.log("token fetched", result.link_token);
      setLinkToken(result.link_token);
    } catch (error: any) {
      updatePlaidLaunching(false);
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const onPlaidSuccess = useCallback(async (publicToken: string, metadata: any) => {
    console.log("onSuccess");
    try {
      await exchangeToken.mutateAsync({
        public_token: publicToken,
        institution_id: metadata.institution?.institution_id || "",
        institution_name: metadata.institution?.name || "Unknown",
      });
      toast({ title: "Success", description: "Account linked successfully" });
      setLinkToken(null);
      updatePlaidLaunching(false);
      onSuccess();
      if (onClose) onClose();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      updatePlaidLaunching(false);
    }
  }, [exchangeToken, toast, onSuccess, onClose, onPlaidLaunchingChange]);

  const onPlaidExit = useCallback(() => {
    console.log("onExit");
    setLinkToken(null);
    updatePlaidLaunching(false);
    if (onClose) onClose();
  }, [onClose, onPlaidLaunchingChange]);

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  });

  useEffect(() => {
    console.log("plaid ready", ready, "token", !!linkToken);
    if (linkToken && ready) {
      console.log("calling open()");
      open();
    }
  }, [linkToken, ready, open]);

  return (
    <Button 
      variant="outline" 
      className="h-24 flex flex-col gap-2 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all" 
      onClick={handleGetLinkToken}
      disabled={createLinkToken.isPending || exchangeToken.isPending || isPlaidLaunching}
      data-testid="button-link-plaid"
    >
      {(createLinkToken.isPending || exchangeToken.isPending || isPlaidLaunching) ? (
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
  signupEmailEnabled: boolean;
  hasSignupEmailToken: boolean;
  paymentReceivedWebhookUrl: string | null;
  paymentReceivedEnabled: boolean;
  hasPaymentReceivedToken: boolean;
  monthlySummaryWebhookUrl: string | null;
  monthlySummaryEnabled: boolean;
  hasMonthlySummaryToken: boolean;
  paymentReceivedAlertsGlobalEnabled: boolean;
  monthlySummaryGlobalEnabled: boolean;
}

const PAYLOAD_SNIPPETS = {
  signupEmail: `{
  "clientName": "John Doe",
  "clientEmail": "john@example.com",
  "clientId": "CL-XXXXXX",
  "portalUrl": "https://example.com"
}`,
  paymentReceived: `{
  "event": "client.payment_received",
  "clientId": "CL-XXXXXX",
  "clientName": "John Doe",
  "clientEmail": "john@example.com",
  "payment": {
    "paymentId": "PAY-XXXX",
    "amount": 1000,
    "method": "stripe",
    "status": "confirmed",
    "createdAt": "2026-01-19T12:34:56Z"
  },
  "portalUrl": "https://example.com"
}`,
  monthlySummary: `{
  "event": "admin.monthly_summary",
  "period": {
    "start": "2026-01-01",
    "end": "2026-01-31"
  },
  "totals": {
    "income": 0,
    "bills": 0,
    "debts": 0,
    "holdings": 0,
    "other": 0
  },
  "portalUrl": "https://example.com"
}`,
};

interface WebhookTileProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  webhookUrl: string | null;
  hasToken: boolean;
  enabled: boolean;
  webhookType: string;
  payloadSnippet: string;
  onEdit: () => void;
}

function WebhookTile({ title, description, icon, webhookUrl, hasToken, enabled, webhookType, payloadSnippet, onEdit }: WebhookTileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const copyPayload = () => {
    navigator.clipboard.writeText(payloadSnippet);
    toast({ title: "Copied", description: "Payload copied to clipboard" });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
            <div className="flex items-center gap-3">
              {icon}
              <div>
                <h4 className="font-medium text-gray-900">{title}</h4>
                <div className="flex items-center gap-2 mt-0.5">
                  {enabled ? (
                    <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">Enabled</Badge>
                  ) : (
                    <Badge variant="outline" className="text-gray-500 text-xs">Disabled</Badge>
                  )}
                  {webhookUrl ? (
                    <span className="text-xs text-gray-500 truncate max-w-[200px]">{webhookUrl}</span>
                  ) : (
                    <span className="text-xs text-gray-400">Not configured</span>
                  )}
                </div>
              </div>
            </div>
            {isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50/50">
            <p className="text-sm text-gray-600 mb-3">{description}</p>
            <div className="space-y-2 text-sm mb-4">
              <p className="text-gray-600">
                <span className="font-medium">Webhook URL:</span>{" "}
                <span className="text-gray-900 break-all">{webhookUrl || "Not set"}</span>
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Token:</span>{" "}
                <span className="text-gray-900">{hasToken ? "••••••••" : "Not set"}</span>
              </p>
              <p className="text-gray-600">
                <span className="font-medium">Enabled:</span>{" "}
                <span className="text-gray-900">{enabled ? "Yes" : "No"}</span>
              </p>
            </div>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm font-medium text-gray-700">Expected Payload</Label>
                <Button variant="ghost" size="sm" onClick={copyPayload} className="h-7 text-xs">
                  <Copy className="h-3 w-3 mr-1" /> Copy
                </Button>
              </div>
              <pre className="bg-gray-900 text-green-400 p-3 rounded-md text-xs overflow-x-auto font-mono">
                {payloadSnippet}
              </pre>
            </div>
            <Button variant="outline" size="sm" onClick={onEdit} data-testid={`button-edit-${webhookType}`}>
              Edit Configuration
            </Button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
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

function NotificationsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery<AutomationSettings>({
    queryKey: ["admin", "automation-settings"],
    queryFn: async () => {
      const response = await fetch("/api/admin/automation-settings", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch automation settings");
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const response = await fetch("/api/admin/automation-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to save");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "automation-settings"] });
      toast({ title: "Saved", description: "Notification preferences updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleToggle = (field: string, value: boolean) => {
    saveMutation.mutate({ [field]: value });
  };

  if (isLoading) {
    return (
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
        <CardDescription>Control what alerts you and your clients receive.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Payment Received Alerts</Label>
            <p className="text-sm text-gray-500">Get notified when a client makes a payment (requires Payment Received webhook)</p>
          </div>
          <Switch 
            checked={settings?.paymentReceivedAlertsGlobalEnabled ?? true}
            onCheckedChange={(checked) => handleToggle("paymentReceivedAlertsGlobalEnabled", checked)}
            disabled={saveMutation.isPending}
            data-testid="switch-payment-alerts-global"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-base">Monthly Summary</Label>
            <p className="text-sm text-gray-500">Receive a monthly breakdown of activity (requires Monthly Summary webhook)</p>
          </div>
          <Switch 
            checked={settings?.monthlySummaryGlobalEnabled ?? true}
            onCheckedChange={(checked) => handleToggle("monthlySummaryGlobalEnabled", checked)}
            disabled={saveMutation.isPending}
            data-testid="switch-monthly-summary-global"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AutomationSettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingWebhook, setEditingWebhook] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    webhookUrl: "",
    token: "",
    enabled: false,
  });
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);

  const { data: settings, isLoading } = useQuery<AutomationSettings>({
    queryKey: ["admin", "automation-settings"],
    queryFn: async () => {
      const response = await fetch("/api/admin/automation-settings", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch automation settings");
      return response.json();
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
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
      setEditingWebhook(null);
      setFormData({ webhookUrl: "", token: "", enabled: false });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const testMutation = useMutation({
    mutationFn: async (webhookType: string) => {
      setTestingWebhook(webhookType);
      const response = await fetch("/api/admin/test-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ webhookType }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Test failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Test Successful", description: "Webhook received the test payload." });
      setTestingWebhook(null);
    },
    onError: (error: Error) => {
      toast({ title: "Test Failed", description: error.message, variant: "destructive" });
      setTestingWebhook(null);
    },
  });

  const openEditModal = (type: string) => {
    if (!settings) return;
    
    switch (type) {
      case "signupEmail":
        setFormData({
          webhookUrl: settings.signupEmailWebhookUrl || "",
          token: "",
          enabled: settings.signupEmailEnabled,
        });
        break;
      case "paymentReceived":
        setFormData({
          webhookUrl: settings.paymentReceivedWebhookUrl || "",
          token: "",
          enabled: settings.paymentReceivedEnabled,
        });
        break;
      case "monthlySummary":
        setFormData({
          webhookUrl: settings.monthlySummaryWebhookUrl || "",
          token: "",
          enabled: settings.monthlySummaryEnabled,
        });
        break;
    }
    setEditingWebhook(type);
  };

  const handleSave = () => {
    if (!editingWebhook) return;
    
    const updateData: Record<string, any> = {};
    
    switch (editingWebhook) {
      case "signupEmail":
        updateData.signupEmailWebhookUrl = formData.webhookUrl || null;
        if (formData.token) updateData.signupEmailToken = formData.token;
        updateData.signupEmailEnabled = formData.enabled;
        break;
      case "paymentReceived":
        updateData.paymentReceivedWebhookUrl = formData.webhookUrl || null;
        if (formData.token) updateData.paymentReceivedToken = formData.token;
        updateData.paymentReceivedEnabled = formData.enabled;
        break;
      case "monthlySummary":
        updateData.monthlySummaryWebhookUrl = formData.webhookUrl || null;
        if (formData.token) updateData.monthlySummaryToken = formData.token;
        updateData.monthlySummaryEnabled = formData.enabled;
        break;
    }
    
    saveMutation.mutate(updateData);
  };

  const getEditModalTitle = () => {
    switch (editingWebhook) {
      case "signupEmail": return "Client Signup Email Webhook";
      case "paymentReceived": return "Payment Received Alerts Webhook";
      case "monthlySummary": return "Monthly Summaries Webhook";
      default: return "Edit Webhook";
    }
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
    <>
      <Card className="border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="h-5 w-5 text-yellow-500" /> Automations</CardTitle>
          <CardDescription>Configure webhooks and automated workflows (n8n, Zapier, etc.)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <WebhookTile
            title="Client Signup Email Webhook"
            description="When you click 'Send Signup Email' on a client's page, a POST request will be sent with the client's details."
            icon={<Mail className="h-5 w-5 text-purple-600" />}
            webhookUrl={settings?.signupEmailWebhookUrl || null}
            hasToken={settings?.hasSignupEmailToken || false}
            enabled={settings?.signupEmailEnabled || false}
            webhookType="signupEmail"
            payloadSnippet={PAYLOAD_SNIPPETS.signupEmail}
            onEdit={() => openEditModal("signupEmail")}
          />
          <WebhookTile
            title="Payment Received Alerts"
            description="Triggered when a client payment is confirmed (via Stripe or manual confirmation). Requires global notification toggle to be enabled."
            icon={<Bell className="h-5 w-5 text-green-600" />}
            webhookUrl={settings?.paymentReceivedWebhookUrl || null}
            hasToken={settings?.hasPaymentReceivedToken || false}
            enabled={settings?.paymentReceivedEnabled || false}
            webhookType="paymentReceived"
            payloadSnippet={PAYLOAD_SNIPPETS.paymentReceived}
            onEdit={() => openEditModal("paymentReceived")}
          />
          <WebhookTile
            title="Monthly Summaries"
            description="Send a monthly summary of financial data to your automation platform. Use the 'Generate Now' button to trigger manually."
            icon={<Calendar className="h-5 w-5 text-blue-600" />}
            webhookUrl={settings?.monthlySummaryWebhookUrl || null}
            hasToken={settings?.hasMonthlySummaryToken || false}
            enabled={settings?.monthlySummaryEnabled || false}
            webhookType="monthlySummary"
            payloadSnippet={PAYLOAD_SNIPPETS.monthlySummary}
            onEdit={() => openEditModal("monthlySummary")}
          />
        </CardContent>
      </Card>

      <Dialog open={!!editingWebhook} onOpenChange={(open) => !open && setEditingWebhook(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{getEditModalTitle()}</DialogTitle>
            <DialogDescription>Configure the webhook URL, authentication token, and enable/disable the automation.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                placeholder="https://n8n.example.com/webhook/..."
                value={formData.webhookUrl}
                onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                data-testid="input-webhook-url"
              />
            </div>
            <div className="space-y-2">
              <Label>Token (sent as Authorization: Bearer header)</Label>
              <Input
                type="password"
                placeholder="Leave blank to keep existing token"
                value={formData.token}
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                data-testid="input-webhook-token"
              />
              <p className="text-xs text-gray-500">Leave blank to keep the existing token unchanged.</p>
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                data-testid="switch-webhook-enabled"
              />
            </div>
            <div className="pt-2">
              <Label className="text-sm font-medium text-gray-700 mb-2 block">Expected Payload</Label>
              <pre className="bg-gray-900 text-green-400 p-3 rounded-md text-xs overflow-x-auto font-mono max-h-40">
                {editingWebhook ? PAYLOAD_SNIPPETS[editingWebhook as keyof typeof PAYLOAD_SNIPPETS] : ""}
              </pre>
            </div>
          </div>
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button 
              variant="outline" 
              onClick={() => editingWebhook && testMutation.mutate(editingWebhook)}
              disabled={!formData.webhookUrl || testingWebhook === editingWebhook}
              data-testid="button-test-webhook"
            >
              {testingWebhook === editingWebhook ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Test Webhook
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditingWebhook(null)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending} data-testid="button-save-webhook">
                {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminSettings() {
  const { data: plaidItems, isLoading, refetch } = useAdminPlaidItems();
  const syncTransactions = useSyncPlaidTransactions();
  const deleteItem = useDeletePlaidItem();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [isPlaidLaunching, setIsPlaidLaunching] = useState(false);

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
                <Dialog open={modalOpen} onOpenChange={setModalOpen} modal={!isPlaidLaunching}>
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
                         <PlaidLinkButton onSuccess={handleLinkSuccess} onClose={() => setModalOpen(false)} onPlaidLaunchingChange={setIsPlaidLaunching} />
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

        <NotificationsCard />
      </div>
    </Layout>
  );
}
