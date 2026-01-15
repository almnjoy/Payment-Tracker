import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MOCK_CLIENTS } from "@/lib/mockData";
import { FilePlus, Send, Eye } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function AdminInvoiceGenerator() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Invoice Generated",
        description: "Invoice #INV-2026-001 has been created and sent to the client.",
      });
    }, 1500);
  };

  return (
    <Layout role="admin">
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Invoice Generator</h2>
          <p className="text-gray-500">Create and send new invoices to clients.</p>
        </div>

        <Card className="border-gray-200 shadow-lg">
          <CardHeader className="bg-gray-50/50 border-b border-gray-100">
             <div className="flex items-center gap-3">
                <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                   <FilePlus size={20} />
                </div>
                <div>
                   <CardTitle>New Invoice Details</CardTitle>
                   <CardDescription>Fill in the details below to generate.</CardDescription>
                </div>
             </div>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleGenerate} className="space-y-6">
               <div className="space-y-2">
                  <Label htmlFor="client">Client</Label>
                  <Select>
                    <SelectTrigger className="h-11 bg-white">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {MOCK_CLIENTS.map(client => (
                        <SelectItem key={client.id} value={client.id.toString()}>
                          {client.name} ({client.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
               </div>
               
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <Label htmlFor="amount">Amount ($)</Label>
                     <Input id="amount" type="number" placeholder="0.00" className="h-11" required />
                  </div>
                  <div className="space-y-2">
                     <Label htmlFor="date">Due Date</Label>
                     <Input id="date" type="date" className="h-11" required />
                  </div>
               </div>

               <div className="space-y-2">
                  <Label htmlFor="desc">Description / Memo</Label>
                  <Input id="desc" placeholder="e.g. Monthly Rent - January 2026" className="h-11" />
               </div>

               <div className="space-y-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-medium text-gray-500">Subtotal</span>
                     <span className="text-sm font-medium text-gray-900">$0.00</span>
                  </div>
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-medium text-gray-500">Tax (0%)</span>
                     <span className="text-sm font-medium text-gray-900">$0.00</span>
                  </div>
                  <div className="flex items-center justify-between text-lg font-bold">
                     <span className="text-gray-900">Total</span>
                     <span className="text-primary">$0.00</span>
                  </div>
               </div>

               <div className="flex gap-3 pt-4">
                  <Button type="button" variant="outline" className="flex-1 h-11">
                     <Eye className="mr-2 h-4 w-4" /> Preview
                  </Button>
                  <Button type="submit" className="flex-[2] btn-primary-orange h-11" disabled={isLoading}>
                     {isLoading ? "Generating..." : (
                        <>
                           <Send className="mr-2 h-4 w-4" /> Generate & Send
                        </>
                     )}
                  </Button>
               </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
