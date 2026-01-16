import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Building2, ArrowRight, Shield, CreditCard, FileText } from "lucide-react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      fetch("/api/me", { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          if (data.profile?.role === "admin") {
            navigate("/admin/dashboard");
          } else if (data.profile?.role === "client") {
            navigate("/client/dashboard");
          } else {
            navigate("/register");
          }
        })
        .catch(() => navigate("/register"));
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-white flex">
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#007BFF] to-blue-700 p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDUpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-30" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <div className="flex items-center gap-3 text-white">
            <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Building2 className="h-7 w-7 text-white" />
            </div>
            <div>
              <span className="text-2xl font-bold">Quick IT Projects</span>
              <p className="text-sm text-blue-100">Finance Portal</p>
            </div>
          </div>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative z-10"
        >
          <h1 className="text-4xl font-bold text-white leading-tight mb-4">
            Manage your payments and documents in one place
          </h1>
          <p className="text-xl text-blue-100">
            Secure access to invoices, payment history, and important documents.
          </p>
          
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 text-blue-100">
              <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                <CreditCard className="h-5 w-5" />
              </div>
              <span>View and pay invoices online</span>
            </div>
            <div className="flex items-center gap-3 text-blue-100">
              <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <span>Access contracts and receipts</span>
            </div>
            <div className="flex items-center gap-3 text-blue-100">
              <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Shield className="h-5 w-5" />
              </div>
              <span>Secure, encrypted access</span>
            </div>
          </div>
        </motion.div>
        
        <div className="relative z-10 text-sm text-blue-200">
          © {new Date().getFullYear()} Quick IT Projects. All rights reserved.
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md"
        >
          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-4">
              <div className="lg:hidden flex items-center justify-center gap-2 mb-4">
                <div className="h-10 w-10 rounded-xl bg-blue-600 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-white" />
                </div>
                <span className="text-xl font-bold text-gray-900">Quick IT Projects</span>
              </div>
              <CardTitle className="text-2xl font-bold text-gray-900">Welcome back</CardTitle>
              <CardDescription className="text-gray-500">
                Sign in to access your account
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                className="w-full h-12 text-base font-medium bg-[#007BFF] hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                onClick={() => window.location.href = "/api/login"}
                data-testid="button-login"
              >
                Sign in with Replit
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">New client?</span>
                </div>
              </div>
              
              <p className="text-center text-sm text-gray-500">
                If you've received an invite code from Quick IT Projects,{" "}
                <a 
                  href="/register" 
                  className="font-medium text-blue-600 hover:underline"
                  data-testid="link-register"
                >
                  click here to register
                </a>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
