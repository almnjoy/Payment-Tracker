import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, CheckCircle, XCircle, Loader2, Key, User, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useVerifyInvite, useClaimInvite, useBootstrapAdmin, usePublicBranding } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

export default function RegisterPage() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { data: branding } = usePublicBranding();
  const orgName = branding?.displayName || "Quick IT Projects";
  const [signupTab, setSignupTab] = useState<"client-id" | "invite">("client-id");
  
  const [clientId, setClientId] = useState("");
  const [email, setEmail] = useState("");
  const [clientVerifyResult, setClientVerifyResult] = useState<{ valid: boolean; clientDisplayName?: string; reason?: string } | null>(null);
  
  const [magicNumber, setMagicNumber] = useState("");
  const [adminSecret, setAdminSecret] = useState("");
  const [showAdminSetup, setShowAdminSetup] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; clientDisplayName?: string; reason?: string } | null>(null);
  
  const verifyMutation = useVerifyInvite();
  const claimMutation = useClaimInvite();
  const bootstrapMutation = useBootstrapAdmin();
  const { toast } = useToast();

  const verifyClientIdMutation = useMutation({
    mutationFn: async ({ clientId, email }: { clientId: string; email: string }) => {
      const res = await apiRequest("POST", "/api/client-signup/verify", { clientId, email });
      return res.json();
    },
  });

  const claimClientIdMutation = useMutation({
    mutationFn: async ({ clientId, email }: { clientId: string; email: string }) => {
      const res = await apiRequest("POST", "/api/client-signup/claim", { clientId, email });
      return res.json();
    },
  });

  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      fetch("/api/me", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          if (data.effectiveRole === "admin" || data.profile?.role === "admin") {
            navigate("/admin/dashboard");
          } else if (data.profile?.role === "client") {
            navigate("/client/dashboard");
          }
        });
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  const handleVerifyClientId = async () => {
    if (!clientId.trim() || !email.trim()) return;
    
    const result = await verifyClientIdMutation.mutateAsync({ 
      clientId: clientId.trim().toUpperCase(), 
      email: email.trim().toLowerCase() 
    });
    setClientVerifyResult(result);
  };

  const handleClaimClientId = async () => {
    if (!isAuthenticated) {
      window.location.href = "/api/login";
      return;
    }
    
    try {
      const result = await claimClientIdMutation.mutateAsync({ 
        clientId: clientId.trim().toUpperCase(), 
        email: email.trim().toLowerCase() 
      });
      if (result.success && result.redirectTo) {
        toast({ title: "Success!", description: "Your account has been linked." });
        navigate(result.redirectTo);
      } else {
        toast({ title: "Error", description: result.message || "Failed to link account", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleVerify = async () => {
    if (!magicNumber.trim()) return;
    
    const result = await verifyMutation.mutateAsync({ magicNumber: magicNumber.trim() });
    setVerifyResult(result);
  };

  const handleClaim = async () => {
    if (!isAuthenticated) {
      window.location.href = "/api/login";
      return;
    }
    
    try {
      const result = await claimMutation.mutateAsync({ magicNumber: magicNumber.trim() });
      if (result.success && result.redirectTo) {
        toast({ title: "Success!", description: "Your account has been linked." });
        navigate(result.redirectTo);
      } else {
        toast({ title: "Error", description: result.message || "Failed to claim invite", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAdminBootstrap = async () => {
    if (!isAuthenticated) {
      window.location.href = "/api/login";
      return;
    }
    
    try {
      await bootstrapMutation.mutateAsync({ secretKey: adminSecret });
      toast({ title: "Success!", description: "Owner account created for initial setup." });
      navigate("/admin/dashboard");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-primary/10 to-white flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-0 shadow-xl">
          <CardHeader>
            <Link href="/">
              <a className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors">
                <ArrowLeft size={16} className="mr-1" /> Back to Login
              </a>
            </Link>
            <CardTitle className="text-2xl font-bold text-gray-900">
              {showAdminSetup ? "Admin Setup" : `Join ${orgName}`}
            </CardTitle>
            <CardDescription>
              {showAdminSetup 
                ? "Enter the bootstrap secret to create the initial organization owner"
                : "Link your account using your Client ID or invite code"}
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            {!showAdminSetup ? (
              <>
                <Tabs value={signupTab} onValueChange={(v) => setSignupTab(v as "client-id" | "invite")}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="client-id" className="flex items-center gap-1">
                      <User className="h-4 w-4" /> Client ID
                    </TabsTrigger>
                    <TabsTrigger value="invite" className="flex items-center gap-1">
                      <Key className="h-4 w-4" /> Invite Code
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="client-id" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="clientId">Your Client ID</Label>
                      <Input 
                        id="clientId" 
                        placeholder="CL-XXXXXX" 
                        value={clientId}
                        onChange={(e) => {
                          setClientId(e.target.value.toUpperCase());
                          setClientVerifyResult(null);
                        }}
                        className="h-11 bg-gray-50 font-mono text-lg tracking-wider"
                        data-testid="input-client-id"
                      />
                      <p className="text-xs text-gray-500">Your Client ID was provided by your administrator</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input 
                          id="email" 
                          type="email"
                          placeholder="your@email.com" 
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            setClientVerifyResult(null);
                          }}
                          className="h-11 bg-gray-50 pl-9"
                          data-testid="input-email"
                        />
                      </div>
                      <p className="text-xs text-gray-500">Must match the email on file with your administrator</p>
                    </div>

                    <Button 
                      onClick={handleVerifyClientId}
                      disabled={verifyClientIdMutation.isPending || !clientId.trim() || !email.trim()}
                      variant="outline"
                      className="w-full h-11"
                      data-testid="button-verify-client"
                    >
                      {verifyClientIdMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Verify My Information
                    </Button>

                    {clientVerifyResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-lg ${clientVerifyResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
                      >
                        <div className="flex items-center gap-2">
                          {clientVerifyResult.valid ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          <span className={`font-medium ${clientVerifyResult.valid ? 'text-green-800' : 'text-red-800'}`}>
                            {clientVerifyResult.valid ? `Welcome, ${clientVerifyResult.clientDisplayName}!` : clientVerifyResult.reason}
                          </span>
                        </div>
                      </motion.div>
                    )}

                    {clientVerifyResult?.valid && (
                      <Button 
                        onClick={handleClaimClientId}
                        disabled={claimClientIdMutation.isPending}
                        className="w-full h-11 bg-primary hover:opacity-90"
                        data-testid="button-claim-client"
                      >
                        {claimClientIdMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        {isAuthenticated ? "Link My Account" : "Sign in to Continue"}
                      </Button>
                    )}
                  </TabsContent>

                  <TabsContent value="invite" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <Label htmlFor="magic">Invite Code (Magic Number)</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="magic" 
                          placeholder="e.g., ABCD-1234" 
                          value={magicNumber}
                          onChange={(e) => {
                            setMagicNumber(e.target.value.toUpperCase());
                            setVerifyResult(null);
                          }}
                          className="h-11 bg-gray-50 font-mono text-lg tracking-wider"
                          data-testid="input-magic-number"
                        />
                        <Button 
                          onClick={handleVerify}
                          disabled={verifyMutation.isPending || !magicNumber.trim()}
                          variant="outline"
                          className="h-11"
                          data-testid="button-verify"
                        >
                          {verifyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                        </Button>
                      </div>
                    </div>

                    {verifyResult && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`p-4 rounded-lg ${verifyResult.valid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
                      >
                        <div className="flex items-center gap-2">
                          {verifyResult.valid ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <XCircle className="h-5 w-5 text-red-600" />
                          )}
                          <span className={`font-medium ${verifyResult.valid ? 'text-green-800' : 'text-red-800'}`}>
                            {verifyResult.valid ? `Valid! Client: ${verifyResult.clientDisplayName}` : verifyResult.reason}
                          </span>
                        </div>
                      </motion.div>
                    )}

                    {verifyResult?.valid && (
                      <Button 
                        onClick={handleClaim}
                        disabled={claimMutation.isPending}
                        className="w-full h-11 bg-primary hover:opacity-90"
                        data-testid="button-claim"
                      >
                        {claimMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        {isAuthenticated ? "Link My Account" : "Sign in to Continue"}
                      </Button>
                    )}
                  </TabsContent>
                </Tabs>

                <div className="pt-4 border-t">
                  <button
                    onClick={() => setShowAdminSetup(true)}
                    className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                    data-testid="button-admin-setup"
                  >
                    <Key className="h-3 w-3" /> Admin setup
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="adminSecret">Admin Bootstrap Secret</Label>
                  <Input 
                    id="adminSecret" 
                    type="password"
                    placeholder="Enter secret key" 
                    value={adminSecret}
                    onChange={(e) => setAdminSecret(e.target.value)}
                    className="h-11 bg-gray-50"
                    data-testid="input-admin-secret"
                  />
                  <p className="text-xs text-gray-500">
                    Default: SETUP_ADMIN_2024 (change via ADMIN_BOOTSTRAP_SECRET env var)
                  </p>
                </div>

                <Button 
                  onClick={handleAdminBootstrap}
                  disabled={bootstrapMutation.isPending || !adminSecret.trim()}
                  className="w-full h-11 bg-orange-600 hover:bg-orange-700"
                  data-testid="button-bootstrap"
                >
                  {bootstrapMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  {isAuthenticated ? "Create Admin Account" : "Sign in First"}
                </Button>

                <button
                  onClick={() => setShowAdminSetup(false)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Back to signup options
                </button>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
