import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Home, ArrowLeft, Mail, CheckCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Register() {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    houseName: ""
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.email || !formData.password || !formData.name || !formData.houseName) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields.",
        variant: "destructive"
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast({
        title: "Password Mismatch",
        description: "Passwords do not match. Please try again.",
        variant: "destructive"
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: "Password Too Short",
        description: "Password must be at least 8 characters long.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
          houseName: formData.houseName
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Registration failed');
      }

      setIsRegistered(true);
      toast({
        title: "Registration Successful",
        description: "Please check your email to verify your account.",
      });
    } catch (error: any) {
      toast({
        title: "Registration Failed", 
        description: error.message || "Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isRegistered) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-surface-50" data-testid="registration-success">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500 rounded-full mx-auto mb-4 flex items-center justify-center">
              <CheckCircle className="text-white text-2xl" />
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-2">Check Your Email</h1>
            <p className="text-gray-600">We've sent a verification link to {formData.email}</p>
          </div>

          <Card>
            <CardContent className="pt-6">
              <Alert>
                <Mail className="h-4 w-4" />
                <AlertDescription>
                  Please check your email and click the verification link to complete your registration. 
                  Once verified, you can sign in and start managing residents for {formData.houseName}.
                </AlertDescription>
              </Alert>
              
              <div className="mt-6 space-y-4">
                <Button 
                  onClick={() => setLocation("/")} 
                  className="w-full"
                  data-testid="button-goto-login"
                >
                  Go to Sign In
                </Button>
                
                <Button 
                  variant="outline" 
                  onClick={() => setIsRegistered(false)} 
                  className="w-full"
                  data-testid="button-register-another"
                >
                  Register Another Facility
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-50" data-testid="register-page">
      <div className="w-full max-w-md">
        {/* App Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <Home className="text-white text-2xl" />
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">Create Your Facility</h1>
          <p className="text-gray-600">Set up your residential care management</p>
        </div>

        {/* Registration Form */}
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="houseName" className="block text-sm font-medium text-gray-700 mb-2">
                  Facility Name *
                </Label>
                <Input
                  id="houseName"
                  type="text"
                  value={formData.houseName}
                  onChange={(e) => handleInputChange('houseName', e.target.value)}
                  placeholder="e.g., 1021 Wall Street"
                  disabled={isLoading}
                  data-testid="input-house-name"
                />
              </div>

              <div>
                <Label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Full Name *
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter your full name"
                  disabled={isLoading}
                  data-testid="input-name"
                />
              </div>
              
              <div>
                <Label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address *
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  placeholder="Enter your email"
                  disabled={isLoading}
                  data-testid="input-email"
                />
              </div>
              
              <div>
                <Label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  placeholder="Minimum 8 characters"
                  disabled={isLoading}
                  data-testid="input-password"
                />
              </div>
              
              <div>
                <Label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
                  Confirm Password *
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                  placeholder="Re-enter your password"
                  disabled={isLoading}
                  data-testid="input-confirm-password"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isLoading}
                data-testid="button-register"
              >
                {isLoading ? (
                  <>
                    <Loading size="sm" className="mr-2" />
                    Creating Account...
                  </>
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/login")}
                className="text-sm text-gray-600 hover:text-gray-800"
                data-testid="button-goto-login"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Already have an account? Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}