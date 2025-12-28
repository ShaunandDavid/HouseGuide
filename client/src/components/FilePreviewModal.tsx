import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ExternalLink, X } from "lucide-react";
import type { FileRecord } from "@shared/schema";

interface FilePreviewModalProps {
  file: FileRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const getFileUrl = (file: FileRecord) => {
  if (!file.url) return "";
  return file.url;
};

const isImageFile = (file: FileRecord) => file.mimeType?.startsWith("image/");
const isPdfFile = (file: FileRecord) =>
  file.mimeType === "application/pdf" || file.url?.toLowerCase().endsWith(".pdf");

export function FilePreviewModal({ file, open, onOpenChange }: FilePreviewModalProps) {
  if (!file) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg" />
      </Dialog>
    );
  }

  const fileUrl = getFileUrl(file);
  const showImage = isImageFile(file);
  const showPdf = !showImage && isPdfFile(file);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-hidden bg-white/85 backdrop-blur-xl border border-white/50 shadow-2xl">
        <DialogHeader className="flex items-center justify-between">
          <DialogTitle className="text-lg font-semibold">Document Preview</DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            aria-label="Close preview"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm text-gray-600 truncate">{file.filename}</div>
            {fileUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(fileUrl, "_blank")}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open in New Tab
              </Button>
            )}
          </div>

          <div className="rounded-xl border border-white/50 bg-white/60 p-3 max-h-[60vh] overflow-auto">
            {showImage && (
              <img
                src={fileUrl}
                alt={file.filename}
                className="w-full h-auto rounded-lg object-contain"
              />
            )}

            {showPdf && (
              <object
                data={fileUrl}
                type="application/pdf"
                className="w-full h-[60vh]"
              >
                <p className="text-sm text-gray-600">
                  PDF preview not available. Use “Open in New Tab”.
                </p>
              </object>
            )}

            {!showImage && !showPdf && (
              <div className="text-sm text-gray-600">
                Preview not available for this file type. Use “Open in New Tab”.
              </div>
            )}
          </div>

          {file.ocrText && (
            <div className="rounded-xl border border-white/50 bg-white/60 p-3">
              <div className="text-xs uppercase text-gray-500 mb-2">OCR Text</div>
              <div className="text-sm text-gray-800 whitespace-pre-wrap">{file.ocrText}</div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
