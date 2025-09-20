import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { Camera, Upload, X } from "lucide-react";
import { processImageWithOCR } from "@/lib/tesseract";
import { classifyDocumentByKeywords } from "@/lib/classify";
import { uploadFile, createNote } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/api";
import { autoPopulateTrackers } from "@/lib/auto-populate";

interface DocumentScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  residentId: string;
  houseId: string;
  onDocumentSaved?: () => void;
}

export function DocumentScanModal({ 
  isOpen, 
  onClose, 
  residentId,
  houseId, 
  onDocumentSaved 
}: DocumentScanModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrResult, setOcrResult] = useState<string>('');
  const [classification, setClassification] = useState<{
    label: 'commitment' | 'writeup' | null;
    confidence: number;
  } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setOcrProgress(0);
    setOcrResult('');
    setClassification(null);

    try {
      const result = await processImageWithOCR(file, setOcrProgress);
      setOcrResult(result.text);
      
      // Only proceed with classification if we have text
      if (result.text && result.text.trim()) {
        // Try AI classification first, fallback to keywords
        try {
          const response = await fetch('/api/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: result.text })
          });
          
          if (response.ok) {
            const aiResult = await response.json();
            setClassification(aiResult);
          } else {
            // Fallback to keyword classification
            const classificationResult = classifyDocumentByKeywords(result.text);
            setClassification(classificationResult);
          }
        } catch (error) {
          console.warn('Classification failed, using keyword fallback:', error);
          // Fallback to keyword classification
          const classificationResult = classifyDocumentByKeywords(result.text);
          setClassification(classificationResult);
        }
      } else {
        // No text found, but allow saving as general document
        setClassification({ label: null, confidence: 0 });
        toast({
          title: "No Text Found",
          description: "Document processed but no text was detected. You can still save it as a general document.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error('OCR processing error:', error);
      // Clear any partial state and show user-friendly message
      setOcrResult('');
      setClassification(null);
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to process the image';
      toast({
        title: "Processing Failed",
        description: `${errorMessage}. Please try a different image or retake the photo.`,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCameraCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleSaveDocument = async () => {
    if (!selectedFile || !classification) return;

    let finalType = classification.label;
    
    // If confidence is low or no classification, ask user
    if (!finalType || classification.confidence < 0.6) {
      const isCommitment = window.confirm(
        'Could not automatically classify this document. Is this a COMMITMENT?\n\nOK = Commitment\nCancel = Write-Up'
      );
      finalType = isCommitment ? 'commitment' : 'writeup';
    }

    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      // Upload file using multipart form data (more efficient than base64)
      const uploadResult = await uploadFile(
        selectedFile,
        residentId,
        houseId,
        finalType === 'commitment' ? 'commitment' : finalType === 'writeup' ? 'writeup' : 'photo',
        ocrResult
      );
      
      const fileRecord = uploadResult.file;
      
      // Create linked note with OCR text if there is text
      if (ocrResult && ocrResult.trim()) {
        // First create the main OCR note (uncategorized)
        await createNote({
          residentId,
          houseId,
          text: `OCR Extracted Text from ${fileRecord.filename}:\n\n${ocrResult}`,
          source: 'ocr',
          linkedFileId: fileRecord.id,
          createdBy: currentUser.id
        });

        // Then categorize OCR text and create categorized notes (like voice notes)
        try {
          const categorizeResponse = await fetch('/api/notes/categorize-voice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              transcript: ocrResult,
              residentId
            })
          });

          if (categorizeResponse.ok) {
            const categorizationResult = await categorizeResponse.json();
            
            // Create individual categorized notes for each segment
            const categorizedNotes = categorizationResult.segments.map((segment: any) => 
              createNote({
                residentId,
                houseId,
                text: segment.text,
                source: 'smart_ocr',
                category: segment.category,
                linkedFileId: fileRecord.id,
                createdBy: currentUser.id
              })
            );

            await Promise.all(categorizedNotes);

            toast({
              title: "OCR Content Categorized",
              description: `Created ${categorizationResult.segments.length} categorized notes from OCR text for weekly reports.`,
            });
          } else {
            // Fallback to auto-populate if categorization fails
            const populateResult = await autoPopulateTrackers(ocrResult, residentId, houseId, currentUser.id);
            if (populateResult.created > 0) {
              const noteCount = populateResult.entries.filter(e => e.type === 'note').length;
              const trackerCount = populateResult.created - noteCount;
              const message = noteCount > 0 && trackerCount > 0 
                ? `Created ${trackerCount} tracker entries and ${noteCount} smart notes`
                : noteCount > 0 
                ? `Created ${noteCount} categorized smart notes`
                : `Created ${trackerCount} tracker entries`;
                
              toast({
                title: "Auto-populated from OCR",
                description: message,
              });
            }
          }
        } catch (error) {
          console.error('OCR categorization failed, falling back to auto-populate:', error);
          
          // Fallback to auto-populate trackers and smart notes from OCR text
          const populateResult = await autoPopulateTrackers(ocrResult, residentId, houseId, currentUser.id);
          if (populateResult.created > 0) {
            const noteCount = populateResult.entries.filter(e => e.type === 'note').length;
            const trackerCount = populateResult.created - noteCount;
            const message = noteCount > 0 && trackerCount > 0 
              ? `Created ${trackerCount} tracker entries and ${noteCount} smart notes`
              : noteCount > 0 
              ? `Created ${noteCount} categorized smart notes`
              : `Created ${trackerCount} tracker entries`;
              
            toast({
              title: "Auto-populated from OCR",
              description: message,
            });
          }
        }
      }
      
      toast({
        title: "Document Saved",
        description: `Document and ${ocrResult ? 'extracted text ' : ''}saved successfully`,
      });
      
      onDocumentSaved?.();
      handleClose();
    } catch (error) {
      console.error('Save document error:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save the document. Please try again.",
        variant: "destructive"
      });
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setIsProcessing(false);
    setOcrProgress(0);
    setOcrResult('');
    setClassification(null);
    onClose();
  };

  const handleRetake = () => {
    setSelectedFile(null);
    setOcrResult('');
    setClassification(null);
    setIsProcessing(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md" data-testid="document-scan-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            Scan Document
            <Button variant="ghost" size="sm" onClick={handleClose} data-testid="close-modal-button">
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Camera/Upload Area */}
          <div className="space-y-3">
            {selectedFile ? (
              <div className="relative">
                <img
                  src={URL.createObjectURL(selectedFile)}
                  alt="Selected document"
                  className="w-full h-48 object-cover rounded-lg"
                  data-testid="selected-image"
                />
              </div>
            ) : (
              <div 
                className="w-full h-48 bg-surface-100 rounded-lg border-2 border-dashed border-surface-300 flex items-center justify-center cursor-pointer hover:bg-surface-200 transition-colors"
                onClick={handleCameraCapture}
                data-testid="camera-upload-area"
              >
                <div className="text-center">
                  <Camera className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">Tap to capture or upload</p>
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileInputChange}
              className="hidden"
              data-testid="file-input"
            />

            {/* OCR Processing */}
            {isProcessing && (
              <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg" data-testid="ocr-processing">
                <Loading size="sm" />
                <div className="flex-1">
                  <span className="text-sm text-blue-700">Processing image with OCR...</span>
                  <div className="w-full bg-blue-200 rounded-full h-2 mt-1">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${ocrProgress * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Classification Results */}
          {classification && ocrResult && !isProcessing && (
            <div className="p-3 bg-surface-50 rounded-lg" data-testid="classification-results">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Auto-Classification</span>
                <Badge 
                  variant="secondary"
                  className={classification.label === 'commitment' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}
                  data-testid="classification-badge"
                >
                  {classification.label === 'commitment' ? 'Commitment' : 'Write-up'}
                </Badge>
              </div>
              <p className="text-xs text-gray-600 mb-2" data-testid="confidence-score">
                Confidence: {Math.round(classification.confidence * 100)}%
              </p>
              <p className="text-sm text-gray-900 max-h-20 overflow-y-auto" data-testid="ocr-result">
                "{ocrResult.substring(0, 200)}{ocrResult.length > 200 ? '...' : ''}"
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-3">
            {selectedFile && (
              <>
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={handleRetake}
                  disabled={isProcessing}
                  data-testid="retake-button"
                >
                  Retake
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={handleSaveDocument}
                  disabled={isProcessing}
                  data-testid="save-document-button"
                >
                  Save Document
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
