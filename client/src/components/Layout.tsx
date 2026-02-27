import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  CreditCard, 
  FileText, 
  User, 
  LogOut, 
  Users, 
  FilePlus, 
  Settings, 
  Menu,
  X,
  Bell,
  Wallet,
  TrendingUp,
  PieChart,
  UserCog
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/lib/api";

interface LayoutProps {
  children: React.ReactNode;
  role: "client" | "admin";
  clientName?: string;
}

export function Layout({ children, role, clientName }: LayoutProps) {
  const [location, setLocation] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuth();
  const { data: branding } = useBranding();
  const orgName = branding?.displayName || "Quick IT";
  
  // Check for admin impersonation mode
  const searchParams = new URLSearchParams(window.location.search);
  const asClientId = searchParams.get("asClientId");
  const isImpersonating = !!asClientId;
  
  // Helper to build href with asClientId for client pages
  const buildClientHref = (path: string) => {
    return asClientId ? `${path}?asClientId=${asClientId}` : path;
  };

  // Client Links (No grouping needed for now)
  const clientLinks = [
    { icon: LayoutDashboard, label: "Dashboard", href: buildClientHref("/client/dashboard") },
    { icon: CreditCard, label: "Payments", href: buildClientHref("/client/payments") },
    { icon: FileText, label: "Documents", href: buildClientHref("/client/documents") },
    { icon: User, label: "Profile", href: buildClientHref("/client/profile") },
  ];

  // Admin Links with Grouping
  const adminGroups = [
    {
      label: "Operations",
      items: [
        { icon: LayoutDashboard, label: "Overview", href: "/admin/dashboard" },
        { icon: Users, label: "Clients", href: "/admin/clients" },
        { icon: FileText, label: "Documents", href: "/admin/documents" },
        { icon: FilePlus, label: "Invoice Generator", href: "/admin/invoices" },
      ]
    },
    {
      label: "Finance",
      items: [
        { icon: Wallet, label: "Account Summaries", href: "/admin/accounts" },
        { icon: TrendingUp, label: "Finance Tracker", href: "/admin/finance" },
        { icon: PieChart, label: "Spending Habits", href: "/admin/spending" },
      ]
    },
    {
      label: "System",
      items: [
        { icon: Settings, label: "Settings", href: "/admin/settings" },
        { icon: UserCog, label: "Admin User Management", href: "/admin/user-management" },
      ]
    }
  ];

  const { logout } = useAuth();
  
  const handleLogout = () => {
    logout();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans text-gray-900">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed lg:sticky top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out lg:translate-x-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">{orgName.charAt(0).toUpperCase()}</span>
            </div>
            <span className="font-bold text-lg tracking-tight truncate">{orgName}</span>
          </div>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-500 hover:text-gray-900"
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
          {role === "client" ? (
             // Client Links (Flat List)
             clientLinks.map((link) => {
              const Icon = link.icon;
              const isActive = location === link.href;
              return (
                <Link 
                  key={link.href} 
                  href={link.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1",
                    isActive 
                      ? "bg-primary/10 text-primary" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  )}
                >
                  <Icon size={18} className={isActive ? "text-primary" : "text-gray-500"} />
                  {link.label}
                </Link>
              );
            })
          ) : (
            // Admin Links (Grouped)
            adminGroups.map((group, groupIndex) => (
              <div key={group.label} className={cn("mb-6", groupIndex !== 0 && "pt-2")}>
                {groupIndex !== 0 && <div className="mx-3 border-t border-gray-100 mb-4" />}
                <h3 className="px-3 mb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  {group.label}
                </h3>
                {group.items.map((link) => {
                  const Icon = link.icon;
                  const isActive = location === link.href;
                  return (
                    <Link 
                      key={link.href} 
                      href={link.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-1",
                        isActive 
                          ? "bg-primary/10 text-primary" 
                          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      )}
                    >
                      <Icon size={18} className={isActive ? "text-primary" : "text-gray-500"} />
                      {link.label}
                    </Link>
                  );
                })}
              </div>
            ))
          )}
        </nav>

        <div className="p-4 border-t border-gray-100">
          <div className="flex items-center gap-3 px-3 py-2 mb-2">
            <Avatar className="h-9 w-9 border border-gray-200">
              <AvatarImage src={user?.profileImageUrl || ""} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold">
                {role === "admin" ? "AD" : (user?.firstName?.[0] || "U")}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {role === "admin" ? "Administrator" : (clientName || user?.firstName || "User")}
              </p>
              <p className="text-xs text-gray-500 truncate capitalize">
                {role}
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="h-16 bg-white border-b border-gray-200 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 -ml-2 text-gray-500 hover:bg-gray-100 rounded-md"
            >
              <Menu size={20} />
            </button>
            <h1 className="text-lg font-semibold text-gray-800 capitalize">
              {location.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-gray-500 rounded-full hover:bg-gray-100">
              <Bell size={20} />
            </Button>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </div>
      </main>
    </div>
  );
}
