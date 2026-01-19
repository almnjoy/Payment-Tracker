import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { User, Mail, Phone, MapPin, Loader2, Eye, ArrowLeft, Calendar, Hash, Building, Bell, Save, X, ExternalLink, Shield } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useClientDashboard, formatDate } from "@/lib/api";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function ClientProfile() {
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const asClientId = searchParams.get("asClientId") || undefined;
  const isImpersonating = !!asClientId;
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: dashboardData, isLoading } = useClientDashboard(asClientId);

  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: "",
    email: "",
    phone: "",
    address: "",
    notificationsEnabled: true,
  });

  useEffect(() => {
    if (dashboardData?.client) {
      setFormData({
        displayName: dashboardData.client.displayName || "",
        email: dashboardData.client.email || "",
        phone: dashboardData.client.phone || "",
        address: dashboardData.client.address || "",
        notificationsEnabled: dashboardData.client.notificationsEnabled ?? true,
      });
    }
  }, [dashboardData?.client]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch("/api/client/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to update profile");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Profile updated", description: "Your changes have been saved." });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ["client-dashboard"] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSave = () => {
    if (!formData.displayName.trim()) {
      toast({ title: "Error", description: "Name is required", variant: "destructive" });
      return;
    }
    if (!formData.email.trim()) {
      toast({ title: "Error", description: "Email is required", variant: "destructive" });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast({ title: "Error", description: "Invalid email format", variant: "destructive" });
      return;
    }
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (dashboardData?.client) {
      setFormData({
        displayName: dashboardData.client.displayName || "",
        email: dashboardData.client.email || "",
        phone: dashboardData.client.phone || "",
        address: dashboardData.client.address || "",
        notificationsEnabled: dashboardData.client.notificationsEnabled ?? true,
      });
    }
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <Layout role="client">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  const client = dashboardData?.client;
  const activeLease = dashboardData?.activeLease;

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "CL";
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const getStatusBadge = (status: string | undefined) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-700 border-green-200">Active</Badge>;
      case 'paused': return <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">Paused</Badge>;
      case 'inactive': return <Badge className="bg-gray-100 text-gray-700 border-gray-200">Inactive</Badge>;
      case 'behind': return <Badge className="bg-red-100 text-red-700 border-red-200">Behind</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  return (
    <Layout role="client" clientName={client?.displayName}>
      <div className="max-w-3xl mx-auto space-y-6">
        {isImpersonating && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between" data-testid="impersonation-banner">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Admin Preview Mode</p>
                <p className="text-sm text-amber-700">You are viewing this portal as <strong>{client?.displayName || 'Client'}</strong></p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate(`/admin/clients/${asClientId}`)}
              className="border-amber-300 text-amber-700 hover:bg-amber-100"
              data-testid="button-exit-preview"
            >
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Admin
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Profile</h2>
            <p className="text-gray-500">Your account information and details.</p>
          </div>
          {!isImpersonating && !isEditing && (
            <Button onClick={() => setIsEditing(true)} data-testid="button-edit-profile">
              Edit Profile
            </Button>
          )}
          {isEditing && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel} data-testid="button-cancel-edit">
                <X className="h-4 w-4 mr-2" /> Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateProfileMutation.isPending} data-testid="button-save-profile">
                {updateProfileMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </div>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
            <CardDescription>Your contact details and account status.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <Avatar className="h-24 w-24 border-2 border-white shadow-lg">
                <AvatarFallback className="bg-blue-100 text-blue-600 text-2xl font-semibold">
                  {getInitials(isEditing ? formData.displayName : client?.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-gray-900" data-testid="text-display-name">
                  {isEditing ? formData.displayName : (client?.displayName || 'Unknown Client')}
                </h3>
                <div className="flex items-center gap-2">
                  {getStatusBadge(client?.status)}
                  <span className="text-sm text-gray-500 font-mono" data-testid="text-client-id">
                    {client?.clientId}
                  </span>
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-gray-500 text-sm">Full Name *</Label>
                {isEditing ? (
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <Input
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder="Enter your name"
                      data-testid="input-name"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <User className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900" data-testid="text-name">
                      {client?.displayName || 'Not set'}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-gray-500 text-sm">Email Address *</Label>
                {isEditing ? (
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter your email"
                      data-testid="input-email"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <Mail className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900" data-testid="text-email">
                      {client?.email || 'Not set'}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-gray-500 text-sm">Phone Number</Label>
                {isEditing ? (
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <Input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Enter your phone"
                      data-testid="input-phone"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <Phone className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900" data-testid="text-phone">
                      {client?.phone || 'Not set'}
                    </span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-gray-500 text-sm">Address</Label>
                {isEditing ? (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Enter your address"
                      data-testid="input-address"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900" data-testid="text-address">
                      {client?.address || 'Not set'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notifications
            </CardTitle>
            <CardDescription>Manage your notification preferences.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Email Notifications</Label>
                <p className="text-sm text-gray-500">
                  Receive email updates about invoices, payments, and important notices.
                </p>
              </div>
              <Switch
                checked={formData.notificationsEnabled}
                onCheckedChange={(checked) => {
                  setFormData({ ...formData, notificationsEnabled: checked });
                  if (!isEditing) {
                    updateProfileMutation.mutate({ ...formData, notificationsEnabled: checked });
                  }
                }}
                disabled={isImpersonating}
                data-testid="switch-notifications"
              />
            </div>
          </CardContent>
        </Card>

        {activeLease && (
          <Card className="border-gray-200 shadow-sm">
            <CardHeader>
              <CardTitle>Active Lease</CardTitle>
              <CardDescription>Your current lease agreement details.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-gray-500 text-sm">Lease ID</Label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <Hash className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900 font-mono" data-testid="text-lease-id">
                      {activeLease.leaseId}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500 text-sm">Description</Label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <Building className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900" data-testid="text-lease-description">
                      {activeLease.description || 'Standard Lease'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500 text-sm">Start Date</Label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {activeLease.startDate ? formatDate(activeLease.startDate) : 'Not set'}
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-500 text-sm">End Date</Label>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <Calendar className="h-4 w-4 text-gray-400" />
                    <span className="font-medium text-gray-900">
                      {activeLease.endDate ? formatDate(activeLease.endDate) : 'Not set'}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle>Security</CardTitle>
            <CardDescription>Manage your account security settings.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Password</Label>
                <p className="text-sm text-gray-500">
                  Reset your password through your Replit account settings.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.open('https://replit.com/account', '_blank')}
                data-testid="button-reset-password"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Account Settings
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200 shadow-sm" data-testid="card-privacy-data-handling">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Privacy & Data Handling
            </CardTitle>
            <CardDescription>How we handle your information.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 text-sm text-gray-600">
              <p className="font-medium text-gray-800">What we store:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Basic profile info (name, email, phone, address)</li>
                <li>Documents uploaded to your account</li>
                <li>Payment history entries</li>
              </ul>
            </div>

            <Separator />

            <div className="space-y-3 text-sm text-gray-600">
              <p className="font-medium text-gray-800">Payments:</p>
              <p>
                External payments (Cash App, Venmo, bank transfers) are tracked for record-keeping but are not processed through this portal.
              </p>
            </div>

            <Separator />

            <div className="space-y-3 text-sm text-gray-600">
              <p className="font-medium text-gray-800">Access:</p>
              <p>
                You can only see your own account data. Admins may access your account for support and billing purposes.
              </p>
            </div>

            <Separator />

            <div className="space-y-3 text-sm text-gray-600">
              <p className="font-medium text-gray-800">Emails:</p>
              <p>
                Email notifications are optional and can be disabled using the toggle above.
              </p>
            </div>

            <Separator />

            <div className="space-y-3 text-sm text-gray-600">
              <p className="font-medium text-gray-800">Questions?</p>
              <p>
                Contact us at <span className="font-medium text-gray-800">hello@quickitprojects.com</span>
              </p>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-400 text-center">
                This portal is provided as-is during current implementation phase. Version v1.0.0
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
