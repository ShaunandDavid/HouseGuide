import React, { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Users, Calendar, Clock, MapPin } from "lucide-react";
import { getResident, getMeetingsByResident, createMeeting, updateMeeting, deleteMeeting, getCurrentUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Resident, Meeting } from "@shared/schema";

export default function MeetingTracker() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showMeetingDialog, setShowMeetingDialog] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    meetingType: 'aa' as 'aa' | 'na' | 'group_therapy' | 'individual_counseling' | 'house_meeting' | 'other',
    dateAttended: '',
    duration: '',
    location: '',
    notes: ''
  });

  useEffect(() => {
    if (id) {
      loadResidentData();
    }
  }, [id]);

  const loadResidentData = async () => {
    if (!id) return;
    
    setIsLoading(true);
    try {
      const residentData = await getResident(id);
      setResident(residentData);
      // Load meetings from API  
      try {
        const meetingsData = await getMeetingsByResident(id);
        setMeetings(meetingsData);
      } catch (error) {
        // Meetings data not available
        setMeetings([]);
      }
    } catch (error) {
      // Failed to load resident data - handled in UI
      toast({
        title: "Error Loading Data",
        description: "Failed to load resident information.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoBack = () => {
    setLocation(`/resident/${id}/trackers`);
  };

  const resetForm = () => {
    setFormData({
      meetingType: 'aa',
      dateAttended: '',
      duration: '',
      location: '',
      notes: ''
    });
    setEditingMeeting(null);
  };

  const handleAddMeeting = () => {
    resetForm();
    setShowMeetingDialog(true);
  };

  const handleEditMeeting = (meeting: Meeting) => {
    setFormData({
      meetingType: meeting.meetingType,
      dateAttended: meeting.dateAttended,
      duration: meeting.duration ? meeting.duration.toString() : '',
      location: meeting.location || '',
      notes: meeting.notes || ''
    });
    setEditingMeeting(meeting);
    setShowMeetingDialog(true);
  };

  const handleSaveMeeting = async () => {
    if (!id) return;
    
    const currentUser = getCurrentUser();
    if (!currentUser || !currentUser.houseId) {
      toast({
        title: "Authentication Error",
        description: "Unable to identify current user. Please log in again.",
        variant: "destructive"
      });
      return;
    }
    
    setIsSaving(true);
    try {
      if (editingMeeting) {
        // Update existing meeting
        const updatedMeeting = await updateMeeting(editingMeeting.id, {
          meetingType: formData.meetingType,
          dateAttended: formData.dateAttended,
          duration: formData.duration ? parseInt(formData.duration) : undefined,
          location: formData.location || undefined,
          notes: formData.notes || undefined
        });
        setMeetings(prev => prev.map(meeting => meeting.id === editingMeeting.id ? updatedMeeting : meeting));
        toast({
          title: "Meeting Updated",
          description: "Meeting has been updated successfully.",
        });
      } else {
        // Create new meeting
        const newMeeting = await createMeeting({
          residentId: id,
          houseId: currentUser.houseId,
          createdBy: currentUser.id,
          meetingType: formData.meetingType,
          dateAttended: formData.dateAttended,
          duration: formData.duration ? parseInt(formData.duration) : undefined,
          location: formData.location || undefined,
          notes: formData.notes || undefined
        });
        setMeetings(prev => [...prev, newMeeting]);
        toast({
          title: "Meeting Created",
          description: "New meeting has been created successfully.",
        });
      }
      setShowMeetingDialog(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save the meeting. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    try {
      await deleteMeeting(meetingId);
      setMeetings(prev => prev.filter(meeting => meeting.id !== meetingId));
      toast({
        title: "Meeting Deleted",
        description: "Meeting has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the meeting. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getMeetingTypeColor = (type: string) => {
    switch (type) {
      case 'aa': return 'bg-blue-100 text-blue-800';
      case 'na': return 'bg-green-100 text-green-800';
      case 'group_therapy': return 'bg-purple-100 text-purple-800';
      case 'individual_counseling': return 'bg-orange-100 text-orange-800';
      case 'house_meeting': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return 'Duration not recorded';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? `${mins}m` : ''}`;
    }
    return `${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="meeting-tracker-loading">
        <Loading size="lg" />
      </div>
    );
  }

  if (!resident) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <h1 className="text-xl font-bold text-gray-900 mb-2">Resident Not Found</h1>
            <p className="text-gray-600">The requested resident could not be found.</p>
            <Button onClick={handleGoBack} className="mt-4">Go Back</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface-50" data-testid="meeting-tracker">
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={handleGoBack} data-testid="back-button">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
              <Users className="text-indigo-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Meeting Tracker</h2>
              <p className="text-sm text-gray-600">{resident.firstName} {resident.lastInitial}.</p>
            </div>
          </div>
          <Button onClick={handleAddMeeting} data-testid="add-meeting-button">
            <Plus className="w-4 h-4 mr-2" />
            Add Meeting
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        {meetings.length === 0 ? (
          <Card data-testid="no-meetings">
            <CardContent className="pt-6 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Meetings Recorded</h4>
              <p className="text-gray-600 mb-4">Track attendance at recovery meetings and therapy sessions.</p>
              <Button onClick={handleAddMeeting} data-testid="add-first-meeting">
                <Plus className="w-4 h-4 mr-2" />
                Add First Meeting
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" data-testid="meetings-list">
            {meetings.map((meeting) => (
              <Card key={meeting.id} className="hover:shadow-md transition-shadow" data-testid={`meeting-card-${meeting.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={getMeetingTypeColor(meeting.meetingType)} data-testid="meeting-type">
                          {meeting.meetingType.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      {meeting.notes && (
                        <p className="text-sm text-gray-600 mb-2" data-testid="meeting-notes">
                          {meeting.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        <span data-testid="meeting-date">{formatDate(meeting.dateAttended)}</span>
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        <span data-testid="meeting-duration">{formatDuration(meeting.duration)}</span>
                      </div>
                      {meeting.location && (
                        <div className="flex items-center">
                          <MapPin className="w-4 h-4 mr-1" />
                          <span data-testid="meeting-location">{meeting.location}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditMeeting(meeting)}
                        data-testid={`edit-meeting-${meeting.id}`}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteMeeting(meeting.id)}
                        data-testid={`delete-meeting-${meeting.id}`}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Meeting Dialog */}
      <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingMeeting ? 'Edit Meeting' : 'Add New Meeting'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="meetingType">Meeting Type</Label>
              <Select value={formData.meetingType} onValueChange={(value: 'aa' | 'na' | 'group_therapy' | 'individual_counseling' | 'house_meeting' | 'other') => setFormData(prev => ({ ...prev, meetingType: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aa">AA Meeting</SelectItem>
                  <SelectItem value="na">NA Meeting</SelectItem>
                  <SelectItem value="group_therapy">Group Therapy</SelectItem>
                  <SelectItem value="individual_counseling">Individual Counseling</SelectItem>
                  <SelectItem value="house_meeting">House Meeting</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dateAttended">Date Attended</Label>
                <Input
                  id="dateAttended"
                  type="date"
                  value={formData.dateAttended}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateAttended: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                  placeholder="60"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Meeting location (optional)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes (optional)"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMeetingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveMeeting} disabled={isSaving || !formData.dateAttended}>
              {isSaving ? 'Saving...' : editingMeeting ? 'Update Meeting' : 'Create Meeting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}