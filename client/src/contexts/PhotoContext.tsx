
import React, { createContext, useContext, useState, ReactNode } from 'react';

interface Comment {
  id: string;
  author: string;
  text: string;
  timestamp: string;
}

interface Photo {
  id: string;
  src: string;
  mediumSrc?: string;
  originalSrc?: string;
  alt: string;
  rating: number;
  isLiked: boolean;
  comments: Comment[];
}

interface PhotoContextType {
  photos: Photo[];
  setPhotos: (photos: Photo[]) => void;
  updatePhoto: (photoId: string, updates: Partial<Photo>) => void;
  updatePhotoRating: (photoId: string, rating: number, userName?: string) => Promise<void>;
  updatePhotoLike: (photoId: string, isLiked: boolean, userName?: string) => Promise<void>;
  addPhotoComment: (photoId: string, comment: string, commenterName: string) => Promise<void>;
  getPhoto: (photoId: string) => Photo | undefined;
}

const PhotoContext = createContext<PhotoContextType | undefined>(undefined);

export function usePhotos() {
  const context = useContext(PhotoContext);
  if (context === undefined) {
    throw new Error('usePhotos must be used within a PhotoProvider');
  }
  return context;
}

interface PhotoProviderProps {
  children: ReactNode;
}

export function PhotoProvider({ children }: PhotoProviderProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);

  const updatePhoto = (photoId: string, updates: Partial<Photo>) => {
    setPhotos(prev => 
      prev.map(photo => 
        photo.id === photoId ? { ...photo, ...updates } : photo
      )
    );
  };

  const updatePhotoRating = async (photoId: string, rating: number, userName?: string) => {
    const originalPhoto = photos.find(p => p.id === photoId);
    const previousRating = originalPhoto?.rating || 0;

    // Optimistic update
    updatePhoto(photoId, { rating });

    try {
      const response = await fetch(`/api/photos/${photoId}/rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, userName }),
      });

      if (!response.ok) {
        // Revert on error
        updatePhoto(photoId, { rating: previousRating });
        throw new Error('Failed to update rating');
      }

      const result = await response.json();
      // Update with server response to ensure consistency
      updatePhoto(photoId, { rating: result.photo.rating });
    } catch (error) {
      // Revert on error
      updatePhoto(photoId, { rating: previousRating });
      console.error('Error updating rating:', error);
      throw error;
    }
  };

  const updatePhotoLike = async (photoId: string, isLiked: boolean, userName?: string) => {
    const originalPhoto = photos.find(p => p.id === photoId);
    const previousLikeState = originalPhoto?.isLiked || false;

    // Optimistic update
    updatePhoto(photoId, { isLiked });

    try {
      const response = await fetch(`/api/photos/${photoId}/like`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isLiked, userName }),
      });

      if (!response.ok) {
        // Revert on error
        updatePhoto(photoId, { isLiked: previousLikeState });
        throw new Error('Failed to update like');
      }

      const result = await response.json();
      // Update with server response to ensure consistency
      updatePhoto(photoId, { isLiked: result.photo.isLiked });
    } catch (error) {
      // Revert on error
      updatePhoto(photoId, { isLiked: previousLikeState });
      console.error('Error updating like:', error);
      throw error;
    }
  };

  const addPhotoComment = async (photoId: string, commentText: string, commenterName: string) => {
    const tempComment: Comment = {
      id: `temp-${Date.now()}`,
      author: commenterName,
      text: commentText,
      timestamp: new Date().toLocaleString('de-DE')
    };

    const originalPhoto = photos.find(p => p.id === photoId);
    const previousComments = originalPhoto?.comments || [];

    // Optimistic update
    updatePhoto(photoId, { 
      comments: [...previousComments, tempComment] 
    });

    try {
      const response = await fetch(`/api/photos/${photoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commenterName, text: commentText }),
      });

      if (!response.ok) {
        // Revert on error
        updatePhoto(photoId, { comments: previousComments });
        throw new Error('Failed to add comment');
      }

      const result = await response.json();
      
      // Replace temp comment with real one
      const realComment: Comment = {
        id: result.commentId,
        author: commenterName,
        text: commentText,
        timestamp: new Date().toLocaleString('de-DE')
      };

      updatePhoto(photoId, { 
        comments: [...previousComments, realComment] 
      });
    } catch (error) {
      // Revert on error
      updatePhoto(photoId, { comments: previousComments });
      console.error('Error adding comment:', error);
      throw error;
    }
  };

  const getPhoto = (photoId: string): Photo | undefined => {
    return photos.find(p => p.id === photoId);
  };

  return (
    <PhotoContext.Provider value={{
      photos,
      setPhotos,
      updatePhoto,
      updatePhotoRating,
      updatePhotoLike,
      addPhotoComment,
      getPhoto
    }}>
      {children}
    </PhotoContext.Provider>
  );
}
