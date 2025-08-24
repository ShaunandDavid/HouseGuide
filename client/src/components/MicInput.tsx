import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSpeechRecognition } from '@/hooks/useSpeechRecognition';
import { useToast } from '@/hooks/use-toast';

interface MicInputProps {
  onTranscript?: (text: string) => void;
  onInsertText?: (text: string, cursorPosition?: number) => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  disabled?: boolean;
  targetRef?: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
}

export function MicInput({ 
  onTranscript, 
  onInsertText, 
  className, 
  size = 'sm', 
  variant = 'outline',
  disabled = false,
  targetRef
}: MicInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const accumulatedTextRef = useRef('');
  const { toast } = useToast();

  const handleResult = useCallback((transcript: string, isFinal: boolean) => {
    if (isFinal) {
      // Add the final transcript to our accumulated text
      const newText = transcript.trim();
      if (newText) {
        accumulatedTextRef.current += (accumulatedTextRef.current ? ' ' : '') + newText;
        setCurrentTranscript(accumulatedTextRef.current);
        onTranscript?.(accumulatedTextRef.current);
      }
    }
  }, [onTranscript]);

  const handleError = useCallback((error: string) => {
    console.error('Speech recognition error:', error);
    toast({
      title: 'Voice Input Error',
      description: 'Unable to process voice input. Please try again.',
      variant: 'destructive',
    });
    setIsRecording(false);
  }, [toast]);

  const {
    isListening,
    transcript,
    interimTranscript,
    isSupported,
    error,
    startListening,
    stopListening,
    resetTranscript
  } = useSpeechRecognition({
    continuous: true,
    interimResults: true,
    lang: 'en-US',
    onResult: handleResult,
    onError: handleError
  });

  const handleStartRecording = useCallback(() => {
    if (!isSupported) {
      toast({
        title: 'Voice Input Not Available',
        description: 'Your browser does not support voice input. Try using your keyboard\'s dictation feature.',
        variant: 'destructive',
      });
      return;
    }

    if (disabled) return;

    // Reset accumulated text when starting a new recording
    accumulatedTextRef.current = '';
    setCurrentTranscript('');
    resetTranscript();

    const started = startListening();
    if (started) {
      setIsRecording(true);
      toast({
        title: 'Voice Input Started',
        description: 'Speak clearly. Tap the stop button when finished.',
      });
    }
  }, [isSupported, disabled, startListening, resetTranscript, toast]);

  const handleStopRecording = useCallback(() => {
    stopListening();
    setIsRecording(false);

    // Get the final accumulated text
    const finalText = accumulatedTextRef.current.trim();

    if (finalText) {
      // Insert text at cursor position if we have a target element
      if (targetRef?.current && onInsertText) {
        const element = targetRef.current;
        const cursorPosition = element.selectionStart || 0;
        onInsertText(finalText, cursorPosition);
        
        // Focus back to the text area and position cursor after inserted text
        setTimeout(() => {
          element.focus();
          const newPosition = cursorPosition + finalText.length;
          element.setSelectionRange(newPosition, newPosition);
        }, 100);
      } else {
        onTranscript?.(finalText);
      }

      toast({
        title: 'Voice Input Complete',
        description: `Added: "${finalText.length > 50 ? finalText.substring(0, 50) + '...' : finalText}"`,
      });
    } else {
      toast({
        title: 'No Speech Detected',
        description: 'Please try speaking more clearly.',
        variant: 'destructive',
      });
    }

    // Reset for next use
    accumulatedTextRef.current = '';
    setCurrentTranscript('');
  }, [stopListening, onTranscript, onInsertText, targetRef, toast]);

  const toggleRecording = useCallback(() => {
    if (isRecording || isListening) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  }, [isRecording, isListening, handleStartRecording, handleStopRecording]);

  // Don't render if not supported and no fallback message needed
  if (!isSupported) {
    return null;
  }

  const buttonSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default';
  const iconSize = size === 'sm' ? 'h-3 w-3' : size === 'lg' ? 'h-5 w-5' : 'h-4 w-4';

  return (
    <div className={cn('relative', className)}>
      <Button
        type="button"
        variant={variant}
        size={buttonSize}
        onClick={toggleRecording}
        disabled={disabled}
        className={cn(
          'transition-all duration-200',
          (isRecording || isListening) && 'bg-red-500 hover:bg-red-600 text-white animate-pulse',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        data-testid="mic-input-button"
        title={isRecording ? 'Stop recording' : 'Start voice input'}
      >
        {isRecording || isListening ? (
          <Square className={cn(iconSize, 'fill-current')} />
        ) : (
          <Mic className={iconSize} />
        )}
        {size !== 'sm' && (
          <span className="ml-1">
            {isRecording || isListening ? 'Stop' : 'Voice'}
          </span>
        )}
      </Button>

      {/* Live transcript preview for debugging/feedback */}
      {(isRecording || isListening) && (currentTranscript || interimTranscript) && (
        <div className="absolute top-full left-0 mt-1 p-2 bg-black bg-opacity-75 text-white text-xs rounded shadow-lg max-w-xs z-50">
          <div className="text-green-300">{currentTranscript}</div>
          {interimTranscript && (
            <div className="text-gray-300 italic">{interimTranscript}</div>
          )}
        </div>
      )}
    </div>
  );
}