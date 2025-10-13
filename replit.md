# Photo Gallery Application

## Overview

A modern photo gallery application built with React and Express, featuring image display, rating systems, comments, and user authentication. The application follows a utility-focused design approach with support for both light and dark themes, emphasizing clean UI and efficient user interactions.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**React-based SPA**: Built with React 18 using TypeScript, leveraging Vite as the build tool and development server. The application uses a component-based architecture with custom UI components built on top of Radix UI primitives.

**State Management**: Uses React's built-in state management with Context API for authentication state and TanStack Query for server state management and caching.

**UI Framework**: Implements a custom design system based on shadcn/ui components with Tailwind CSS for styling. The design follows Material Design principles with a utility-focused approach, supporting both light and dark themes through CSS custom properties.

**Component Structure**:
- Gallery components for photo display and navigation
- Lightbox modal for full-screen photo viewing
- Authentication components for user login
- Selection panel for batch operations
- Breadcrumb navigation for gallery hierarchy

### Backend Architecture

**Express.js Server**: RESTful API server with middleware for JSON parsing, logging, and error handling. The server structure is modular with separate route handlers and storage interfaces.

**Storage Interface**: Abstracted storage layer with in-memory implementation for development. The interface supports CRUD operations for users and can be easily extended for photo management.

**Development Setup**: Integrated with Vite for hot module replacement in development, with production builds served as static files.

### Database Design

**Drizzle ORM**: Database schema management using Drizzle ORM with PostgreSQL dialect. Current schema includes user management with plans for photo, gallery, and comment entities.

**Schema Structure**:
- Users table with authentication fields
- Prepared for photo metadata storage
- Comment system integration ready

### Authentication System

**Mock Authentication**: Currently implements a mock authentication system through React Context, providing user session management and gallery access control. Ready for integration with real authentication providers.

**Session Management**: User state persistence across application navigation with logout functionality and protected route concepts.

### Design System

**Theme Support**: Comprehensive light/dark theme system using CSS custom properties and Tailwind CSS classes. Theme switching persists to localStorage with system preference detection.

**Color Palette**: Carefully designed color system with semantic color tokens for different UI states (primary, secondary, destructive, muted, accent) that adapt to both light and dark themes.

**Typography**: Uses Inter font from Google Fonts with defined weight scales and size hierarchies for headings, body text, and UI elements.

**Component Variants**: Consistent button styles, card layouts, and interactive elements with hover and active states following elevation principles.

## External Dependencies

### Core Framework Dependencies
- **React 18** with TypeScript for component development
- **Express.js** for backend API server
- **Vite** for build tooling and development server

### UI and Styling
- **Tailwind CSS** for utility-first styling approach
- **Radix UI** component primitives for accessible UI components
- **shadcn/ui** design system implementation
- **Lucide React** for consistent iconography

### State Management and Data Fetching
- **TanStack React Query** for server state management and caching
- **React Hook Form** with resolvers for form validation

### Database and ORM
- **Drizzle ORM** for type-safe database operations
- **Drizzle Kit** for schema migrations and management
- **Neon Database Serverless** driver for PostgreSQL connectivity

### Development and Build Tools
- **TypeScript** for type safety across frontend and backend
- **ESBuild** for production backend bundling
- **PostCSS** with Autoprefixer for CSS processing

### Utility Libraries
- **clsx** and **tailwind-merge** for conditional class name handling
- **class-variance-authority** for component variant management
- **date-fns** for date formatting and manipulation
- **nanoid** for unique identifier generation