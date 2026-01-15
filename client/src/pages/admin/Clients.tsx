import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { MOCK_CLIENTS } from "@/lib/mockData";
import { Search, Plus, Filter, MoreHorizontal, ArrowRight } from "lucide-react";
import { Link } from "wouter";

export default function AdminClients() {
  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Clients</h2>
            <p className="text-gray-500">Manage client accounts and view payment status.</p>
          </div>
          <Button className="btn-primary-orange">
            <Plus className="mr-2 h-4 w-4" /> Add New Client
          </Button>
        </div>

        <Card className="border-gray-200 shadow-sm">
           <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-center border-b border-gray-100">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <Input placeholder="Search clients..." className="pl-9 bg-gray-50" />
              </div>
              <div className="flex items-center gap-2">
                 <Button variant="outline" size="sm" className="h-9">
                   <Filter className="mr-2 h-4 w-4" /> Filter
                 </Button>
                 <Button variant="outline" size="sm" className="h-9">
                   Export
                 </Button>
              </div>
           </div>
           
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
               {MOCK_CLIENTS.map((client) => (
                 <TableRow key={client.id} className="cursor-pointer hover:bg-gray-50">
                   <TableCell className="font-medium text-gray-900">{client.name}</TableCell>
                   <TableCell className="text-gray-500">{client.email}</TableCell>
                   <TableCell>
                      <Badge 
                        variant="outline" 
                        className={
                          client.status === 'active' 
                            ? 'bg-green-50 text-green-700 border-green-200' 
                            : client.status === 'overdue'
                            ? 'bg-red-50 text-red-700 border-red-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }
                      >
                        {client.status}
                      </Badge>
                   </TableCell>
                   <TableCell className="text-right font-medium">
                     ${client.amountOwed.toFixed(2)}
                   </TableCell>
                   <TableCell className="text-right text-gray-500">
                     {new Date(client.lastPaid).toLocaleDateString()}
                   </TableCell>
                   <TableCell>
                      <Link href={`/admin/clients/${client.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-primary">
                           <ArrowRight size={16} />
                        </Button>
                      </Link>
                   </TableCell>
                 </TableRow>
               ))}
             </TableBody>
           </Table>
        </Card>
      </div>
    </Layout>
  );
}
