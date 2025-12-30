import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createNote, createGoal, createIncident, createMeeting, createAccomplishment, createChore, getCurrentUser } from "@/lib/api";
import { CategoryPills } from "@/components/CategoryPills";
import type { InsertNote } from "@shared/schema";
import type { Category } from "@shared/categories";

interface QuickNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  residentId: string;
}

export function QuickNoteModal({ isOpen, onClose, residentId }: QuickNoteModalProps) {
  const [noteText, setNoteText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>(undefined);
  const [trackerTarget, setTrackerTarget] = useState<'none' | 'goal' | 'incident' | 'meeting' | 'accomplishment' | 'chore'>('none');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createTrackerEntry = async (text: string, target: typeof trackerTarget) => {
    if (target === 'none') return;

    const currentUser = getCurrentUser();
    if (!currentUser?.houseId || !currentUser?.id) {
      throw new Error('Missing user context for tracker entry.');
    }

    const today = new Date().toISOString().split('T')[0];
    const title = text.split(/[\n.]/)[0]?.trim().slice(0, 80) || 'Quick Note';

    switch (target) {
      case 'goal':
        await createGoal({
          residentId,
          houseId: currentUser.houseId,
          title,
          description: text,
          status: 'not_started',
          priority: 'medium',
          createdBy: currentUser.id
        });
        break;
      case 'incident':
        await createIncident({
          residentId,
          houseId: currentUser.houseId,
          incidentType: 'behavioral',
          severity: 'medium',
          description: text,
          dateOccurred: today,
          followUpRequired: false,
          createdBy: currentUser.id
        });
        break;
      case 'meeting':
        await createMeeting({
          residentId,
          houseId: currentUser.houseId,
          meetingType: 'other',
          dateAttended: today,
          notes: text,
          createdBy: currentUser.id
        });
        break;
      case 'accomplishment':
        await createAccomplishment({
          residentId,
          houseId: currentUser.houseId,
          title,
          description: text,
          dateAchieved: today,
          category: 'other',
          createdBy: currentUser.id
        });
        break;
      case 'chore':
        await createChore({
          residentId,
          houseId: currentUser.houseId,
          choreName: title,
          assignedDate: today,
          status: 'assigned',
          notes: text,
          createdBy: currentUser.id
        });
        break;
    }
  };

  const createNoteMutation = useMutation({
    mutationFn: createNote,
    onSuccess: async (_data, variables) => {
      const target = trackerTarget;
      if (target !== 'none' && variables?.text) {
        try {
          await createTrackerEntry(variables.text, target);
          toast({
            title: "Tracker Updated",
            description: `Created a ${target} entry from your note.`,
          });
        } catch (error) {
          console.error('Tracker creation failed:', error);
          toast({
            title: "Tracker Update Failed",
            description: "Note saved, but tracker entry failed.",
            variant: "destructive",
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/notes", residentId] });
      setNoteText("");
      setSelectedCategory(undefined);
      setTrackerTarget('none');
      onClose();
      toast({
        title: "Note Created",
        description: "Your quick note has been saved successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create note. Please try again.",
        variant: "destructive",
      });
      console.error("Create note error:", error);
    },
  });

  const handleCreateNote = () => {
    if (!noteText.trim()) return;

    const noteData = {
      residentId,
      text: noteText.trim(),
      source: "manual" as const,
      category: selectedCategory, // Don't default - let backend handle it
    };

    // Debug logging removed for production security

    createNoteMutation.mutate(noteData as InsertNote);
  };

  const handleClose = () => {
    setNoteText("");
    setSelectedCategory(undefined);
    setTrackerTarget('none');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Quick Note</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <div data-testid="quick-note-categories">
                <CategoryPills
                  value={selectedCategory}
                  onChange={setSelectedCategory}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Send to Tracker (optional)</label>
              <Select value={trackerTarget} onValueChange={(value) => setTrackerTarget(value as typeof trackerTarget)}>
                <SelectTrigger data-testid="quick-note-tracker-select">
                  <SelectValue placeholder="Just a note" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Just a note</SelectItem>
                  <SelectItem value="goal">Goal / Commitment</SelectItem>
                  <SelectItem value="incident">Incident / Write-up</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="accomplishment">Accomplishment</SelectItem>
                  <SelectItem value="chore">Chore</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder="Write your note here..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              className="resize-none"
              data-testid="quick-note-textarea"
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleClose}
              data-testid="quick-note-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateNote}
              disabled={!noteText.trim() || createNoteMutation.isPending}
              data-testid="quick-note-save"
            >
              {createNoteMutation.isPending ? "Saving..." : "Save Note"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
