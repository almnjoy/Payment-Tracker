import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Eye, File, Loader2, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useClientDocuments, useClientDashboard, formatDate } from "@/lib/api";
import { useLocation } from "wouter";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "Unknown";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientDocuments() {
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const asClientId = searchParams.get("asClientId") || undefined;
  const isImpersonating = !!asClientId;
  
  const { data: documents, isLoading } = useClientDocuments(asClientId);
  const { data: dashboardData } = useClientDashboard(asClientId);

  const handleDownload = (documentId: string) => {
    const params = asClientId ? `?asClientId=${asClientId}` : '';
    window.open(`/api/client/documents/${documentId}/download${params}`, '_blank');
  };

  return (
    <Layout role="client">
      <div className="space-y-6">
        {isImpersonating && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between" data-testid="impersonation-banner">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium text-amber-900">Admin Preview Mode</p>
                <p className="text-sm text-amber-700">Viewing documents for <strong>{dashboardData?.client?.displayName || 'Client'}</strong></p>
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
        
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900">Documents</h2>
          <p className="text-gray-500">Access your leases, receipts, and important notices.</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : documents && documents.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {documents.map((doc, index) => (
              <motion.div
                key={doc.documentId}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-md transition-all group cursor-pointer border-gray-200" data-testid={`card-document-${doc.documentId}`}>
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
                    <CardTitle className="text-base mb-1 truncate" title={doc.title}>{doc.title}</CardTitle>
                    <CardDescription className="flex items-center gap-2 text-xs">
                      <span className="capitalize bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{doc.docType}</span>
                      <span>•</span>
                      <span>{formatFileSize(doc.fileSizeBytes)}</span>
                      <span>•</span>
                      <span>{formatDate(doc.createdAt)}</span>
                    </CardDescription>
                    
                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                      <span className="text-xs text-gray-400">{doc.contentType || 'Document'}</span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 gap-2 group-hover:border-blue-200 group-hover:text-blue-700"
                        onClick={() => handleDownload(doc.documentId)}
                        data-testid={`button-download-${doc.documentId}`}
                      >
                        <Download size={14} /> Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50 flex items-center justify-center min-h-[200px] text-gray-400">
             <div className="text-center">
               <div className="mx-auto w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                 <File className="text-gray-300" />
               </div>
               <p className="text-sm font-medium">No documents available</p>
               <p className="text-xs mt-1">Documents shared with you will appear here</p>
             </div>
          </Card>
        )}
      </div>
    </Layout>
  );
}
