import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/ui/loading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, XCircle, Mail } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    // Verify email
    fetch(`/api/auth/verify-email?token=${token}`, {
      credentials: 'include'
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'Email verified successfully!');
        } else {
          setStatus('error');
          setMessage(data.error || 'Verification failed.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Network error. Please try again.');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-50" data-testid="verify-email-page">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${
            status === 'success' ? 'bg-green-500' : 
            status === 'error' ? 'bg-red-500' : 'bg-gray-300'
          }`}>
            {status === 'loading' && <Loading size="sm" className="text-white" />}
            {status === 'success' && <CheckCircle className="text-white text-2xl" />}
            {status === 'error' && <XCircle className="text-white text-2xl" />}
          </div>
          
          <h1 className="text-2xl font-semibold text-gray-900 mb-2">
            {status === 'loading' && 'Verifying Your Email'}
            {status === 'success' && 'Email Verified'}
            {status === 'error' && 'Verification Failed'}
          </h1>
          
          <p className="text-gray-600">
            {status === 'loading' && 'Please wait while we verify your email address...'}
            {status === 'success' && 'Your account is now ready to use'}
            {status === 'error' && 'There was a problem verifying your email'}
          </p>
        </div>

        <Card>
          <CardContent className="pt-6">
            <Alert className={status === 'success' ? 'border-green-200 bg-green-50' : 
                             status === 'error' ? 'border-red-200 bg-red-50' : 
                             'border-gray-200 bg-gray-50'}>
              <Mail className="h-4 w-4" />
              <AlertDescription>
                {message}
              </AlertDescription>
            </Alert>
            
            <div className="mt-6 space-y-3">
              {status === 'success' && (
                <Button 
                  onClick={() => setLocation("/")} 
                  className="w-full"
                  data-testid="button-goto-login"
                >
                  Sign In to Your Account
                </Button>
              )}
              
              {status === 'error' && (
                <>
                  <Button 
                    onClick={() => setLocation("/register")} 
                    className="w-full"
                    data-testid="button-goto-register"
                  >
                    Try Registration Again
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    onClick={() => setLocation("/")} 
                    className="w-full"
                    data-testid="button-goto-login"
                  >
                    Back to Sign In
                  </Button>
                </>
              )}
              
              {status === 'loading' && (
                <Button 
                  disabled 
                  className="w-full"
                >
                  <Loading size="sm" className="mr-2" />
                  Verifying...
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}