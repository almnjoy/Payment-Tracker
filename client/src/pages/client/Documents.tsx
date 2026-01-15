import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MOCK_DOCUMENTS } from "@/lib/mockData";
import { FileText, Download, Eye, File } from "lucide-react";
import { motion } from "framer-motion";

export default function ClientDocuments() {
  return (
    <Layout role="client">
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Documents</h2>
          <p className="text-gray-500">Access your leases, receipts, and important notices.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {MOCK_DOCUMENTS.map((doc, index) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="hover:shadow-md transition-all group cursor-pointer border-gray-200">
                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex gap-1">
                     <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-900">
                        <Eye size={16} />
                     </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-base mb-1 truncate" title={doc.name}>{doc.name}</CardTitle>
                  <CardDescription className="flex items-center gap-2 text-xs">
                    <span className="capitalize bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{doc.type}</span>
                    <span>•</span>
                    <span>{doc.size}</span>
                    <span>•</span>
                    <span>{new Date(doc.date).toLocaleDateString()}</span>
                  </CardDescription>
                  
                  <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                    <span className="text-xs text-gray-400">PDF Document</span>
                    <Button variant="outline" size="sm" className="h-8 gap-2 group-hover:border-blue-200 group-hover:text-blue-700">
                      <Download size={14} /> Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          
          <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50 flex items-center justify-center min-h-[200px] text-gray-400">
             <div className="text-center">
               <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                 <File className="text-gray-300" />
               </div>
               <p className="text-sm font-medium">No other documents found</p>
             </div>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
