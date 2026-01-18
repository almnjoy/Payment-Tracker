import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Phone, Building, MapPin, Loader2, Eye, ArrowLeft, Calendar, Hash } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useClientDashboard, formatDate } from "@/lib/api";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";

export default function ClientProfile() {
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const asClientId = searchParams.get("asClientId") || undefined;
  const isImpersonating = !!asClientId;
  
  const { user } = useAuth();
  const { data: dashboardData, isLoading } = useClientDashboard(asClientId);

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
    <Layout role="client">
      <div className="max-w-3xl mx-auto space-y-6">
        {isImpersonating && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between" data-testid="impersonation-banner">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Admin Preview Mode</p>
                <p className="text-sm text-amber-700">Viewing profile for <strong>{client?.displayName || 'Client'}</strong></p>
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

        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Profile</h2>
          <p className="text-gray-500">Your account information and details.</p>
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
                  {getInitials(client?.displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-gray-900" data-testid="text-display-name">
                  {client?.displayName || 'Unknown Client'}
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
                <Label className="text-gray-500 text-sm">Full Name</Label>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <User className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900" data-testid="text-name">
                    {client?.displayName || 'Not set'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-500 text-sm">Email Address</Label>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <Mail className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900" data-testid="text-email">
                    {client?.email || 'Not set'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-500 text-sm">Phone Number</Label>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <Phone className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900" data-testid="text-phone">
                    {client?.phone || 'Not set'}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-500 text-sm">Address</Label>
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <MapPin className="h-4 w-4 text-gray-400" />
                  <span className="font-medium text-gray-900" data-testid="text-address">
                    {client?.address || 'Not set'}
                  </span>
                </div>
              </div>
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

        <Card className="border-gray-200 shadow-sm bg-blue-50/30">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Mail className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-gray-900">Need to update your information?</h4>
                <p className="text-sm text-gray-500 mt-1">
                  Contact your administrator to update your profile details, email, or phone number.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
