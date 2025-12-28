import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Mic, Square, Loader2, Wand2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { createNote, transcribeVoiceNote, getCurrentUser } from "@/lib/api";
import { autoPopulateTrackers } from "@/lib/auto-populate";
import type { InsertNote } from "@shared/schema";
import type { Category } from "@shared/categories";

const MIN_SEGMENT_CONFIDENCE = 0.6;

interface ComprehensiveVoiceNoteProps {
  isOpen: boolean;
  onClose: () => void;
  residentId: string;
}

interface CategorizedSegment {
  text: string;
  category: Category;
  confidence: number;
  reason: string;
}

interface AICategorizationResult {
  segments: CategorizedSegment[];
  fullTranscript: string;
  summary: string;
}

export function ComprehensiveVoiceNote({ isOpen, onClose, residentId }: ComprehensiveVoiceNoteProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [categorizedSegments, setCategorizedSegments] = useState<CategorizedSegment[]>([]);
  const [processingStep, setProcessingStep] = useState<'recording' | 'categorizing' | 'saving' | 'complete'>('recording');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const durationTimer = useRef<NodeJS.Timeout>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const processVoiceNote = useCallback(async (audioBlob: Blob) => {
    setIsProcessing(true);
    setProcessingStep('categorizing');

    try {
      const formData = new FormData();
      const extension = getAudioExtension(audioBlob.type || '');
      formData.append('audio', audioBlob, `voice-note${extension}`);
      formData.append('residentId', residentId);

      const result: AICategorizationResult = await transcribeVoiceNote(formData);
      const segments = Array.isArray(result.segments) ? result.segments : [];
      const lowConfidenceCount = segments.filter(segment => segment.confidence < MIN_SEGMENT_CONFIDENCE).length;

      setTranscript(result.fullTranscript || '');
      setCategorizedSegments(segments);
      setProcessingStep('complete');

      toast({
        title: "Voice Note Processed",
        description: lowConfidenceCount > 0
          ? `Found ${segments.length} segments. ${lowConfidenceCount} low-confidence segment(s) saved as General.`
          : `Found ${segments.length} categorized segments from your recording.`,
      });
    } catch (error) {
      console.error('Failed to process voice note:', error);
      toast({
        title: "Processing Failed",
        description: "Failed to transcribe voice note. Please try again.",
        variant: "destructive",
      });
      setProcessingStep('recording');
    } finally {
      setIsProcessing(false);
    }
  }, [getAudioExtension, residentId, toast]);

  const startRecording = useCallback(async () => {
    if (!isRecorderSupported) {
      toast({
        title: "Voice Not Supported",
        description: "Your device does not support in-app voice recording.",
        variant: "destructive",
      });
      return;
    }

    discardRecordingRef.current = false;
    setTranscript('');
    setRecordingDuration(0);
    setCategorizedSegments([]);
    setProcessingStep('recording');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        cleanupMedia();
        setIsRecording(false);
        if (durationTimer.current) {
          clearInterval(durationTimer.current);
        }
        toast({
          title: "Recording Error",
          description: "Voice recording failed. Please try again.",
          variant: "destructive",
        });
      };

      recorder.onstop = async () => {
        const blobType = recorder.mimeType || (audioChunksRef.current[0] && audioChunksRef.current[0].type) || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
        cleanupMedia();

        if (discardRecordingRef.current) {
          discardRecordingRef.current = false;
          return;
        }

        if (!audioBlob.size) {
          setProcessingStep('recording');
          toast({
            title: "No Audio Captured",
            description: "Please try recording again and speak clearly.",
            variant: "destructive",
          });
          return;
        }

        await processVoiceNote(audioBlob);
      };

      recorder.start();
      setIsRecording(true);

      durationTimer.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      toast({
        title: "Recording Started",
        description: "Speak clearly. Tap stop when finished.",
      });
    } catch (error) {
      cleanupMedia();
      toast({
        title: "Microphone Unavailable",
        description: "Unable to access microphone. Please check permissions.",
        variant: "destructive",
      });
    }
  }, [cleanupMedia, getSupportedMimeType, isRecorderSupported, processVoiceNote, toast]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current) return;

    setIsRecording(false);
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
    }

    if (mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const saveAllNotes = async () => {
    if (categorizedSegments.length === 0) return;

    setIsSaving(true);
    setProcessingStep('saving');

    try {
      // Create individual notes for each categorized segment
      const savePromises = categorizedSegments.map(segment =>
        createNote({
          residentId,
          text: segment.text,
          source: "voice" as const,
          category: segment.category,
          // houseId and createdBy will be set by the backend from auth
        } as InsertNote)
      );

      await Promise.all(savePromises);

      const currentUser = getCurrentUser();
      if (currentUser?.houseId && transcript.trim()) {
        try {
          const populateResult = await autoPopulateTrackers(
            transcript,
            residentId,
            currentUser.houseId,
            currentUser.id,
            { includeNotes: false }
          );
          if (populateResult.created > 0) {
            toast({
              title: "Trackers Updated",
              description: `Created ${populateResult.created} tracker entries from this voice note.`,
            });
          }
        } catch (error) {
          console.error('Voice note tracker auto-populate failed:', error);
        }
      }

      // Invalidate queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ["/api/notes", residentId] });

      toast({
        title: "Voice Notes Saved",
        description: `Successfully saved ${categorizedSegments.length} categorized notes.`,
      });

      handleClose();
    } catch (error) {
      console.error('Failed to save notes:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save notes. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isRecording) {
      discardRecordingRef.current = true;
      stopRecording();
    } else {
      cleanupMedia();
    }
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
    }
    setTranscript('');
    setCategorizedSegments([]);
    setRecordingDuration(0);
    setProcessingStep('recording');
    onClose();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCategoryColor = (category: Category) => {
    const colors = {
      work_school: 'bg-blue-100 text-blue-800',
      demeanor: 'bg-green-100 text-green-800', 
      sponsor: 'bg-purple-100 text-purple-800',
      medical: 'bg-red-100 text-red-800',
      chores: 'bg-yellow-100 text-yellow-800',
      general: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.general;
  };

  const getCategoryIcon = (category: Category) => {
    const icons = {
      work_school: '💼',
      demeanor: '😊',
      sponsor: '🤝', 
      medical: '🏥',
      chores: '🧹',
      general: '📝'
    };
    return icons[category] || icons.general;
  };

  const getCategoryLabel = (category: Category) => {
    const labels = {
      work_school: 'Work/School',
      demeanor: 'Demeanor',
      sponsor: 'Sponsor/Recovery',
      medical: 'Medical',
      chores: 'Chores',
      general: 'General'
    };
    return labels[category] || labels.general;
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Comprehensive Voice Note
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recording Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Record Comprehensive Update</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-gray-600">
                Record a comprehensive voice note covering all areas of the resident's recovery. 
                AI will automatically categorize your content into the appropriate sections.
              </div>
              {!isRecorderSupported && (
                <div className="text-sm text-red-600">
                  Voice recording is not supported on this device.
                </div>
              )}
              
              <div className="flex items-center gap-4">
                {!isRecording ? (
                  <Button 
                    onClick={startRecording}
                    disabled={!isRecorderSupported || isProcessing || processingStep !== 'recording'}
                    className="flex items-center gap-2"
                    data-testid="start-voice-recording"
                  >
                    <Mic className="h-4 w-4" />
                    Start Recording
                  </Button>
                ) : (
                  <Button 
                    onClick={stopRecording}
                    variant="destructive"
                    className="flex items-center gap-2"
                    data-testid="stop-voice-recording"
                  >
                    <Square className="h-4 w-4" />
                    Stop Recording
                  </Button>
                )}
                
                {isRecording && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-mono">
                      {formatDuration(recordingDuration)}
                    </span>
                  </div>
                )}
              </div>

              {(transcript || isProcessing) && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Transcript:</h4>
                  <Textarea
                    value={transcript}
                    readOnly
                    className="min-h-[100px]"
                    placeholder="Transcription will appear here after processing..."
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Processing Status */}
          {isProcessing && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <div>
                    <div className="font-medium">Processing Voice Note</div>
                    <div className="text-sm text-gray-600">
                      AI is analyzing and categorizing your content...
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Categorized Results */}
          {categorizedSegments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wand2 className="h-5 w-5" />
                  AI Categorized Segments ({categorizedSegments.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {categorizedSegments.map((segment, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge className={getCategoryColor(segment.category)}>
                        {getCategoryIcon(segment.category)} {getCategoryLabel(segment.category)}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        Confidence: {Math.round(segment.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-sm">{segment.text}</p>
                    <p className="text-xs text-gray-500 italic">
                      Reason: {segment.reason}
                    </p>
                  </div>
                ))}

                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={saveAllNotes}
                    disabled={isSaving}
                    className="flex items-center gap-2"
                    data-testid="save-categorized-notes"
                  >
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Save All Notes
                  </Button>
                  <Button variant="outline" onClick={handleClose}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
