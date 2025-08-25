import { useState, useEffect } from "react";
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
import { ArrowLeft, Plus, Users, Calendar, Clock, MapPin, Camera, Image } from "lucide-react";
import { getResident, getMeetingsByResident, createMeeting, updateMeeting, deleteMeeting, getCurrentUser, apiRequest } from "@/lib/api";
import { ObjectUploader } from "@/components/ObjectUploader";
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
    notes: '',
    photoUrl: ''
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
      notes: '',
      photoUrl: ''
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
      notes: meeting.notes || '',
      photoUrl: meeting.photoUrl || ''
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
          notes: formData.notes || undefined,
          photoUrl: formData.photoUrl || undefined
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
          notes: formData.notes || undefined,
          photoUrl: formData.photoUrl || undefined
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

  // Photo upload functions
  const handleGetUploadParameters = async () => {
    try {
      const response = await apiRequest('/api/objects/upload', {
        method: 'POST',
      });
      return {
        method: 'PUT' as const,
        url: response.uploadURL,
      };
    } catch (error) {
      toast({
        title: "Upload Error",
        description: "Failed to get upload parameters. Please try again.",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handlePhotoUploadComplete = async (result: any) => {
    if (result.successful && result.successful[0]) {
      const uploadedFile = result.successful[0];
      const photoUrl = uploadedFile.uploadURL;
      
      try {
        // Process the photo URL with backend
        const response = await apiRequest('/api/meeting-photos', {
          method: 'PUT',
          body: JSON.stringify({ photoUrl }),
        });
        
        // Update the form with the processed photo URL
        setFormData(prev => ({
          ...prev,
          photoUrl: response.objectPath
        }));
        
        toast({
          title: "Photo Uploaded",
          description: "Meeting photo has been uploaded successfully.",
        });
      } catch (error) {
        toast({
          title: "Upload Processing Error", 
          description: "Photo uploaded but failed to process. Please try again.",
          variant: "destructive"
        });
      }
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
      <header className="bg-white shadow-sm border-b sticky top-0 z-20">
        <div className="px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              <Button variant="ghost" size="sm" onClick={handleGoBack} data-testid="back-button" className="flex-shrink-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="text-indigo-600 w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Meeting Tracker</h2>
                <p className="text-xs sm:text-sm text-gray-600 truncate">{resident.firstName} {resident.lastInitial}.</p>
              </div>
            </div>
            <Button onClick={handleAddMeeting} data-testid="add-meeting-button" className="flex-shrink-0 h-9 sm:h-10 text-sm touch-manipulation">
              <Plus className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add Meeting</span>
              <span className="sm:hidden">Add</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-3 sm:p-4">
        {meetings.length === 0 ? (
          <Card data-testid="no-meetings">
            <CardContent className="pt-6 text-center px-4 sm:px-6">
              <Users className="w-10 h-10 sm:w-12 sm:h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No Meetings Recorded</h4>
              <p className="text-sm sm:text-base text-gray-600 mb-4">Track attendance at recovery meetings and therapy sessions.</p>
              <Button onClick={handleAddMeeting} data-testid="add-first-meeting" className="h-10 touch-manipulation">
                <Plus className="w-4 h-4 mr-2" />
                Add First Meeting
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 sm:space-y-4" data-testid="meetings-list">
            {meetings.map((meeting) => (
              <Card key={meeting.id} className="hover:shadow-md transition-shadow touch-manipulation" data-testid={`meeting-card-${meeting.id}`}>
                <CardContent className="p-4 sm:p-6">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge className={`${getMeetingTypeColor(meeting.meetingType)} text-xs`} data-testid="meeting-type">
                        {meeting.meetingType.replace('_', ' ').toUpperCase()}
                      </Badge>
                      {meeting.photoUrl && (
                        <Badge variant="outline" className="flex items-center space-x-1 text-xs">
                          <Image className="w-3 h-3" />
                          <span>Photo</span>
                        </Badge>
                      )}
                    </div>
                    
                    {meeting.notes && (
                      <p className="text-xs sm:text-sm text-gray-600" data-testid="meeting-notes">
                        {meeting.notes}
                      </p>
                    )}
                    
                    {meeting.photoUrl && (
                      <div className="">
                        <img 
                          src={meeting.photoUrl} 
                          alt="Meeting attendance verification" 
                          className="w-24 h-18 sm:w-32 sm:h-24 object-cover rounded-lg border"
                          data-testid="meeting-photo"
                        />
                      </div>
                    )}
                    
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                      <div className="grid grid-cols-1 sm:flex sm:flex-wrap sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
                        <div className="flex items-center">
                          <Calendar className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          <span data-testid="meeting-date">{formatDate(meeting.dateAttended)}</span>
                        </div>
                        <div className="flex items-center">
                          <Clock className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                          <span data-testid="meeting-duration">{formatDuration(meeting.duration)}</span>
                        </div>
                        {meeting.location && (
                          <div className="flex items-center">
                            <MapPin className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                            <span data-testid="meeting-location" className="truncate">{meeting.location}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2 pt-2 sm:pt-0 border-t sm:border-t-0">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleEditMeeting(meeting)}
                          data-testid={`edit-meeting-${meeting.id}`}
                          className="h-8 text-xs sm:text-sm touch-manipulation"
                        >
                          Edit
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-xs sm:text-sm touch-manipulation"
                          onClick={() => handleDeleteMeeting(meeting.id)}
                          data-testid={`delete-meeting-${meeting.id}`}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* Meeting Dialog - Mobile First */}
      <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
        <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto mx-3 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">
              {editingMeeting ? 'Edit Meeting' : 'Add New Meeting'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="meetingType" className="text-sm font-medium">Meeting Type</Label>
              <Select value={formData.meetingType} onValueChange={(value: 'aa' | 'na' | 'group_therapy' | 'individual_counseling' | 'house_meeting' | 'other') => setFormData(prev => ({ ...prev, meetingType: value }))}>
                <SelectTrigger className="h-11 sm:h-10 touch-manipulation">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dateAttended" className="text-sm font-medium">Date Attended</Label>
                <Input
                  id="dateAttended"
                  type="date"
                  value={formData.dateAttended}
                  onChange={(e) => setFormData(prev => ({ ...prev, dateAttended: e.target.value }))}
                  className="h-11 sm:h-10 touch-manipulation"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration" className="text-sm font-medium">Duration (minutes)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                  placeholder="60"
                  className="h-11 sm:h-10 touch-manipulation"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location" className="text-sm font-medium">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="Meeting location (optional)"
                className="h-11 sm:h-10 touch-manipulation"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes" className="text-sm font-medium">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes (optional)"
                rows={3}
                className="min-h-[80px] touch-manipulation"
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-medium">Meeting Attendance Photo (Optional)</Label>
              <div className="space-y-3">
                {formData.photoUrl ? (
                  <div className="space-y-2">
                    <div className="relative border rounded-lg p-3 bg-green-50">
                      <div className="flex items-center space-x-2">
                        <Image className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-700 font-medium">Photo uploaded successfully</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, photoUrl: '' }))}
                        className="absolute top-2 right-2 text-green-600 hover:text-green-800 p-1 touch-manipulation"
                        data-testid="remove-photo"
                      >
                        ×
                      </button>
                    </div>
                    <img 
                      src={formData.photoUrl} 
                      alt="Meeting attendance verification" 
                      className="w-full max-w-xs rounded-lg border"
                      data-testid="uploaded-photo-preview"
                    />
                  </div>
                ) : (
                  <ObjectUploader
                    maxNumberOfFiles={1}
                    maxFileSize={10485760} // 10MB
                    onGetUploadParameters={handleGetUploadParameters}
                    onComplete={handlePhotoUploadComplete}
                    buttonClassName="w-full h-11 sm:h-10 touch-manipulation"
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Camera className="w-4 h-4" />
                      <span className="text-sm sm:text-base">Upload Meeting Photo</span>
                    </div>
                  </ObjectUploader>
                )}
                <p className="text-xs text-gray-500">
                  Upload a photo to verify meeting attendance (e.g., selfie at meeting location, meeting materials, etc.)
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowMeetingDialog(false)} className="w-full sm:w-auto h-11 sm:h-10 touch-manipulation">
              Cancel
            </Button>
            <Button onClick={handleSaveMeeting} disabled={isSaving || !formData.dateAttended} className="w-full sm:w-auto h-11 sm:h-10 touch-manipulation">
              {isSaving ? 'Saving...' : editingMeeting ? 'Update Meeting' : 'Create Meeting'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}