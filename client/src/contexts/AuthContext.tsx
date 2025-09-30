import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  name: string;
  email: string;
  username: string;
}

interface Gallery {
  id: string;
  name: string;
  photoCount: number;
  lastModified: string;
  userId: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  galleries: Gallery[];
  galleriesLoading: boolean;
  refetchGalleries: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(() => {
    // Initialize user from localStorage on app start
    const savedUser = localStorage.getItem('user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  // Fetch galleries from backend when user is authenticated
  const { 
    data: galleries = [], 
    isLoading: galleriesLoading, 
    refetch: refetchGalleries 
  } = useQuery({
    queryKey: ['/api/galleries', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const response = await fetch(`/api/galleries?userId=${user!.id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch galleries');
      }
      return response.json();
    }
  });

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Login response user data:', data.user);
        console.log('User ID type:', typeof data.user.id, 'Value:', data.user.id);
        setUser(data.user);
        localStorage.setItem('user', JSON.stringify(data.user));
        return { success: true };
      } else {
        const errorData = await response.json();
        return { success: false, error: errorData.error || 'Login fehlgeschlagen' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Netzwerkfehler beim Login' };
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('user');
  };

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    galleries: galleries || [],
    galleriesLoading,
    refetchGalleries
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}