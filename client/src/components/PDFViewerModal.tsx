import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink, Loader2, X, FileText } from "lucide-react";

interface PDFViewerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  title: string;
  downloadUrl: string;
}

export function PDFViewerModal({ open, onOpenChange, documentId, title, downloadUrl }: PDFViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setLoading(true);
      setError(false);
    }
  }, [open, documentId]);

  const handleIframeLoad = () => {
    setLoading(false);
  };

  const handleIframeError = () => {
    setLoading(false);
    setError(true);
  };

  const handleDownload = async () => {
    try {
      const response = await fetch(downloadUrl, { credentials: "include" });
      if (!response.ok) throw new Error("Download failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = title;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  const handleOpenInNewTab = () => {
    window.open(downloadUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-red-500" />
            <DialogTitle className="text-lg font-semibold truncate max-w-[400px]" title={title}>
              {title}
            </DialogTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleOpenInNewTab} data-testid="button-open-new-tab">
              <ExternalLink className="h-4 w-4 mr-2" />
              Open in New Tab
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownload} data-testid="button-download-modal">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} data-testid="button-close-modal">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>
        
        <div className="flex-1 relative bg-gray-100">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          )}
          
          {error ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-100 text-center p-6">
              <FileText className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="font-semibold text-gray-900 mb-2">Unable to Preview PDF</h3>
              <p className="text-gray-500 max-w-md mb-4">
                The PDF cannot be displayed inline. You can open it in a new tab or download it directly.
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={handleOpenInNewTab}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          ) : (
            <iframe
              key={documentId}
              src={`${downloadUrl}?preview=true#toolbar=1&navpanes=0`}
              className="w-full h-full border-0"
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              title={title}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
