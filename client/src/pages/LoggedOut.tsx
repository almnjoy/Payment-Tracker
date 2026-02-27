import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { LogIn, CheckCircle } from "lucide-react";
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePublicBranding } from "@/lib/api";

export default function LoggedOut() {
  const queryClient = useQueryClient();
  const { data: branding } = usePublicBranding();
  const orgName = branding?.displayName || "your organization";

  useEffect(() => {
    queryClient.clear();
    localStorage.removeItem("auth-state");
    sessionStorage.clear();
  }, [queryClient]);

  const handleSignIn = () => {
    window.location.href = "/api/login";
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <CardTitle className="text-2xl">Logged Out</CardTitle>
          <CardDescription>
            You have been successfully signed out of your {orgName} account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-500 text-center">
            Your session has been terminated. To access your account again, please sign in.
          </p>
          <Button 
            onClick={handleSignIn} 
            className="w-full"
            data-testid="button-sign-in"
          >
            <LogIn className="h-4 w-4 mr-2" />
            Sign In Again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
