import { useState, useRef, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { Textarea } from "@/components/ui/textarea";
import { Camera, X, Mic, Square, Loader2 } from "lucide-react";
import { processImageWithOCR } from "@/lib/tesseract";
import { classifyDocumentByKeywords } from "@/lib/classify";
import { uploadFile, createNote, createGoal, createIncident, transcribeVoiceNote, requestOcr } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { getCurrentUser } from "@/lib/api";
import { autoPopulateTrackers } from "@/lib/auto-populate";

const MIN_OCR_CONFIDENCE = 60;
const MIN_OCR_TEXT_CHARS = 40;
const MIN_SEGMENT_CONFIDENCE = 0.6;

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
  const [isLowQualityOCR, setIsLowQualityOCR] = useState(false);
  const [classification, setClassification] = useState<{
    label: 'commitment' | 'writeup' | null;
    confidence: number;
  } | null>(null);
  const [documentType, setDocumentType] = useState<'commitment' | 'writeup' | 'incident' | 'general' | 'photo'>('general');
  const [verificationText, setVerificationText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const isRecorderSupported = typeof window !== 'undefined'
    && typeof MediaRecorder !== 'undefined'
    && !!navigator?.mediaDevices?.getUserMedia;

  const getSupportedMimeType = () => {
    if (typeof MediaRecorder === 'undefined') return '';
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/m4a',
      'audio/aac',
      'audio/mpeg',
      'audio/ogg;codecs=opus',
      'audio/ogg'
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || '';
  };

  const getAudioExtension = (mimeType: string) => {
    if (mimeType.includes('webm')) return '.webm';
    if (mimeType.includes('ogg')) return '.ogg';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return '.mp3';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) return '.m4a';
    if (mimeType.includes('aac')) return '.aac';
    if (mimeType.includes('wav')) return '.wav';
    return '.webm';
  };

  const cleanupMedia = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.onerror = null;
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }
    audioChunksRef.current = [];
  }, []);

  const startRecording = useCallback(async () => {
    if (!isRecorderSupported) {
      toast({
        title: "Voice Not Supported",
        description: "Your device does not support in-app voice recording.",
        variant: "destructive"
      });
      return;
    }

    setIsRecording(true);
    setIsTranscribing(false);
    audioChunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        setIsRecording(false);
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        cleanupMedia();

        if (!blob.size) {
          return;
        }

        setIsTranscribing(true);
        try {
          const formData = new FormData();
          const extension = getAudioExtension(blob.type || '');
          formData.append('audio', blob, `verification-note${extension}`);
          formData.append('residentId', residentId);

          const result = await transcribeVoiceNote(formData);
          const transcript = result?.fullTranscript || '';
          if (transcript.trim()) {
            setVerificationText(transcript.trim());
            toast({
              title: "Voice Note Added",
              description: "Transcript added to verification notes."
            });
          } else {
            toast({
              title: "No Transcript",
              description: "We could not detect any speech. Please try again.",
              variant: "destructive"
            });
          }
        } catch (error) {
          console.error('Verification voice note error:', error);
          toast({
            title: "Voice Note Failed",
            description: "Unable to transcribe this recording. Please try again.",
            variant: "destructive"
          });
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
    } catch (error) {
      setIsRecording(false);
      cleanupMedia();
      toast({
        title: "Microphone Error",
        description: "Unable to start recording. Check microphone permissions.",
        variant: "destructive"
      });
    }
  }, [cleanupMedia, getAudioExtension, getSupportedMimeType, isRecorderSupported, residentId, toast]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setIsProcessing(true);
    setOcrProgress(0);
    setOcrResult('');
    setIsLowQualityOCR(false);
    setClassification(null);
    setDocumentType('general');
    setVerificationText('');

    try {
      let result: { text: string; confidence: number };

      try {
        result = await processImageWithOCR(file, setOcrProgress);
      } catch (error) {
        toast({
          title: "Switching to Cloud OCR",
          description: "Device OCR failed. Running secure OCR in the background.",
        });
        setOcrProgress(0.1);
        result = await requestOcr(file);
        setOcrProgress(1);
      }

      const cleanedText = result.text?.trim() || '';
      const isLowQuality = cleanedText.length > 0 && (result.confidence < MIN_OCR_CONFIDENCE || cleanedText.length < MIN_OCR_TEXT_CHARS);

      setOcrResult(cleanedText);
      setIsLowQualityOCR(isLowQuality);
      
      // Only proceed with classification if we have text
      if (cleanedText && !isLowQuality) {
        // Try AI classification first, fallback to keywords
        try {
          const response = await fetch('/api/classify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: cleanedText })
          });
          
          if (response.ok) {
            const aiResult = await response.json();
            setClassification(aiResult);
            if (aiResult?.label) {
              setDocumentType(aiResult.label);
            }
          } else {
            // Fallback to keyword classification
            const classificationResult = classifyDocumentByKeywords(result.text);
            setClassification(classificationResult);
            if (classificationResult?.label) {
              setDocumentType(classificationResult.label);
            }
          }
        } catch (error) {
          console.warn('Classification failed, using keyword fallback:', error);
          // Fallback to keyword classification
          const classificationResult = classifyDocumentByKeywords(cleanedText);
          setClassification(classificationResult);
          if (classificationResult?.label) {
            setDocumentType(classificationResult.label);
          }
        }
      } else if (cleanedText) {
        setClassification({ label: null, confidence: 0 });
        toast({
          title: "OCR Quality Too Low",
          description: "We could not reliably read this image. You can still save the file, but no notes will be created. Consider re-scanning.",
          variant: "default"
        });
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
      setClassification({ label: null, confidence: 0 });
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to process the image';
      toast({
        title: "Processing Failed",
        description: `${errorMessage}. You can still save the document or retake the photo.`,
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
    if (!selectedFile) return;

    try {
      const currentUser = getCurrentUser();
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const finalType = documentType || 'general';
      const verificationNote = verificationText.trim();
      const requiresVerification = ['commitment', 'writeup', 'incident'].includes(finalType);

      if (requiresVerification && !verificationNote) {
        toast({
          title: "Verification Needed",
          description: "Add a short text or voice verification note before saving.",
          variant: "destructive"
        });
        return;
      }

      // Upload file using multipart form data (more efficient than base64)
      const uploadResult = await uploadFile(
        selectedFile,
        residentId,
        houseId,
        finalType,
        ocrResult
      );
      
      const fileRecord = uploadResult.file;
      
      // Create linked note with OCR text if there is text
      if (ocrResult && ocrResult.trim() && !isLowQualityOCR) {
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
            const segments = categorizationResult.segments || [];
            const lowConfidenceCount = segments.filter((segment: any) => segment.confidence < MIN_SEGMENT_CONFIDENCE).length;
            const normalizedSegments = segments.map((segment: any) => {
              if (segment.confidence >= MIN_SEGMENT_CONFIDENCE) {
                return segment;
              }
              return {
                ...segment,
                category: 'general',
                reason: 'Low confidence; saved as General.'
              };
            });
            
            // Create individual categorized notes for each segment
            const categorizedNotes = normalizedSegments.map((segment: any) => 
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
              description: lowConfidenceCount > 0
                ? `Created ${normalizedSegments.length} notes. ${lowConfidenceCount} low-confidence segment(s) saved as General.`
                : `Created ${normalizedSegments.length} categorized notes from OCR text for weekly reports.`,
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

      if (verificationNote) {
        await createNote({
          residentId,
          houseId,
          text: verificationNote,
          source: 'manual',
          linkedFileId: fileRecord.id,
          createdBy: currentUser.id
        });

        const today = new Date().toISOString().split('T')[0];

        if (finalType === 'commitment') {
          const title = verificationNote.split(/[\n.]/)[0]?.trim().slice(0, 80) || 'Commitment';
          await createGoal({
            residentId,
            houseId,
            title,
            description: verificationNote,
            status: 'not_started',
            priority: 'medium',
            createdBy: currentUser.id
          });
        }

        if (finalType === 'writeup' || finalType === 'incident') {
          await createIncident({
            residentId,
            houseId,
            incidentType: finalType === 'writeup' ? 'policy_violation' : 'behavioral',
            severity: 'medium',
            description: verificationNote,
            dateOccurred: today,
            followUpRequired: false,
            createdBy: currentUser.id
          });
        }
      }

      if (ocrResult && ocrResult.trim() && isLowQualityOCR) {
        toast({
          title: "OCR Skipped",
          description: "Image saved, but OCR text was too low quality to create notes. Consider re-scanning or adding a manual note.",
        });
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
    setIsLowQualityOCR(false);
    setClassification(null);
    setDocumentType('general');
    setVerificationText('');
    setIsRecording(false);
    setIsTranscribing(false);
    cleanupMedia();
    onClose();
  };

  const handleRetake = () => {
    setSelectedFile(null);
    setOcrResult('');
    setIsLowQualityOCR(false);
    setClassification(null);
    setIsProcessing(false);
    setDocumentType('general');
    setVerificationText('');
    setIsRecording(false);
    setIsTranscribing(false);
    cleanupMedia();
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
                  className={
                    classification.label === 'commitment'
                      ? 'bg-green-100 text-green-800'
                      : classification.label === 'writeup'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-800'
                  }
                  data-testid="classification-badge"
                >
                  {classification.label === 'commitment'
                    ? 'Commitment'
                    : classification.label === 'writeup'
                      ? 'Write-up'
                      : 'Needs Review'}
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

          {selectedFile && (
            <div className="space-y-2" data-testid="document-type-selector">
              <label className="text-sm font-medium">Document Type</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 'commitment', label: 'Commitment' },
                  { value: 'writeup', label: 'Write-up' },
                  { value: 'incident', label: 'Incident' },
                  { value: 'general', label: 'General' },
                  { value: 'photo', label: 'Photo' },
                ].map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={documentType === option.value ? 'default' : 'outline'}
                    onClick={() => setDocumentType(option.value as typeof documentType)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {selectedFile && (
            <div className="space-y-2" data-testid="verification-note">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-medium">Verification Note</label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={isProcessing || isTranscribing}
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Transcribing
                    </>
                  ) : isRecording ? (
                    <>
                      <Square className="w-4 h-4 mr-2" />
                      Stop
                    </>
                  ) : (
                    <>
                      <Mic className="w-4 h-4 mr-2" />
                      Record
                    </>
                  )}
                </Button>
              </div>
              <Textarea
                value={verificationText}
                onChange={(e) => setVerificationText(e.target.value)}
                placeholder="Add a quick verification note (text or voice)."
                rows={3}
              />
              {['commitment', 'writeup', 'incident'].includes(documentType) && (
                <div className="text-xs text-gray-500">
                  Required for commitments, write-ups, and incidents.
                </div>
              )}
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
                  disabled={isProcessing || isTranscribing || !selectedFile}
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
