

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "./AuthContext";

export interface Notification {
  id: string;
  userId?: string;
  galleryId?: string;
  photoId?: string;
  type: 'rating' | 'like' | 'download' | 'comment';
  message: string;
  actorName?: string;
  isRead: boolean;
  createdAt: Date;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (message: string, type: 'rating' | 'like' | 'download' | 'comment', galleryId?: string, photoId?: string, actorName?: string) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  unreadCount: number;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

interface NotificationProviderProps {
  children: ReactNode;
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  // Try to get auth context, but don't fail if it's not available (for public views)
  let user: any = null;
  try {
    const auth = useAuth();
    user = auth.user;
  } catch (error) {
    // Auth context not available - this is OK for public views
    user = null;
  }
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Load notifications from API
  const loadNotifications = async () => {
    if (!user?.id) return;
    
    try {
      const response = await fetch(`/api/notifications/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        const parsedNotifications = data.map((n: any) => ({
          ...n,
          createdAt: n.createdAt ? new Date(n.createdAt) : new Date()
        })).filter((n: any) => !isNaN(n.createdAt.getTime())) // Filter out invalid dates
        .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime()); // Sort newest first
        setNotifications(parsedNotifications);
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  };

  useEffect(() => {
    loadNotifications();
    
    // Set up polling for new notifications every 5 seconds
    if (user?.id) {
      const interval = setInterval(() => {
        loadNotifications();
      }, 5000);
      
      // Listen for manual refresh events
      const handleRefresh = () => {
        loadNotifications();
      };
      window.addEventListener('refreshNotifications', handleRefresh);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('refreshNotifications', handleRefresh);
      };
    }
  }, [user?.id]);

  const addNotification = async (
    message: string, 
    type: 'rating' | 'like' | 'download' | 'comment', 
    galleryId?: string, 
    photoId?: string, 
    actorName?: string
  ) => {
    if (!user?.id) return;

    try {
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          galleryId,
          photoId,
          type,
          message,
          actorName,
          isRead: false
        })
      });

      if (response.ok) {
        const newNotification = await response.json();
        const parsedNotification = { 
          ...newNotification, 
          createdAt: newNotification.createdAt ? new Date(newNotification.createdAt) : new Date()
        };
        // Only add if the date is valid
        if (!isNaN(parsedNotification.createdAt.getTime())) {
          setNotifications(prev => [parsedNotification, ...prev]);
        }
      }
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const response = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH'
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notification => 
            notification.id === id 
              ? { ...notification, isRead: true }
              : notification
          )
        );
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!user?.id) return;

    try {
      const response = await fetch(`/api/notifications/${user.id}/read-all`, {
        method: 'PATCH'
      });

      if (response.ok) {
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, isRead: true }))
        );
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const refreshNotifications = () => {
    loadNotifications();
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const value = {
    notifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    unreadCount,
    refreshNotifications,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

