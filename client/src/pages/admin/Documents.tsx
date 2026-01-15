import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MOCK_DOCUMENTS, MOCK_CLIENTS } from "@/lib/mockData";
import { FileText, Upload, Folder, Search, Filter, MoreVertical } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function AdminDocuments() {
  return (
    <Layout role="admin">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">Documents</h2>
            <p className="text-gray-500">Manage all client documents and templates.</p>
          </div>
          <Button className="btn-primary-orange">
            <Upload className="mr-2 h-4 w-4" /> Upload Document
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-4">
           {/* Sidebar Folders */}
           <Card className="md:col-span-1 border-gray-200 h-fit">
              <CardContent className="p-4 space-y-1">
                 <Button variant="ghost" className="w-full justify-start font-medium bg-blue-50 text-blue-700">
                    <Folder className="mr-2 h-4 w-4 fill-blue-200" /> All Files
                 </Button>
                 <Button variant="ghost" className="w-full justify-start text-gray-600">
                    <Folder className="mr-2 h-4 w-4" /> Leases
                 </Button>
                 <Button variant="ghost" className="w-full justify-start text-gray-600">
                    <Folder className="mr-2 h-4 w-4" /> Receipts
                 </Button>
                 <Button variant="ghost" className="w-full justify-start text-gray-600">
                    <Folder className="mr-2 h-4 w-4" /> Notices
                 </Button>
                 <Button variant="ghost" className="w-full justify-start text-gray-600">
                    <Folder className="mr-2 h-4 w-4" /> Templates
                 </Button>
              </CardContent>
           </Card>
           
           {/* File Grid */}
           <div className="md:col-span-3 space-y-4">
              <div className="flex gap-2 mb-4">
                 <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    <Input placeholder="Search documents..." className="pl-9 bg-white" />
                 </div>
                 <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Filter</Button>
              </div>
              
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                 {/* Mock Upload Area */}
                 <div className="border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center p-6 text-gray-400 hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer bg-gray-50/30">
                    <Upload className="h-8 w-8 mb-2" />
                    <span className="text-sm font-medium">Drop files to upload</span>
                 </div>

                 {MOCK_DOCUMENTS.map((doc) => (
                    <Card key={doc.id} className="group hover:shadow-md transition-shadow cursor-pointer">
                       <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                             <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-red-500 mb-3">
                                <FileText size={20} />
                             </div>
                             <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 text-gray-300 group-hover:text-gray-500">
                                <MoreVertical size={14} />
                             </Button>
                          </div>
                          <h3 className="font-medium text-gray-900 truncate" title={doc.name}>{doc.name}</h3>
                          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                             <span>{doc.size}</span>
                             <span>{new Date(doc.date).toLocaleDateString()}</span>
                          </div>
                          <div className="mt-3 text-xs bg-gray-100 inline-block px-2 py-1 rounded text-gray-600">
                             Client: {MOCK_CLIENTS[doc.id % MOCK_CLIENTS.length].name}
                          </div>
                       </CardContent>
                    </Card>
                 ))}
                 
                 {[1, 2, 3].map((i) => (
                    <Card key={`extra-${i}`} className="group hover:shadow-md transition-shadow cursor-pointer">
                       <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                             <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 mb-3">
                                <FileText size={20} />
                             </div>
                             <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2 text-gray-300 group-hover:text-gray-500">
                                <MoreVertical size={14} />
                             </Button>
                          </div>
                          <h3 className="font-medium text-gray-900 truncate">Template_Agreement_v{i}.pdf</h3>
                          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
                             <span>1.2 MB</span>
                             <span>Jan 10, 2026</span>
                          </div>
                          <div className="mt-3 text-xs bg-blue-50 inline-block px-2 py-1 rounded text-blue-700 font-medium">
                             Template
                          </div>
                       </CardContent>
                    </Card>
                 ))}
              </div>
           </div>
        </div>
      </div>
    </Layout>
  );
}
