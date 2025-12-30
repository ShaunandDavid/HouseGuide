import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { PlusIcon, FileTextIcon, ScanTextIcon, CalendarIcon } from "lucide-react";
import { MicInput } from "@/components/MicInput";
import { CategoryPills } from "@/components/CategoryPills";
import { createNote, getNotesByResident, updateNote } from "@/lib/api";
import type { Note, InsertNote } from "@shared/schema";
import type { Category } from "@shared/categories";
import { CATEGORY_LABEL, CATEGORY_ICON } from "@shared/categories";
import { format } from "date-fns";

interface NotesManagementProps {
  residentId: string;
  houseId: string;
  onNoteCreated?: () => void;
}

export function NotesManagement({ residentId, houseId, onNoteCreated }: NotesManagementProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newNoteText, setNewNoteText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | undefined>(undefined);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);
  const noteTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["/api/notes", residentId],
    queryFn: () => getNotesByResident(residentId),
  });

  const createNoteMutation = useMutation({
    mutationFn: createNote,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", residentId] });
      setNewNoteText("");
      setSelectedCategory(undefined);
      setIsCreating(false);
      toast({
        title: "Note Created",
        description: "Your note has been saved successfully.",
      });
      onNoteCreated?.();
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

  const updateNoteMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { text: string; category: Category } }) =>
      updateNote(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes", residentId] });
      setEditingNoteId(null);
      setEditingText("");
      setEditingCategory(undefined);
      toast({
        title: "Note Updated",
        description: "Your note has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update note. Please try again.",
        variant: "destructive",
      });
      console.error("Update note error:", error);
    },
  });

  const handleCreateNote = async () => {
    if (!newNoteText.trim()) return;

    const noteData = {
      residentId,
      text: newNoteText.trim(),
      source: "manual" as const,
      category: selectedCategory, // Don't default to "general" - let backend handle it
      // houseId and createdBy will be set by the backend from auth
    };

    // Debug logging removed for production security

    createNoteMutation.mutate(noteData as InsertNote);
  };

  const handleCancelCreate = () => {
    setNewNoteText("");
    setSelectedCategory(undefined);
    setIsCreating(false);
  };

  const handleStartEdit = (note: Note) => {
    setEditingNoteId(note.id);
    setEditingText(note.text);
    setEditingCategory(note.category && note.category !== "general" ? note.category : undefined);
  };

  const handleCancelEdit = () => {
    setEditingNoteId(null);
    setEditingText("");
    setEditingCategory(undefined);
  };

  const handleSaveEdit = () => {
    if (!editingNoteId || !editingText.trim()) return;

    updateNoteMutation.mutate({
      id: editingNoteId,
      updates: {
        text: editingText.trim(),
        category: editingCategory ?? "general",
      },
    });
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "MMM dd, yyyy 'at' h:mm a");
    } catch {
      return dateString;
    }
  };

  const sortedNotes = [...notes].sort((a, b) => 
    new Date(b.created).getTime() - new Date(a.created).getTime()
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Notes</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="notes-management">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileTextIcon className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Notes</h2>
          <Badge variant="secondary">{notes.length}</Badge>
        </div>
        {!isCreating && (
          <Button
            onClick={() => setIsCreating(true)}
            size="sm"
            data-testid="button-create-note"
          >
            <PlusIcon className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        )}
      </div>

      {/* Create Note Form */}
      {isCreating && (
        <Card data-testid="note-create-form">
          <CardHeader>
            <CardTitle className="text-base">Create New Note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CategoryPills value={selectedCategory} onChange={setSelectedCategory} />
            {selectedCategory && (
              <div className="text-xs text-gray-600 -mt-2 mb-2">
                Category: {CATEGORY_ICON[selectedCategory]} {CATEGORY_LABEL[selectedCategory]}
              </div>
            )}
            <div className="relative">
              <Textarea
                ref={noteTextareaRef}
                placeholder="Write your note here..."
                value={newNoteText}
                onChange={(e) => setNewNoteText(e.target.value)}
                rows={4}
                className="pr-12"
                data-testid="textarea-note-content"
              />
              <div className="absolute top-2 right-2">
                <MicInput
                  targetRef={noteTextareaRef}
                  onInsertText={(text, cursorPosition) => {
                    if (noteTextareaRef.current) {
                      const textarea = noteTextareaRef.current;
                      const currentValue = textarea.value;
                      const insertPosition = cursorPosition ?? textarea.selectionStart ?? currentValue.length;
                      
                      const newValue = 
                        currentValue.slice(0, insertPosition) + 
                        (insertPosition > 0 && !currentValue[insertPosition - 1]?.match(/\s/) ? ' ' : '') +
                        text + 
                        (insertPosition < currentValue.length && !currentValue[insertPosition]?.match(/\s/) ? ' ' : '') +
                        currentValue.slice(insertPosition);
                      
                      setNewNoteText(newValue);
                    }
                  }}
                  size="sm"
                  variant="ghost"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateNote}
                disabled={!newNoteText.trim() || createNoteMutation.isPending}
                size="sm"
                data-testid="button-save-note"
              >
                {createNoteMutation.isPending ? "Saving..." : "Save Note"}
              </Button>
              <Button
                onClick={handleCancelCreate}
                variant="outline"
                size="sm"
                data-testid="button-cancel-note"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes List */}
      <div className="space-y-4">
        {sortedNotes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8 text-gray-500">
              <FileTextIcon className="h-12 w-12 mb-4 text-gray-300" />
              <p className="text-lg font-medium mb-2">No notes yet</p>
              <p className="text-sm text-center max-w-sm">
                Create your first note or scan a document to automatically extract text.
              </p>
            </CardContent>
          </Card>
        ) : (
          sortedNotes.map((note) => (
            <Card key={note.id} data-testid={`note-card-${note.id}`}>
              <CardContent className="p-4">
                {/* Note Header */}
                <div className="flex items-start justify-between mb-3 gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {note.source === "manual" ? (
                      <FileTextIcon className="h-4 w-4 text-blue-600" />
                    ) : (
                      <ScanTextIcon className="h-4 w-4 text-green-600" />
                    )}
                    <Badge
                      variant={note.source === "manual" ? "default" : "secondary"}
                      className="text-xs"
                      data-testid={`badge-source-${note.source}`}
                    >
                      {note.source === "manual" ? "Manual Note" : "OCR Extracted"}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {CATEGORY_ICON[note.category || "general"]} {CATEGORY_LABEL[note.category || "general"]}
                    </Badge>
                    {note.linkedFileId && (
                      <Badge variant="outline" className="text-xs">
                        Linked to Image
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      <span data-testid={`text-date-${note.id}`}>
                        {formatDate(note.created)}
                      </span>
                    </div>
                    {editingNoteId !== note.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleStartEdit(note)}
                      >
                        Edit
                      </Button>
                    )}
                  </div>
                </div>

                {/* Note Content */}
                <div className="space-y-3">
                  {editingNoteId === note.id ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={editingCategory ? "outline" : "default"}
                          onClick={() => setEditingCategory(undefined)}
                        >
                          General
                        </Button>
                        <CategoryPills value={editingCategory} onChange={setEditingCategory} />
                      </div>
                      <div className="relative">
                        <Textarea
                          ref={editTextareaRef}
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          rows={4}
                          className="pr-12"
                        />
                        <div className="absolute top-2 right-2">
                          <MicInput
                            targetRef={editTextareaRef}
                            onInsertText={(text, cursorPosition) => {
                              if (editTextareaRef.current) {
                                const textarea = editTextareaRef.current;
                                const currentValue = textarea.value;
                                const insertPosition = cursorPosition ?? textarea.selectionStart ?? currentValue.length;
                                
                                const newValue = 
                                  currentValue.slice(0, insertPosition) + 
                                  (insertPosition > 0 && !currentValue[insertPosition - 1]?.match(/\s/) ? ' ' : '') +
                                  text + 
                                  (insertPosition < currentValue.length && !currentValue[insertPosition]?.match(/\s/) ? ' ' : '') +
                                  currentValue.slice(insertPosition);
                                
                                setEditingText(newValue);
                              }
                            }}
                            size="sm"
                            variant="ghost"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          onClick={handleSaveEdit}
                          disabled={!editingText.trim() || updateNoteMutation.isPending}
                          size="sm"
                        >
                          {updateNoteMutation.isPending ? "Saving..." : "Save Changes"}
                        </Button>
                        <Button
                          onClick={handleCancelEdit}
                          variant="outline"
                          size="sm"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="text-gray-700 whitespace-pre-wrap break-words"
                      data-testid={`text-content-${note.id}`}
                    >
                      {note.text}
                    </div>
                  )}

                  {/* OCR Note Info */}
                  {note.source === "ocr" && note.linkedFileId && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-gray-500">
                        This text was automatically extracted from a scanned image.
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Help Text */}
      {notes.length > 0 && (
        <div className="text-xs text-gray-500 text-center pt-4">
          <Separator className="mb-4" />
          <p>
            Manual notes are created by you directly. OCR notes are automatically generated 
            from scanned documents and images.
          </p>
        </div>
      )}
    </div>
  );
}
