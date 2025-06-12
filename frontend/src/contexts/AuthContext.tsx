'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, getCurrentUser, logout } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Development: Auto-login as admin for testing
        if (process.env.NODE_ENV === 'development') {
          try {
            const { login } = await import('@/lib/auth');
            const user = await login({ username: 'admin', password: 'admin123' });
            setUser(user);
            console.log('Auto-logged in as admin for development');
          } catch (loginError) {
            console.error('Auto-login failed:', loginError);
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const signOut = () => {
    logout();
    setUser(null);
  };

  const value = {
    user,
    isLoading,
    setUser,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};