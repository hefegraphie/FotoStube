import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface User {
  id: string;
  name: string;
  role: string; // "Admin" or "User"
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
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/galleries', {
        credentials: 'include',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch galleries');
      }
      return response.json();
    }
  });

  // This is a placeholder for the actual state management of galleries.
  // In a real application, you'd likely manage this state within AuthContext
  // or a dedicated gallery context/hook. For the purpose of this example,
  // we'll assume `galleries` and `galleriesLoading` from useQuery are sufficient
  // for the owned galleries, and we'll handle assigned galleries separately.
  const [combinedGalleries, setCombinedGalleries] = useState<Gallery[]>([]);
  const [areGalleriesLoading, setAreGalleriesLoading] = useState<boolean>(true);


  useEffect(() => {
    if (user) {
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        ...(token && { 'Authorization': `Bearer ${token}` })
      };
      
      setAreGalleriesLoading(true);
      
      // Load owned galleries
      fetch('/api/galleries', {
        credentials: 'include',
        headers
      })
        .then(res => {
          if (!res.ok) {
            throw new Error('Failed to fetch owned galleries');
          }
          return res.json();
        })
        .then(async (ownedGalleries) => {
          // Ensure ownedGalleries is an array
          const safeOwnedGalleries = Array.isArray(ownedGalleries) ? ownedGalleries : [];
          
          // Load assigned galleries
          try {
            const assignedResponse = await fetch(`/api/users/${user.id}/assigned-galleries`, {
              credentials: 'include',
              headers
            });
            let assignedGalleries = [];
            if (assignedResponse.ok) {
              const data = await assignedResponse.json();
              assignedGalleries = Array.isArray(data) ? data : [];
            }

            // Combine both (remove duplicates)
            const allGalleries = [...safeOwnedGalleries];
            assignedGalleries.forEach((assigned: any) => {
              if (!allGalleries.find(g => g.id === assigned.id)) {
                allGalleries.push(assigned);
              }
            });

            setCombinedGalleries(allGalleries);
            setAreGalleriesLoading(false);
          } catch (error) {
            console.error('Error loading assigned galleries:', error);
            setCombinedGalleries(safeOwnedGalleries); // Fallback to owned galleries if assigned fail
            setAreGalleriesLoading(false);
          }
        })
        .catch(err => {
          console.error('Error loading galleries:', err);
          setCombinedGalleries([]); // Clear galleries on error
          setAreGalleriesLoading(false);
        });
    } else {
      setCombinedGalleries([]); // Clear galleries when user logs out
      setAreGalleriesLoading(false);
    }
  }, [user]);

  // Refetch function to update both owned and assigned galleries
  const refetchCombinedGalleries = async () => {
    if (user) {
      setAreGalleriesLoading(true);
      const token = localStorage.getItem('authToken');
      const headers: Record<string, string> = {
        ...(token && { 'Authorization': `Bearer ${token}` })
      };
      
      try {
        // Get owned galleries
        const ownedResponse = await fetch('/api/galleries', {
          credentials: 'include',
          headers
        });
        let ownedGalleries = [];
        if (ownedResponse.ok) {
          const data = await ownedResponse.json();
          ownedGalleries = Array.isArray(data) ? data : [];
        }

        // Get assigned galleries
        const assignedResponse = await fetch(`/api/users/${user.id}/assigned-galleries`, {
          credentials: 'include',
          headers
        });
        let assignedGalleries = [];
        if (assignedResponse.ok) {
          const data = await assignedResponse.json();
          assignedGalleries = Array.isArray(data) ? data : [];
        }

        // Combine both (remove duplicates if any)
        const allGalleries = [...ownedGalleries];
        assignedGalleries.forEach((assigned: any) => {
          if (!allGalleries.find(g => g.id === assigned.id)) {
            allGalleries.push(assigned);
          }
        });

        setCombinedGalleries(allGalleries);
      } catch (error) {
        console.error('Error refetching galleries:', error);
        setCombinedGalleries([]); // Clear on error
      } finally {
        setAreGalleriesLoading(false);
      }
    } else {
      setCombinedGalleries([]);
      setAreGalleriesLoading(false);
    }
  };


  const login = async (name: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({ name, password })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Login response user data:', data.user);
        setUser(data.user);
        
        // Token wird als HTTP-only Cookie gespeichert
        // Optional: Fallback localStorage für token (falls Cookie nicht funktioniert)
        if (data.token) {
          localStorage.setItem('authToken', data.token);
        }
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

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('authToken');
  };

  const value = {
    user,
    isAuthenticated: !!user,
    login,
    logout,
    galleries: combinedGalleries, // Use the combined galleries
    galleriesLoading: areGalleriesLoading, // Use the loading state for combined galleries
    refetchGalleries: refetchCombinedGalleries // Use the refetch function for combined galleries
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}