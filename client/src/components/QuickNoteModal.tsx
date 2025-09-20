import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { createNote } from "@/lib/api";
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
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const createNoteMutation = useMutation({
    mutationFn: createNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", residentId] });
      setNoteText("");
      setSelectedCategory(undefined);
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