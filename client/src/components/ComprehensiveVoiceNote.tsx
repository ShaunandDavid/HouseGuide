import { useState, useRef, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Mic, MicOff, Square, Loader2, Wand2, Save } from "lucide-react";
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useToast } from "@/hooks/use-toast";
import { createNote, apiRequest } from "@/lib/api";
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
  
  const recordingTimer = useRef<NodeJS.Timeout>();
  const durationTimer = useRef<NodeJS.Timeout>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { isListening, isSupported, startListening, stopListening, resetTranscript } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    lang: 'en-US',
    onResult: (text, isFinal) => {
      if (isFinal) {
        setTranscript(prev => prev + ' ' + text);
      }
    },
    onError: (error) => {
      console.error('Speech recognition error:', error);
      setIsRecording(false);
      toast({
        title: "Recording Error",
        description: "Voice recording failed. Please try again.",
        variant: "destructive",
      });
    }
  });

  const startRecording = useCallback(() => {
    if (!isSupported) {
      toast({
        title: "Voice Not Supported",
        description: "Your browser doesn't support voice recording. Please type your notes instead.",
        variant: "destructive",
      });
      return;
    }

    setIsRecording(true);
    setTranscript('');
    setRecordingDuration(0);
    setCategorizedSegments([]);
    setProcessingStep('recording');
    resetTranscript();
    startListening();

    // Start duration timer
    durationTimer.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);

    toast({
      title: "Recording Started",
      description: "Speak about all areas of the resident's recovery. Recording will automatically categorize your notes.",
    });
  }, [isSupported, startListening, resetTranscript, toast]);

  const stopRecording = useCallback(() => {
    setIsRecording(false);
    stopListening();
    
    if (durationTimer.current) {
      clearInterval(durationTimer.current);
    }

    if (transcript.trim()) {
      processVoiceNote();
    } else {
      toast({
        title: "No Speech Detected",
        description: "Please try recording again and speak clearly.",
        variant: "destructive",
      });
    }
  }, [stopListening, transcript]);

  const processVoiceNote = async () => {
    if (!transcript.trim()) return;

    setIsProcessing(true);
    setProcessingStep('categorizing');

    try {
      // Call AI categorization endpoint
      const response = await apiRequest('/api/notes/categorize-voice', {
        method: 'POST',
        body: JSON.stringify({
          transcript: transcript.trim(),
          residentId
        })
      });

      const result: AICategorizationResult = response;
      const lowConfidenceCount = result.segments.filter(segment => segment.confidence < MIN_SEGMENT_CONFIDENCE).length;
      const normalizedSegments = result.segments.map(segment => {
        if (segment.confidence >= MIN_SEGMENT_CONFIDENCE) {
          return segment;
        }
        return {
          ...segment,
          category: "general",
          reason: "Low confidence; saved as General."
        };
      });
      setCategorizedSegments(normalizedSegments);
      setProcessingStep('complete');

      toast({
        title: "Voice Note Processed",
        description: lowConfidenceCount > 0
          ? `Found ${normalizedSegments.length} segments. ${lowConfidenceCount} low-confidence segment(s) saved as General.`
          : `Found ${normalizedSegments.length} categorized segments from your recording.`,
      });
    } catch (error) {
      console.error('Failed to process voice note:', error);
      toast({
        title: "Processing Failed",
        description: "Failed to categorize voice note. Please try again.",
        variant: "destructive",
      });
      setProcessingStep('recording');
    } finally {
      setIsProcessing(false);
    }
  };

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
      stopRecording();
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
              
              <div className="flex items-center gap-4">
                {!isRecording ? (
                  <Button 
                    onClick={startRecording}
                    disabled={isProcessing || processingStep !== 'recording'}
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

              {transcript && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Live Transcript:</h4>
                  <Textarea
                    value={transcript}
                    readOnly
                    className="min-h-[100px]"
                    placeholder="Your speech will appear here as you talk..."
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
