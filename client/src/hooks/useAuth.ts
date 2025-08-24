import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { getCurrentUser } from '@/lib/api';
import type { Guide } from '@shared/schema';

export function useAuth(requireAuth: boolean = true) {
  const [, setLocation] = useLocation();
  const [user, setUser] = useState<Guide | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const currentUser = getCurrentUser();
        
        if (!currentUser) {
          if (requireAuth) {
            setLocation('/');
            return;
          }
          setIsAuthenticated(false);
          setUser(null);
          setIsLoading(false);
          return;
        }

        // Verify the token is still valid by making a request to the server
        const response = await fetch('/api/whoami', {
          credentials: 'include',
        });

        if (response.ok) {
          setUser(currentUser);
          setIsAuthenticated(true);
        } else {
          // Token is invalid, clear user data and redirect
          localStorage.removeItem('current-user');
          if (requireAuth) {
            setLocation('/');
            return;
          }
          setIsAuthenticated(false);
          setUser(null);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        // Clear user data and redirect on error
        localStorage.removeItem('current-user');
        if (requireAuth) {
          setLocation('/');
          return;
        }
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [setLocation, requireAuth]);

  return {
    user,
    isAuthenticated,
    isLoading,
  };
}