import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Upload, Building2 } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

function withOrganizationScope(path: string, organizationId?: string) {
  if (!organizationId) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}organizationId=${encodeURIComponent(organizationId)}`;
}

interface InvoiceSettingsData {
  organizationId: string | null;
  businessLogo: string | null;
  businessName: string;
  businessAddress: string;
  businessEmail: string;
  defaultTerms: string;
  defaultFooterText: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
}

export default function InvoiceSettings() {
  const { user } = useAuth();
  const organizationId = user?.id;
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [settings, setSettings] = useState<InvoiceSettingsData>({
    organizationId: null,
    businessLogo: null,
    businessName: "",
    businessAddress: "",
    businessEmail: "",
    defaultTerms: "Due on Receipt",
    defaultFooterText: "Thanks for your business.",
    invoicePrefix: "INV-",
    nextInvoiceNumber: 1,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(withOrganizationScope("/api/admin/invoice-settings", organizationId), { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await apiRequest("POST", withOrganizationScope("/api/admin/invoice-settings", organizationId), {
        businessName: settings.businessName,
        businessAddress: settings.businessAddress,
        businessEmail: settings.businessEmail,
        defaultTerms: settings.defaultTerms,
        defaultFooterText: settings.defaultFooterText,
        invoicePrefix: settings.invoicePrefix,
        nextInvoiceNumber: settings.nextInvoiceNumber,
      });
      
      if (response.ok) {
        toast({
          title: "Settings Saved",
          description: "Your invoice settings have been updated.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("logo", file);

    try {
      const response = await fetch(withOrganizationScope("/api/admin/invoice-settings/logo", organizationId), {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (response.ok) {
        const { url } = await response.json();
        setSettings(prev => ({ ...prev, businessLogo: url }));
        toast({
          title: "Logo Uploaded",
          description: "Your business logo has been updated.",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to upload logo. Please try again.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Layout role="admin">
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading settings...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="admin">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Invoice Settings</h2>
          <p className="text-gray-500">Configure your business information and invoice defaults.</p>
        </div>

        <Card className="border-gray-200 shadow-lg">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <Building2 size={20} />
              </div>
              <div>
                <CardTitle>Business Information</CardTitle>
                <CardDescription>This information appears on your invoices.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <Label>Business Logo</Label>
              <div className="flex items-center gap-4">
                {settings.businessLogo ? (
                  <img
                    src={settings.businessLogo}
                    alt="Business Logo"
                    className="h-16 w-auto object-contain border rounded-lg p-2"
                    data-testid="img-business-logo"
                  />
                ) : (
                  <div className="h-16 w-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-400">
                    <Building2 size={24} />
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  data-testid="input-logo-upload"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-logo"
                >
                  <Upload className="mr-2 h-4 w-4" /> Upload Logo
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessName">Business Name</Label>
              <Input
                id="businessName"
                value={settings.businessName}
                onChange={(e) => setSettings(prev => ({ ...prev, businessName: e.target.value }))}
                placeholder="Your Business Name"
                className="h-11"
                data-testid="input-business-name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessAddress">Business Address</Label>
              <Textarea
                id="businessAddress"
                value={settings.businessAddress}
                onChange={(e) => setSettings(prev => ({ ...prev, businessAddress: e.target.value }))}
                placeholder="123 Main St&#10;City, State 12345"
                rows={3}
                data-testid="input-business-address"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessEmail">Business Email</Label>
              <Input
                id="businessEmail"
                type="email"
                value={settings.businessEmail}
                onChange={(e) => setSettings(prev => ({ ...prev, businessEmail: e.target.value }))}
                placeholder="billing@yourbusiness.com"
                className="h-11"
                data-testid="input-business-email"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-lg">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                <Settings size={20} />
              </div>
              <div>
                <CardTitle>Invoice Defaults</CardTitle>
                <CardDescription>Configure default values for new invoices.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invoicePrefix">Invoice Number Prefix</Label>
                <Input
                  id="invoicePrefix"
                  value={settings.invoicePrefix}
                  onChange={(e) => setSettings(prev => ({ ...prev, invoicePrefix: e.target.value }))}
                  placeholder="INV-"
                  className="h-11"
                  data-testid="input-invoice-prefix"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nextNumber">Next Invoice Number</Label>
                <Input
                  id="nextNumber"
                  type="number"
                  min={1}
                  value={settings.nextInvoiceNumber}
                  onChange={(e) => setSettings(prev => ({ ...prev, nextInvoiceNumber: parseInt(e.target.value) || 1 }))}
                  className="h-11"
                  data-testid="input-next-number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultTerms">Default Payment Terms</Label>
              <Input
                id="defaultTerms"
                value={settings.defaultTerms}
                onChange={(e) => setSettings(prev => ({ ...prev, defaultTerms: e.target.value }))}
                placeholder="Due on Receipt"
                className="h-11"
                data-testid="input-default-terms"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultFooter">Default Footer Text</Label>
              <Textarea
                id="defaultFooter"
                value={settings.defaultFooterText}
                onChange={(e) => setSettings(prev => ({ ...prev, defaultFooterText: e.target.value }))}
                placeholder="Thanks for your business."
                rows={2}
                data-testid="input-default-footer"
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary-orange h-11 px-8"
            data-testid="button-save-settings"
          >
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </Layout>
  );
}
