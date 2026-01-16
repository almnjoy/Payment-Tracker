import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, Plus, Filter, ArrowRight, Loader2 } from "lucide-react";
import { useLocation } from "wouter";
import { useAdminClients, useCreateClient, formatCents, formatDate } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function AdminClients() {
  const { data: clients, isLoading, refetch } = useAdminClients();
  const createClient = useCreateClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newClient, setNewClient] = useState({ displayName: "", email: "", phone: "", address: "" });

  const handleRowClick = (clientId: string) => {
    navigate(`/admin/clients/${clientId}`);
  };

  const handleRowKeyDown = (e: React.KeyboardEvent, clientId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleRowClick(clientId);
    }
  };

  const handleCreateClient = async () => {
    if (!newClient.displayName.trim()) {
      toast({ title: "Error", description: "Client name is required", variant: "destructive" });
      return;
    }
    
    try {
      await createClient.mutateAsync(newClient);
      toast({ title: "Success", description: "Client created successfully" });
      setNewClient({ displayName: "", email: "", phone: "", address: "" });
      setIsDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const filteredClients = clients?.filter(client => 
    client.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Clients</h2>
            <p className="text-gray-500">Manage client accounts and view payment status.</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="btn-primary-orange" data-testid="button-add-client">
                <Plus className="mr-2 h-4 w-4" /> Add New Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
                <DialogDescription>Create a new client record.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Client Name *</Label>
                  <Input 
                    id="displayName" 
                    value={newClient.displayName}
                    onChange={(e) => setNewClient({...newClient, displayName: e.target.value})}
                    placeholder="Enter client name"
                    data-testid="input-client-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input 
                    id="email" 
                    type="email"
                    value={newClient.email}
                    onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                    placeholder="client@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input 
                    id="phone" 
                    value={newClient.phone}
                    onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input 
                    id="address" 
                    value={newClient.address}
                    onChange={(e) => setNewClient({...newClient, address: e.target.value})}
                    placeholder="123 Main St, City, State"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreateClient} disabled={createClient.isPending} data-testid="button-create-client">
                  {createClient.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Create Client
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-gray-200 shadow-sm">
           <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-center border-b border-gray-100">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input 
                  placeholder="Search clients..." 
                  className="pl-9 bg-gray-50"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  data-testid="input-search-clients"
                />
              </div>
              <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" className="h-9">
                   <Filter className="mr-2 h-4 w-4" /> Filter
                 </Button>
              </div>
           </div>
           
           {isLoading ? (
             <div className="flex justify-center py-12">
               <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
             </div>
           ) : filteredClients.length > 0 ? (
             <Table>
               <TableHeader className="bg-gray-50">
                 <TableRow>
                   <TableHead>Client Name</TableHead>
                   <TableHead>Email</TableHead>
                   <TableHead>Status</TableHead>
                   <TableHead className="text-right">Amount Owed</TableHead>
                   <TableHead className="text-right">Last Paid</TableHead>
                   <TableHead className="w-[50px]"></TableHead>
                 </TableRow>
               </TableHeader>
               <TableBody>
                 {filteredClients.map((client) => (
                   <TableRow 
                     key={client.clientId} 
                     className="cursor-pointer hover:bg-blue-50 active:bg-blue-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2" 
                     data-testid={`row-client-${client.clientId}`}
                     onClick={() => handleRowClick(client.clientId)}
                     onKeyDown={(e) => handleRowKeyDown(e, client.clientId)}
                     tabIndex={0}
                     role="button"
                     aria-label={`View details for ${client.displayName}`}
                   >
                     <TableCell className="font-medium text-gray-900">{client.displayName}</TableCell>
                     <TableCell className="text-gray-500">{client.email || '-'}</TableCell>
                     <TableCell>
                        <Badge 
                          variant="outline" 
                          className={
                            client.status === 'behind' ? 'bg-red-50 text-red-700 border-red-200'
                            : client.status === 'paused' ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                            : client.status === 'inactive' ? 'bg-gray-50 text-gray-700 border-gray-200'
                            : 'bg-green-50 text-green-700 border-green-200'
                          }
                        >
                          {client.status || 'active'}
                        </Badge>
                     </TableCell>
                     <TableCell className="text-right font-medium">
                       {formatCents(client.amountOwedCents || 0)}
                     </TableCell>
                     <TableCell className="text-right text-gray-500">
                       {formatDate(client.lastPaymentAt)}
                     </TableCell>
                     <TableCell>
                        <ArrowRight size={16} className="text-gray-400" />
                     </TableCell>
                   </TableRow>
                 ))}
               </TableBody>
             </Table>
           ) : (
             <div className="text-center py-12 text-gray-500">
               {searchQuery ? "No clients match your search" : "No clients yet. Add your first client to get started."}
             </div>
           )}
        </Card>
      </div>
    </Layout>
  );
}
