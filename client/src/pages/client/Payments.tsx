import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Download, CheckCircle, Clock, Loader2, Eye, ArrowLeft, DollarSign, ExternalLink, CreditCard, Building2, MoreHorizontal, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useClientPayments, useClientInvoices, useClientDashboard, formatCents, formatDate } from "@/lib/api";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface PaymentSettings {
  cashAppHandle: string | null;
  cashAppLink: string | null;
  venmoHandle: string | null;
  venmoLink: string | null;
  bankInstructions: string | null;
  stripePlaceholderMessage: string | null;
}

export default function ClientPayments() {
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const asClientId = searchParams.get("asClientId") || undefined;
  const isImpersonating = !!asClientId;
  const paymentSuccess = searchParams.get("success") === "1";
  const paymentCanceled = searchParams.get("canceled") === "1";
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: payments, isLoading: paymentsLoading, error: paymentsError } = useClientPayments(asClientId);
  const { data: invoices, isLoading: invoicesLoading, error: invoicesError } = useClientInvoices(asClientId);
  const { data: dashboardData, refetch: refetchDashboard, error: dashboardError } = useClientDashboard(asClientId);

  const { data: paymentSettings } = useQuery<PaymentSettings>({
    queryKey: ["client", "payment-settings"],
    queryFn: async () => {
      const response = await fetch("/api/client/payment-settings", { credentials: "include" });
      if (!response.ok) throw new Error("Failed to fetch payment settings");
      return response.json();
    },
  });

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNote, setPaymentNote] = useState("");
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  const [showSuccessBanner, setShowSuccessBanner] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  // 2-step flow for external methods (cashapp, venmo, bank): "details" -> "confirmation"
  const [externalPaymentStep, setExternalPaymentStep] = useState<"details" | "confirmation" | null>(null);

  const sessionId = searchParams.get("session_id");

  // Handle Stripe return success/canceled
  useEffect(() => {
    const confirmStripePayment = async () => {
      if (paymentSuccess && sessionId && !confirmingPayment) {
        setConfirmingPayment(true);
        try {
          const response = await fetch("/api/stripe/confirm-checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ sessionId }),
          });
          
          if (!response.ok) {
            const error = await response.json();
            console.error("Stripe confirm error:", error);
            toast({ 
              title: "Payment Confirmation Failed", 
              description: error.message || "Could not confirm payment. Please contact support.",
              variant: "destructive"
            });
          } else {
            const result = await response.json();
            console.log("Stripe payment confirmed:", result);
            setShowSuccessBanner(true);
            // Refresh payment data
            queryClient.invalidateQueries({ queryKey: ["client-payments"] });
            queryClient.invalidateQueries({ queryKey: ["client-dashboard"] });
            refetchDashboard();
          }
        } catch (error) {
          console.error("Failed to confirm Stripe payment:", error);
          toast({ 
            title: "Error", 
            description: "Could not confirm payment. Please contact support.",
            variant: "destructive"
          });
        } finally {
          setConfirmingPayment(false);
          // Clear URL params via history.replaceState so refresh doesn't re-run
          const basePath = asClientId ? `/client/payments?asClientId=${asClientId}` : "/client/payments";
          window.history.replaceState({}, "", basePath);
        }
      } else if (paymentSuccess && !sessionId) {
        // Fallback for success without session_id (shouldn't happen with new flow)
        setShowSuccessBanner(true);
        window.history.replaceState({}, "", window.location.pathname);
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["client-payments"] });
          queryClient.invalidateQueries({ queryKey: ["client-dashboard"] });
          refetchDashboard();
        }, 2000);
      }
    };
    
    confirmStripePayment();
    
    if (paymentCanceled) {
      toast({ 
        title: "Payment Canceled", 
        description: "You can try again when you're ready.",
        variant: "default"
      });
      const basePath = asClientId ? `/client/payments?asClientId=${asClientId}` : "/client/payments";
      window.history.replaceState({}, "", basePath);
    }
  }, [paymentSuccess, paymentCanceled, sessionId, queryClient, refetchDashboard, toast, asClientId]);

  const submitPaymentMutation = useMutation({
    mutationFn: async (data: { amountCents: number; method: string; note: string }) => {
      const response = await fetch("/api/client/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to submit payment");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-payments"] });
      queryClient.invalidateQueries({ queryKey: ["client-dashboard"] });
      
      // For external methods (cashapp/venmo/bank), transition to confirmation step
      if (selectedMethod && ["cashapp", "venmo", "bank"].includes(selectedMethod)) {
        setExternalPaymentStep("confirmation");
        return;
      }
      
      // For "other" method, close dialog and show toast
      toast({ 
        title: "Payment Submitted", 
        description: "Your payment has been logged and is pending verification." 
      });
      setPaymentDialogOpen(false);
      setSelectedMethod(null);
      setPaymentAmount("");
      setPaymentNote("");
      setExternalPaymentStep(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const stripeCheckoutMutation = useMutation({
    mutationFn: async (data: { amountCents: number; note?: string }) => {
      const response = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Failed to create checkout session");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmitPayment = () => {
    if (!selectedMethod) {
      toast({ title: "Error", description: "Please select a payment method", variant: "destructive" });
      return;
    }
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    const amountCents = Math.round(amount * 100);
    submitPaymentMutation.mutate({
      amountCents,
      method: selectedMethod,
      note: paymentNote,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "confirmed":
      case "paid":
      case "completed":
        return <Badge className="bg-green-50 text-green-700 border-green-200">Confirmed</Badge>;
      case "pending":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
      case "posted":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Posted</Badge>;
      case "rejected":
        return <Badge className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const isLoading = paymentsLoading || invoicesLoading;
  const openInvoices = invoices?.filter(inv => ['open', 'sent', 'overdue'].includes(inv.status)) || [];

  const paymentMethods = [
    {
      id: "cashapp",
      name: "Cash App",
      icon: "$",
      color: "bg-green-500",
      bgColor: "bg-green-50 hover:bg-green-100 border-green-200",
      available: !!paymentSettings?.cashAppHandle,
      handle: paymentSettings?.cashAppHandle,
      link: paymentSettings?.cashAppLink,
    },
    {
      id: "venmo",
      name: "Venmo",
      icon: "V",
      color: "bg-blue-500",
      bgColor: "bg-blue-50 hover:bg-blue-100 border-blue-200",
      available: !!paymentSettings?.venmoHandle,
      handle: paymentSettings?.venmoHandle,
      link: paymentSettings?.venmoLink,
    },
    {
      id: "bank",
      name: "Bank Transfer",
      icon: <Building2 className="h-5 w-5" />,
      color: "bg-gray-600",
      bgColor: "bg-gray-50 hover:bg-gray-100 border-gray-200",
      available: !!paymentSettings?.bankInstructions,
      instructions: paymentSettings?.bankInstructions,
    },
    {
      id: "stripe",
      name: "Card Payment",
      icon: <CreditCard className="h-5 w-5" />,
      color: "bg-[#635BFF]",
      bgColor: "bg-purple-50 hover:bg-purple-100 border-purple-200",
      available: true,
    },
    {
      id: "other",
      name: "Other",
      icon: <MoreHorizontal className="h-5 w-5" />,
      color: "bg-gray-500",
      bgColor: "bg-gray-50 hover:bg-gray-100 border-gray-200",
      available: true,
    },
  ];

  const selectedMethodData = paymentMethods.find(m => m.id === selectedMethod);

  // Show loader while confirming Stripe payment
  if (confirmingPayment) {
    return (
      <Layout role="client" clientName={dashboardData?.client?.displayName}>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-[#635BFF]" />
          <p className="text-gray-600 font-medium">Confirming your payment...</p>
          <p className="text-sm text-gray-500">Please wait while we verify your payment with Stripe.</p>
        </div>
      </Layout>
    );
  }

  // Show error message if API fails
  const hasError = paymentsError || invoicesError || dashboardError;
  if (!isLoading && hasError) {
    const errorMsg = (paymentsError as Error)?.message || (invoicesError as Error)?.message || (dashboardError as Error)?.message || "Unknown error";
    console.error("Failed to load payments page data:", errorMsg);
    return (
      <Layout role="client" clientName={dashboardData?.client?.displayName}>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <p className="text-gray-900 font-medium">Unable to load payment data</p>
          <p className="text-sm text-gray-500">Please try refreshing the page or contact support if the problem persists.</p>
          <Button onClick={() => window.location.reload()} variant="outline">
            Refresh Page
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout role="client" clientName={dashboardData?.client?.displayName}>
      <div className="space-y-6">
        {showSuccessBanner && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-3"
            data-testid="payment-success-banner"
          >
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div className="flex-1">
              <p className="font-medium text-green-900">Payment Successful!</p>
              <p className="text-sm text-green-700">Your payment is being processed. It will appear in your history shortly.</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSuccessBanner(false)}
              className="text-green-700 hover:text-green-900"
            >
              Dismiss
            </Button>
          </motion.div>
        )}

        {isImpersonating && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between" data-testid="impersonation-banner">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Admin Preview Mode</p>
                <p className="text-sm text-amber-700">You are viewing this portal as <strong>{dashboardData?.client?.displayName || 'Client'}</strong></p>
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
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Payments</h2>
            <p className="text-gray-500">View your payment history and submit new payments.</p>
          </div>
          {!isImpersonating && (
            <Button 
              className="btn-primary-orange" 
              onClick={() => setPaymentDialogOpen(true)}
              data-testid="button-make-payment"
            >
              <DollarSign className="h-4 w-4 mr-2" />
              Make a Payment
            </Button>
          )}
        </div>

        <Dialog open={paymentDialogOpen} onOpenChange={(open) => {
          setPaymentDialogOpen(open);
          if (!open) {
            setSelectedMethod(null);
            setPaymentAmount("");
            setPaymentNote("");
            setUseCustomAmount(false);
            setExternalPaymentStep(null);
          }
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Make a Payment</DialogTitle>
              <DialogDescription>
                {!selectedMethod 
                  ? "Select a payment method to continue"
                  : externalPaymentStep === "confirmation"
                    ? "Complete your payment using the details below"
                    : "Complete your payment details"
                }
              </DialogDescription>
            </DialogHeader>

            {!selectedMethod ? (
              <div className="grid grid-cols-2 gap-3 py-4">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    disabled={!method.available}
                    onClick={() => {
                      if (!method.available) return;
                      setSelectedMethod(method.id);
                      // For external methods, start the 2-step flow and pre-fill amount
                      if (["cashapp", "venmo", "bank"].includes(method.id)) {
                        setExternalPaymentStep("details");
                        // Pre-fill with outstanding balance
                        const outstandingBalance = dashboardData?.amountDueCents || 0;
                        if (outstandingBalance > 0) {
                          setPaymentAmount((outstandingBalance / 100).toFixed(2));
                        }
                      }
                    }}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      method.available 
                        ? `${method.bgColor} cursor-pointer` 
                        : "bg-gray-100 border-gray-200 opacity-50 cursor-not-allowed"
                    }`}
                    data-testid={`method-${method.id}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 ${method.color} rounded-lg flex items-center justify-center text-white font-bold`}>
                        {typeof method.icon === "string" ? method.icon : method.icon}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{method.name}</p>
                        {!method.available && (
                          <p className="text-xs text-gray-500">{(method as any).message || "Not configured"}</p>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-4 py-4">
                {/* Back button - only show on details step or for non-external methods */}
                {(externalPaymentStep !== "confirmation") && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => {
                      setSelectedMethod(null);
                      setExternalPaymentStep(null);
                    }}
                    className="mb-2"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" /> Change Method
                  </Button>
                )}

                {/* 2-Step Flow for External Methods (Cash App, Venmo, Bank) */}
                {["cashapp", "venmo", "bank"].includes(selectedMethod!) && externalPaymentStep === "details" && (
                  <>
                    {/* Method header */}
                    <div className={`p-4 rounded-lg border ${selectedMethodData?.bgColor}`}>
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 ${selectedMethodData?.color} rounded-lg flex items-center justify-center text-white font-bold`}>
                          {typeof selectedMethodData?.icon === "string" ? selectedMethodData.icon : selectedMethodData?.icon}
                        </div>
                        <h4 className="font-semibold text-gray-900">{selectedMethodData?.name}</h4>
                      </div>
                    </div>

                    {/* Payment Details Form */}
                    <div className="grid gap-4">
                      <div>
                        <Label htmlFor="amount">Payment Amount ($)</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            className="pl-9"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            data-testid="input-payment-amount"
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          Outstanding balance: {formatCents(dashboardData?.amountDueCents || 0)}
                        </p>
                      </div>

                      <div>
                        <Label htmlFor="note">Note (optional)</Label>
                        <Textarea
                          id="note"
                          placeholder="Add any details about this payment..."
                          value={paymentNote}
                          onChange={(e) => setPaymentNote(e.target.value)}
                          data-testid="input-payment-note"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Confirmation Step for External Methods */}
                {["cashapp", "venmo", "bank"].includes(selectedMethod!) && externalPaymentStep === "confirmation" && (
                  <>
                    {/* Success message */}
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="h-5 w-5 text-green-600" />
                        <h4 className="font-semibold text-green-900">Payment Submitted</h4>
                      </div>
                      <p className="text-sm text-green-700">
                        Your payment of <span className="font-bold">{formatCents(Math.round(parseFloat(paymentAmount || "0") * 100))}</span> has been recorded and is pending verification.
                      </p>
                    </div>

                    {/* Payment instructions */}
                    <div className={`p-4 rounded-lg border ${selectedMethodData?.bgColor}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`h-10 w-10 ${selectedMethodData?.color} rounded-lg flex items-center justify-center text-white font-bold`}>
                          {typeof selectedMethodData?.icon === "string" ? selectedMethodData.icon : selectedMethodData?.icon}
                        </div>
                        <h4 className="font-semibold text-gray-900">Complete Your Payment</h4>
                      </div>

                      {selectedMethod === "cashapp" && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">
                            Send <span className="font-bold">{formatCents(Math.round(parseFloat(paymentAmount || "0") * 100))}</span> to: <span className="font-bold text-green-700">{selectedMethodData?.handle}</span>
                          </p>
                          {(selectedMethodData as any)?.link && (
                            <a 
                              href={(selectedMethodData as any).link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-green-600 hover:underline font-medium"
                            >
                              <ExternalLink className="h-4 w-4" /> Open Cash App
                            </a>
                          )}
                        </div>
                      )}

                      {selectedMethod === "venmo" && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600">
                            Send <span className="font-bold">{formatCents(Math.round(parseFloat(paymentAmount || "0") * 100))}</span> to: <span className="font-bold text-blue-700">{selectedMethodData?.handle}</span>
                          </p>
                          {(selectedMethodData as any)?.link && (
                            <a 
                              href={(selectedMethodData as any).link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline font-medium"
                            >
                              <ExternalLink className="h-4 w-4" /> Open Venmo
                            </a>
                          )}
                        </div>
                      )}

                      {selectedMethod === "bank" && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600 mb-2">
                            Transfer <span className="font-bold">{formatCents(Math.round(parseFloat(paymentAmount || "0") * 100))}</span> using the bank details below:
                          </p>
                          <div className="text-sm text-gray-600 whitespace-pre-wrap bg-white/50 p-3 rounded border">
                            {(selectedMethodData as any)?.instructions}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Original flow for "other" method */}
                {selectedMethod === "other" && (
                  <>
                    <div className={`p-4 rounded-lg border ${selectedMethodData?.bgColor}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`h-10 w-10 ${selectedMethodData?.color} rounded-lg flex items-center justify-center text-white font-bold`}>
                          {typeof selectedMethodData?.icon === "string" ? selectedMethodData.icon : selectedMethodData?.icon}
                        </div>
                        <h4 className="font-semibold text-gray-900">{selectedMethodData?.name}</h4>
                      </div>
                      <p className="text-sm text-gray-600">
                        Record a payment made via check, cash, or other method.
                      </p>
                    </div>

                    <div className="grid gap-4">
                      <div>
                        <Label htmlFor="amount">Payment Amount ($)</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                          <Input
                            id="amount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            className="pl-9"
                            value={paymentAmount}
                            onChange={(e) => setPaymentAmount(e.target.value)}
                            data-testid="input-payment-amount"
                          />
                        </div>
                      </div>

                      <div>
                        <Label htmlFor="note">Note (optional)</Label>
                        <Textarea
                          id="note"
                          placeholder="Add any details about this payment..."
                          value={paymentNote}
                          onChange={(e) => setPaymentNote(e.target.value)}
                          data-testid="input-payment-note"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Stripe flow (unchanged) */}
                {selectedMethod === "stripe" && (
                  <>
                    <div className={`p-4 rounded-lg border ${selectedMethodData?.bgColor}`}>
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`h-10 w-10 ${selectedMethodData?.color} rounded-lg flex items-center justify-center text-white font-bold`}>
                          {typeof selectedMethodData?.icon === "string" ? selectedMethodData.icon : selectedMethodData?.icon}
                        </div>
                        <h4 className="font-semibold text-gray-900">{selectedMethodData?.name}</h4>
                      </div>
                      <div className="space-y-3">
                        <p className="text-sm text-gray-600">
                          Pay securely with your credit or debit card via Stripe.
                        </p>
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                          <p className="text-sm font-medium text-purple-900">
                            Amount Due: <span className="text-lg">{formatCents(dashboardData?.amountDueCents || 0)}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="customAmount" className="flex-1">Pay custom amount</Label>
                        <Switch
                          id="customAmount"
                          checked={useCustomAmount}
                          onCheckedChange={(checked) => {
                            setUseCustomAmount(checked);
                            if (!checked) {
                              setPaymentAmount("");
                            }
                          }}
                          data-testid="switch-custom-amount"
                        />
                      </div>

                      {useCustomAmount && (
                        <div>
                          <Label htmlFor="stripeAmount">Custom Amount ($)</Label>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <Input
                              id="stripeAmount"
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="0.00"
                              className="pl-9"
                              value={paymentAmount}
                              onChange={(e) => setPaymentAmount(e.target.value)}
                              data-testid="input-stripe-amount"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <Label htmlFor="stripeNote">Note (optional)</Label>
                        <Textarea
                          id="stripeNote"
                          placeholder="Add any details about this payment..."
                          value={paymentNote}
                          onChange={(e) => setPaymentNote(e.target.value)}
                          rows={2}
                          data-testid="input-stripe-note"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <DialogFooter>
              {/* Cancel/Close button */}
              {externalPaymentStep === "confirmation" ? (
                <Button 
                  variant="outline"
                  onClick={() => {
                    setPaymentDialogOpen(false);
                    setSelectedMethod(null);
                    setPaymentAmount("");
                    setPaymentNote("");
                    setUseCustomAmount(false);
                    setExternalPaymentStep(null);
                  }}
                  className="w-full"
                >
                  Close
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => {
                    setPaymentDialogOpen(false);
                    setSelectedMethod(null);
                    setPaymentAmount("");
                    setPaymentNote("");
                    setUseCustomAmount(false);
                    setExternalPaymentStep(null);
                  }}>
                    Cancel
                  </Button>
                  
                  {/* Confirm Payment for external methods (details step) */}
                  {selectedMethod && ["cashapp", "venmo", "bank"].includes(selectedMethod) && externalPaymentStep === "details" && (
                    <Button 
                      onClick={handleSubmitPayment}
                      disabled={submitPaymentMutation.isPending || !paymentAmount}
                      className="btn-primary-orange"
                      data-testid="button-submit-payment"
                    >
                      {submitPaymentMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Confirm Payment
                    </Button>
                  )}
                  
                  {/* Confirm Payment for "other" method (original flow) */}
                  {selectedMethod === "other" && (
                    <Button 
                      onClick={handleSubmitPayment}
                      disabled={submitPaymentMutation.isPending || !paymentAmount}
                      className="btn-primary-orange"
                      data-testid="button-submit-payment"
                    >
                      {submitPaymentMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <CheckCircle className="h-4 w-4 mr-2" />
                      )}
                      Confirm Payment
                    </Button>
                  )}
                </>
              )}
              
              {/* Stripe checkout button */}
              {selectedMethod === "stripe" && externalPaymentStep !== "confirmation" && (
                <Button 
                  onClick={() => {
                    const amountCents = useCustomAmount 
                      ? Math.round(parseFloat(paymentAmount) * 100) 
                      : (dashboardData?.amountDueCents || 0);
                    
                    if (amountCents <= 0) {
                      toast({ title: "Error", description: "Please enter a valid amount", variant: "destructive" });
                      return;
                    }
                    
                    stripeCheckoutMutation.mutate({
                      amountCents,
                      note: paymentNote || undefined,
                    });
                  }}
                  disabled={stripeCheckoutMutation.isPending || (useCustomAmount && !paymentAmount) || (!useCustomAmount && (dashboardData?.amountDueCents || 0) <= 0)}
                  className="bg-[#635BFF] hover:bg-[#5449d6] text-white"
                  data-testid="button-stripe-checkout"
                >
                  {stripeCheckoutMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="h-4 w-4 mr-2" />
                  )}
                  Continue to Card Payment
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {openInvoices.length > 0 && (
          <Card className="shadow-sm border-orange-200 bg-orange-50">
            <CardHeader>
              <CardTitle className="text-orange-800">Outstanding Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {openInvoices.map((invoice) => (
                  <div 
                    key={invoice.invoiceId}
                    className="flex items-center justify-between p-4 bg-white rounded-lg border border-orange-100"
                    data-testid={`invoice-${invoice.invoiceId}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                        <Clock size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{invoice.title}</p>
                        <p className="text-sm text-gray-500">
                          Due {formatDate(invoice.dueDate)} • ID: {invoice.invoiceId}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-gray-900">{formatCents(invoice.amountCents)}</span>
                      <Badge 
                        variant="outline" 
                        className={invoice.status === 'overdue' 
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-orange-50 text-orange-700 border-orange-200"
                        }
                      >
                        {invoice.status}
                      </Badge>
                      <Button 
                        className="h-8 btn-primary-orange text-xs px-3 py-0" 
                        onClick={() => setPaymentDialogOpen(true)}
                        data-testid={`button-pay-${invoice.invoiceId}`}
                      >
                        Pay Now
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
            <CardDescription>Your past payments and pending confirmations.</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : payments && payments.length > 0 ? (
              <div className="space-y-1">
                {payments.map((payment, index) => (
                  <motion.div 
                    key={payment.paymentId}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-100 last:border-0"
                    data-testid={`payment-${payment.paymentId}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                        payment.status === 'pending' || payment.status === 'posted' 
                          ? 'bg-amber-100 text-amber-600' 
                          : payment.status === 'rejected' 
                            ? 'bg-red-100 text-red-600'
                            : 'bg-green-100 text-green-600'
                      }`}>
                        {payment.status === 'pending' || payment.status === 'posted' ? <Clock size={20} /> : <CheckCircle size={20} />}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          Payment via {payment.method}
                          {payment.notes && <span className="text-gray-500 font-normal"> - {payment.notes}</span>}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(payment.paidAt || payment.createdAt)} • ID: {payment.paymentId}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <span className="font-bold text-gray-900">{formatCents(payment.amountCents)}</span>
                      {getStatusBadge(payment.status)}
                      <Button variant="ghost" size="icon" className="text-gray-400 hover:text-gray-900">
                        <Download size={18} />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No payment history yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
