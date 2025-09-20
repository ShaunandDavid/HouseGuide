# Overview

HouseGuide is a Progressive Web Application (PWA) designed for residential care facility management. The application enables staff to scan documents using on-device OCR technology (Tesseract.js), automatically classify them as either commitments or write-ups, store files per resident, and generate structured weekly reports with user-controlled note categorization. The system is built with a React frontend and Express backend, utilizing Drizzle ORM with PostgreSQL for data persistence.

## Recent Critical Fixes (September 2025)

### Category System Production Fix
**Issue**: Critical bug where user-selected note categories were being saved as "general" instead of the chosen category (work_school, demeanor, sponsor, medical, chores), breaking the automated report generation system.

**Root Cause**: Two separate note creation flows existed:
- Quick Note modal (missing category selection entirely) 
- Regular Notes section (had category selection)

**Solution**: 
- Added full category selection system to QuickNoteModal component
- Ensured both note creation paths have identical functionality
- Removed premature frontend defaulting to "general"
- Applied production security by removing debug logs containing sensitive content

**Impact**: System now correctly preserves user-selected categories for accurate report section placement, critical for the $20M commercial deployment targeting 18,000+ sober living businesses.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for client-side routing with page-based organization
- **State Management**: React Query (@tanstack/react-query) for server state management
- **UI Components**: Shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **PWA Features**: Service worker registration for offline capabilities and app installation

## Backend Architecture
- **Runtime**: Node.js with Express framework
- **Language**: TypeScript with ES modules
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Storage**: In-memory storage implementation with interface for extensibility
- **Development**: Vite middleware integration for hot module replacement

## Data Storage Solutions
- **ORM**: Drizzle Kit for database schema management and migrations
- **Database Provider**: Neon Database (@neondatabase/serverless) for serverless PostgreSQL
- **Schema Organization**: Shared schema definitions between client and server using Zod for validation
- **File Storage**: Configured for Google Cloud Storage integration (@google-cloud/storage)

## Authentication and Authorization
- **Authentication**: Custom authentication system with email/password
- **Session Management**: Cookie-based session handling
- **User Model**: Guide (staff) authentication with role-based access patterns
- **Security**: CORS configuration and secure cookie practices

## External Dependencies

### Core Technologies
- **React Ecosystem**: React 18+ with modern hooks and concurrent features
- **Database**: PostgreSQL via Neon serverless platform
- **ORM**: Drizzle with PostgreSQL dialect for type-safe database operations
- **Build Tools**: Vite for fast development and optimized production builds

### UI and Styling
- **Component Library**: Radix UI primitives for accessible, unstyled components
- **Styling Framework**: Tailwind CSS with custom design system
- **Icons**: Lucide React for consistent iconography
- **Fonts**: Inter font family from Google Fonts

### Document Processing
- **OCR Engine**: Tesseract.js for client-side optical character recognition
- **File Upload**: Uppy.js for file handling and upload management
- **Image Processing**: Browser-native Canvas API for image manipulation

### Development and Deployment
- **Runtime**: Node.js with Express for server-side operations
- **Package Manager**: npm with lockfile for dependency management
- **Development Environment**: Replit-specific plugins for enhanced development experience
- **Monitoring**: Custom logging and error handling middleware

### PWA Infrastructure
- **Service Worker**: Custom implementation for caching and offline functionality
- **Web App Manifest**: Configured for Android installation capabilities
- **Responsive Design**: Mobile-first approach with touch-optimized interactions