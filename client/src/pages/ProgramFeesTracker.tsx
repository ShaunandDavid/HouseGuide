import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/ui/loading";
import { ArrowLeft, Plus, DollarSign, Calendar, CheckCircle } from "lucide-react";
import { getResident } from "@/lib/pocketbase";
import { useToast } from "@/hooks/use-toast";
import type { Resident, ProgramFee } from "@shared/schema";

export default function ProgramFeesTracker() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const [resident, setResident] = useState<Resident | null>(null);
  const [fees, setFees] = useState<ProgramFee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
        const response = await fetch(`/api/fees/by-resident/${id}`, {
          credentials: 'include'
        });
        if (response.ok) {
          const feesData = await response.json();
          setFees(feesData);
        }
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
    setLocation(`/resident/${id}/trackers`);
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
          <Button data-testid="add-fee-button">
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
              <Button data-testid="add-first-fee">
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}