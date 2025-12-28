import React, { useState, useEffect, useRef } from "react";
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
import { MicInput } from "@/components/MicInput";
import { ArrowLeft, Plus, DollarSign, Calendar, CheckCircle } from "lucide-react";
import { getResident, getFeesByResident, createFee, updateFee, deleteFee, getCurrentUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { Resident, ProgramFee } from "@shared/schema";

export default function ProgramFeesTracker() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [fees, setFees] = useState<ProgramFee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFeeDialog, setShowFeeDialog] = useState(false);
  const [editingFee, setEditingFee] = useState<ProgramFee | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const notesTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    feeType: 'rent' as 'rent' | 'program_fee' | 'fine' | 'deposit' | 'other',
    amount: '',
    dueDate: '',
    paidDate: '',
    status: 'pending' as 'pending' | 'paid' | 'overdue' | 'waived',
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
      // Load fees from API
      try {
        const feesData = await getFeesByResident(id);
        setFees(feesData);
      } catch (error) {
        // Fees data not available
        setFees([]);
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
    setLocation(`/resident/${id}/dashboard`);
  };

  const resetForm = () => {
    setFormData({
      feeType: 'rent',
      amount: '',
      dueDate: '',
      paidDate: '',
      status: 'pending',
      notes: ''
    });
    setEditingFee(null);
  };

  const handleAddFee = () => {
    resetForm();
    setShowFeeDialog(true);
  };

  const handleEditFee = (fee: ProgramFee) => {
    setFormData({
      feeType: fee.feeType,
      amount: fee.amount.toString(),
      dueDate: fee.dueDate,
      paidDate: fee.paidDate || '',
      status: fee.status,
      notes: fee.notes || ''
    });
    setEditingFee(fee);
    setShowFeeDialog(true);
  };

  const handleSaveFee = async () => {
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
      if (editingFee) {
        // Update existing fee
        const updatedFee = await updateFee(editingFee.id, {
          feeType: formData.feeType,
          amount: parseFloat(formData.amount),
          dueDate: formData.dueDate,
          paidDate: formData.paidDate || undefined,
          status: formData.status,
          notes: formData.notes || undefined
        });
        setFees(prev => prev.map(fee => fee.id === editingFee.id ? updatedFee : fee));
        toast({
          title: "Fee Updated",
          description: "Program fee has been updated successfully.",
        });
      } else {
        // Create new fee
        const newFee = await createFee({
          residentId: id,
          houseId: currentUser.houseId,
          createdBy: currentUser.id,
          feeType: formData.feeType,
          amount: parseFloat(formData.amount),
          dueDate: formData.dueDate,
          paidDate: formData.paidDate || undefined,
          status: formData.status,
          notes: formData.notes || undefined
        });
        setFees(prev => [...prev, newFee]);
        toast({
          title: "Fee Created",
          description: "New program fee has been created successfully.",
        });
      }
      setShowFeeDialog(false);
      resetForm();
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "Failed to save the fee. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteFee = async (feeId: string) => {
    try {
      await deleteFee(feeId);
      setFees(prev => prev.filter(fee => fee.id !== feeId));
      toast({
        title: "Fee Deleted",
        description: "Program fee has been deleted successfully.",
      });
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete the fee. Please try again.",
        variant: "destructive"
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'waived': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getFeeTypeColor = (type: string) => {
    switch (type) {
      case 'rent': return 'bg-blue-100 text-blue-800';
      case 'program_fee': return 'bg-green-100 text-green-800';
      case 'fine': return 'bg-red-100 text-red-800';
      case 'deposit': return 'bg-purple-100 text-purple-800';
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="fees-tracker-loading">
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
    <div className="min-h-screen flex flex-col bg-surface-50" data-testid="fees-tracker">
      <header className="bg-white shadow-sm border-b">
        <div className="px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Button variant="ghost" size="sm" onClick={handleGoBack} data-testid="back-button">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <DollarSign className="text-emerald-600 w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Program Fees Tracker</h2>
              <p className="text-sm text-gray-600">{resident.firstName} {resident.lastInitial}.</p>
            </div>
          </div>
          <Button onClick={handleAddFee} data-testid="add-fee-button">
            <Plus className="w-4 h-4 mr-2" />
            Add Fee
          </Button>
        </div>
      </header>

      <main className="flex-1 p-4">
        {fees.length === 0 ? (
          <Card data-testid="no-fees">
            <CardContent className="pt-6 text-center">
              <DollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Fees Recorded</h4>
              <p className="text-gray-600 mb-4">Track program fees, rent, fines, and other financial obligations.</p>
              <Button onClick={handleAddFee} data-testid="add-first-fee">
                <Plus className="w-4 h-4 mr-2" />
                Add First Fee
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4" data-testid="fees-list">
            {fees.map((fee) => (
              <Card key={fee.id} className="hover:shadow-md transition-shadow" data-testid={`fee-card-${fee.id}`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={getFeeTypeColor(fee.feeType)} data-testid="fee-type">
                          {fee.feeType.replace('_', ' ')}
                        </Badge>
                        <span className="text-lg font-semibold text-gray-900" data-testid="fee-amount">
                          {formatCurrency(fee.amount)}
                        </span>
                      </div>
                      {fee.notes && (
                        <p className="text-sm text-gray-600 mb-2" data-testid="fee-notes">
                          {fee.notes}
                        </p>
                      )}
                    </div>
                    <Badge className={getStatusColor(fee.status)} data-testid="fee-status">
                      {fee.status}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-1" />
                        <span data-testid="due-date">Due: {formatDate(fee.dueDate)}</span>
                      </div>
                      {fee.paidDate && (
                        <div className="flex items-center text-green-600">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          <span data-testid="paid-date">Paid: {formatDate(fee.paidDate)}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditFee(fee)}
                        data-testid={`edit-fee-${fee.id}`}
                      >
                        Edit
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => handleDeleteFee(fee.id)}
                        data-testid={`delete-fee-${fee.id}`}
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

      {/* Fee Dialog */}
      <Dialog open={showFeeDialog} onOpenChange={setShowFeeDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {editingFee ? 'Edit Program Fee' : 'Add New Program Fee'}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="feeType">Fee Type</Label>
              <Select value={formData.feeType} onValueChange={(value: 'rent' | 'program_fee' | 'fine' | 'deposit' | 'other') => setFormData(prev => ({ ...prev, feeType: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rent">Rent</SelectItem>
                  <SelectItem value="program_fee">Program Fee</SelectItem>
                  <SelectItem value="fine">Fine</SelectItem>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  placeholder="0.00"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: 'pending' | 'paid' | 'overdue' | 'waived') => setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="waived">Waived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="dueDate">Due Date</Label>
                <Input
                  id="dueDate"
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="paidDate">Paid Date</Label>
                <Input
                  id="paidDate"
                  type="date"
                  value={formData.paidDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, paidDate: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <div className="relative">
                <Textarea
                  ref={notesTextareaRef}
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional notes (optional)"
                  rows={3}
                  className="pr-12"
                />
                <div className="absolute top-2 right-2">
                  <MicInput
                    targetRef={notesTextareaRef}
                    onInsertText={(text, cursorPosition) => {
                      if (notesTextareaRef.current) {
                        const textarea = notesTextareaRef.current;
                        const currentValue = textarea.value;
                        const insertPosition = cursorPosition ?? textarea.selectionStart ?? currentValue.length;
                        
                        const newValue = 
                          currentValue.slice(0, insertPosition) + 
                          (insertPosition > 0 && !currentValue[insertPosition - 1]?.match(/\s/) ? ' ' : '') +
                          text + 
                          (insertPosition < currentValue.length && !currentValue[insertPosition]?.match(/\s/) ? ' ' : '') +
                          currentValue.slice(insertPosition);
                        
                        setFormData(prev => ({ ...prev, notes: newValue }));
                      }
                    }}
                    size="sm"
                    variant="ghost"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFeeDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFee} disabled={isSaving || !formData.amount || !formData.dueDate}>
              {isSaving ? 'Saving...' : editingFee ? 'Update Fee' : 'Create Fee'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
