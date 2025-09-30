# Photo Gallery Design Guidelines

## Design Approach
**Utility-Focused Design System Approach**: This photo gallery application prioritizes functionality and usability over visual flair. Following a clean, minimal design system that emphasizes content (photos) while providing intuitive controls for rating, commenting, and liking.

**Design System**: Material Design principles adapted for lightweight implementation
**Key Principles**: Content-first, minimal UI chrome, efficient interactions, clean typography

## Core Design Elements

### A. Color Palette
**Light Mode:**
- Primary: 216 100% 50% (clean blue for interactive elements)
- Background: 0 0% 98% (soft white)
- Surface: 0 0% 100% (pure white for cards)
- Text Primary: 220 13% 18% (dark slate)
- Text Secondary: 220 9% 46% (medium gray)

**Dark Mode:**
- Primary: 216 100% 60% (slightly lighter blue)
- Background: 222 84% 5% (deep dark)
- Surface: 220 13% 18% (dark gray for cards)
- Text Primary: 210 40% 98% (near white)
- Text Secondary: 220 9% 64% (light gray)

### B. Typography
- **Primary Font**: Inter (Google Fonts CDN)
- **Headings**: 600 weight, scale from text-lg to text-2xl
- **Body**: 400 weight, text-sm to text-base
- **Captions**: 400 weight, text-xs for metadata

### C. Layout System
**Spacing Units**: Tailwind units of 2, 4, 6, and 8 (p-2, m-4, gap-6, h-8)
- Gallery grid: 6-unit gaps between photos
- Card padding: 4-unit internal spacing
- Section margins: 8-unit vertical spacing
- Button padding: 2-unit vertical, 4-unit horizontal

### D. Component Library

**Gallery Grid:**
- Responsive grid (1-6 columns based on screen size)
- Photo cards with subtle shadow and rounded corners
- Hover state with gentle scale transform

**Lightbox:**
- Full-screen overlay with blurred backdrop
- Centered photo with navigation arrows
- Rating stars, comment section, and like button in sidebar/bottom panel
- Clean close button in top-right

**Rating System:**
- 5-star display using star icons (filled/outline)
- Interactive hover states showing partial ratings
- Display average rating with star count

**Comments:**
- Simple text input with submit button
- Comment list with timestamps
- Minimal styling focusing on readability

**Like Button:**
- Heart icon with like counter
- Subtle animation on like/unlike
- Red heart when liked, outline when not

**Navigation:**
- Clean header with app title
- Minimal controls (view toggles if needed)
- Breadcrumb or back navigation in lightbox

### E. Interactions
- **Minimal animations**: Gentle hover effects, smooth transitions (200ms)
- **Photo loading**: Progressive loading with skeleton placeholders
- **State feedback**: Clear visual feedback for likes, ratings, and form submissions

## Images
**Photo Thumbnails**: Application displays user-uploaded photos in a responsive grid. No hero image needed - the photo gallery itself is the primary visual content. Images should be properly cropped to square thumbnails with consistent aspect ratios for grid display.

**Demo Images**: Include 3 sample landscape/portrait photos showing different compositions to demonstrate the gallery functionality.

This design emphasizes the photos as the primary content while providing clean, accessible controls for the interactive features (rating, commenting, liking) without visual distraction.