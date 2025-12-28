import { useState, FormEvent } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import { Home } from "lucide-react";
import { login, setCurrentUser } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast({
        title: "Missing Information",
        description: "Please enter both email and password.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { user } = await login(email, password);
      setCurrentUser(user);
      toast({
        title: "Welcome to HouseGuide",
        description: "Successfully signed in.",
      });
      
      // Navigate to user's dashboard
      if (user.houseId) {
        setLocation(`/dashboard`);
      } else {
        toast({
          title: "Setup Required",
          description: "Your facility setup is incomplete. Please contact support.",
          variant: "destructive"
        });
        console.error('LOGIN: User has no houseId:', user);
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : "Sign in failed.";
      let description = rawMessage;

      if (rawMessage.includes("UNVERIFIED_EMAIL")) {
        description = "Please verify your email before signing in.";
      } else if (rawMessage.includes("INVALID_PASSWORD") || rawMessage.includes("NOT_FOUND")) {
        description = "Invalid email or password. Please try again.";
      } else if (rawMessage.toLowerCase().includes("too many authentication attempts")) {
        description = "Too many attempts. Please wait a few minutes and try again.";
      } else if (rawMessage.includes("Account setup incomplete")) {
        description = "Account setup is incomplete. Please contact support.";
      }

      toast({
        title: "Sign In Failed",
        description,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-3 sm:p-4 bg-surface-50" data-testid="login-page">
      <div className="w-full max-w-sm">
        {/* App Header - Mobile First */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary rounded-2xl mx-auto mb-3 sm:mb-4 flex items-center justify-center">
            <Home className="text-white text-xl sm:text-2xl" />
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-2">HouseGuide</h1>
          <p className="text-sm sm:text-base text-gray-600">Residential Care Management</p>
        </div>

        {/* Login Form - Mobile First */}
        <Card className="border-0 sm:border shadow-lg sm:shadow-md">
          <CardContent className="pt-5 sm:pt-6 px-4 sm:px-6">
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-4">
              <div>
                <Label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  disabled={isLoading}
                  className="h-11 sm:h-10 text-base sm:text-sm touch-manipulation"
                  data-testid="input-email"
                />
              </div>
              
              <div>
                <Label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  className="h-11 sm:h-10 text-base sm:text-sm touch-manipulation"
                  data-testid="input-password"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full h-11 sm:h-10 text-base sm:text-sm font-medium touch-manipulation"
                disabled={isLoading}
                data-testid="button-signin"
              >
                {isLoading ? (
                  <>
                    <Loading size="sm" className="mr-2" />
                    Signing In...
                  </>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
            
            <div className="mt-5 sm:mt-6 text-center">
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/register")}
                className="text-sm text-gray-600 hover:text-gray-800 h-10 touch-manipulation"
                data-testid="button-goto-register"
              >
                <span className="hidden sm:inline">Need to set up your facility? Register Here</span>
                <span className="sm:hidden">Register Your Facility</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
