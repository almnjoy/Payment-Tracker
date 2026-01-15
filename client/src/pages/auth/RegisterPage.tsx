import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";

export default function RegisterPage() {
  const [_, setLocation] = useLocation();
  const [magicNumber, setMagicNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Fake creation delay
    setTimeout(() => {
      setIsLoading(false);
      setLocation("/");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 relative overflow-hidden">
          {/* Decorative element */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-bl-full -mr-10 -mt-10" />

          <Link href="/">
            <a className="inline-flex items-center text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors">
              <ArrowLeft size={16} className="mr-1" /> Back to Login
            </a>
          </Link>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
            <p className="text-gray-500 mt-2">Join the Quick IT Project Portal</p>
          </div>

          <form onSubmit={handleRegister} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input 
                id="username" 
                placeholder="Choose a username" 
                className="h-11 bg-gray-50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                placeholder="Create a password" 
                className="h-11 bg-gray-50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="magic">Magic Number</Label>
              <Input 
                id="magic" 
                placeholder="Enter invite code" 
                value={magicNumber}
                onChange={(e) => setMagicNumber(e.target.value)}
                className="h-11 bg-gray-50 border-orange-200 focus:border-orange-500 focus:ring-orange-200"
                required
              />
              <p className="text-xs text-orange-600 font-medium">
                * This is invite-only. Enter your magic number to create your account.
              </p>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 btn-primary-orange text-base mt-2"
              disabled={isLoading}
            >
              {isLoading ? "Creating Account..." : "Create Account"}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
