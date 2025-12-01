# ZeroPrompt Assets Directory

This directory contains all static assets for the ZeroPrompt landing page and application.

## Directory Structure

```
assets/
├── images/          # General images and backgrounds
├── logos/           # Brand logos (ZeroPrompt + partners)
├── icons/           # App icons and favicons
└── screenshots/     # App screenshots and mockups
```

---

## Required Assets with Specifications

### 1. LOGOS (`/logos/`)

#### `zeroprompt-logo.png` / `zeroprompt-logo.svg`
- **Dimensions:** 200x200px (square)
- **Format:** PNG with transparency + SVG
- **Content:** ZeroPrompt logo icon (lightning bolt / Zap in green square)
- **Colors:**
  - Background: `#00FF41` (Neon Green)
  - Icon: `#000000` (Black)
- **Usage:** Navbar, footer, favicon base

#### `zeroprompt-logo-full.png`
- **Dimensions:** 400x100px
- **Format:** PNG with transparency
- **Content:** Full logo with "ZeroPrompt" text
- **Colors:**
  - Icon: `#00FF41`
  - Text: `#FFFFFF`
- **Usage:** Header, marketing materials

#### `partner-openai.svg`
- **Dimensions:** 120x40px
- **Format:** SVG (grayscale)
- **Content:** OpenAI logo
- **Usage:** "Powered by" section

#### `partner-anthropic.svg`
- **Dimensions:** 120x40px
- **Format:** SVG (grayscale)
- **Content:** Anthropic logo
- **Usage:** "Powered by" section

#### `partner-google.svg`
- **Dimensions:** 120x40px
- **Format:** SVG (grayscale)
- **Content:** Google AI logo
- **Usage:** "Powered by" section

#### `partner-meta.svg`
- **Dimensions:** 120x40px
- **Format:** SVG (grayscale)
- **Content:** Meta AI logo
- **Usage:** "Powered by" section

#### `partner-avalanche.svg`
- **Dimensions:** 120x40px
- **Format:** SVG (grayscale)
- **Content:** Avalanche logo
- **Usage:** "Powered by" section, Web3 section

---

### 2. SCREENSHOTS (`/screenshots/`)

#### `hero-mockup.png`
- **Dimensions:** 2000x1200px
- **Format:** PNG or WebP
- **Content:**
  - Dark themed screenshot/mockup of ZeroPrompt chat interface
  - Split screen showing multiple AI model responses
  - Visible elements: model selector, chat bubbles, streaming indicators
  - Web3 wallet connection visible in corner
- **Style:**
  - Floating 3D perspective (10-15 degree tilt)
  - Subtle green glow/reflection underneath
  - Glass morphism effects on cards
  - Matrix/code elements in background (subtle)
- **Colors:**
  - Background: `#000000`
  - Primary accent: `#00FF41`
  - Surfaces: `#0A0A0A`, `#111111`
  - Text: `#FFFFFF`, `#A0A0A0`

#### `feature-comparison.png`
- **Dimensions:** 1200x1000px
- **Format:** PNG
- **Content:**
  - UI showing model comparison feature
  - 3-4 different AI responses side by side (GPT-4, Claude, Gemini, etc.)
  - Different response styles highlighted
  - Tab navigation visible
  - Streaming indicators showing live updates
- **Style:**
  - Clean, modern card layout
  - Green accent highlights on active elements
- **Colors:**
  - Background: `#0A0A0A`
  - Cards: `#111111`
  - Active border: `#00FF41`

#### `feature-chat.png`
- **Dimensions:** 600x400px
- **Format:** PNG
- **Content:**
  - Clean chat interface screenshot
  - User and AI message bubbles
  - Code block with syntax highlighting
  - Copy button visible
- **Style:** Dark theme with green accents

#### `feature-reasoning.png`
- **Dimensions:** 600x400px
- **Format:** PNG
- **Content:**
  - Thinking/reasoning model interface
  - Expandable accordion showing chain of thought
  - Purple accent for reasoning section
  - Model thinking indicator
- **Colors:**
  - Reasoning accent: `#8B5CF6` (Cyber Purple)

#### `feature-vision.png`
- **Dimensions:** 600x400px
- **Format:** PNG
- **Content:**
  - Image upload interface
  - Image preview with subtle overlay
  - AI analysis text alongside image
  - Drag-drop zone visible

#### `feature-imagegen.png`
- **Dimensions:** 600x400px
- **Format:** PNG
- **Content:**
  - Image generation results
  - Prompt input visible at top
  - 2-4 generated images in grid
  - Download/open buttons on each image
- **Colors:**
  - Image gen accent: `#E91E63` (Hot Pink)

#### `feature-websearch.png`
- **Dimensions:** 600x400px
- **Format:** PNG
- **Content:**
  - Response with web search results
  - Source citations with links
  - "LIVE" indicator badge
  - Link previews/cards
- **Colors:**
  - Web search accent: `#FF6B00` (Orange)

#### `wallet-integration.png`
- **Dimensions:** 800x500px
- **Format:** PNG
- **Content:**
  - Wallet connection modal/flow
  - MetaMask and Coinbase Wallet buttons
  - AVAX balance display
  - Transaction confirmation UI
  - Usage stats mini-dashboard
- **Style:**
  - Glass morphism cards
  - Floating elements
- **Colors:**
  - Primary: `#00FF41`
  - Avalanche red (subtle): `#E84142`

#### `step-01-model-selection.png`
- **Dimensions:** 400x300px
- **Format:** PNG
- **Content:**
  - Model selector dropdown open
  - Grid of model cards visible
  - Category filters (Chat, Image, Thinking)
  - Search bar at top
  - "FREE" badges on some models
- **Style:**
  - Dark theme (#0A0A0A bg)
  - Green highlight on selected model
  - Clean, organized layout
- **Colors:** `#00FF41` accents, `#111111` cards

#### `step-02-wallet-connect.png`
- **Dimensions:** 400x300px
- **Format:** PNG
- **Content:**
  - Wallet connection modal
  - MetaMask & Coinbase Wallet buttons
  - "Or continue with free models" option
  - Security badges/trust indicators
- **Style:**
  - Centered modal with glass morphism
  - Wallet logos prominent
  - Green CTA button
- **Colors:** MetaMask orange, Coinbase blue, `#00FF41` primary

#### `step-03-chat-interface.png`
- **Dimensions:** 400x300px
- **Format:** PNG
- **Content:**
  - Active chat conversation
  - User message bubble (right)
  - AI response streaming (left)
  - Input bar at bottom
  - Model indicator in header
- **Style:**
  - Clean message bubbles
  - Streaming cursor visible
  - Professional dark UI
- **Colors:** User bubble `#00FF41` tint, AI response white text

---

### 3. ICONS (`/icons/`)

#### `favicon.ico`
- **Dimensions:** 32x32px, 16x16px (multi-size)
- **Format:** ICO
- **Content:** ZeroPrompt logo simplified

#### `apple-touch-icon.png`
- **Dimensions:** 180x180px
- **Format:** PNG
- **Content:** ZeroPrompt logo on solid background

#### `icon-192.png`
- **Dimensions:** 192x192px
- **Format:** PNG
- **Content:** PWA icon

#### `icon-512.png`
- **Dimensions:** 512x512px
- **Format:** PNG
- **Content:** PWA icon large

---

### 4. IMAGES (`/images/`)

#### `hero-bg-grid.svg`
- **Dimensions:** Tileable pattern
- **Format:** SVG
- **Content:** Subtle grid pattern for hero background
- **Colors:** `rgba(0, 255, 65, 0.05)` lines on transparent

#### `gradient-green.png`
- **Dimensions:** 800x800px
- **Format:** PNG with transparency
- **Content:** Radial gradient blob
- **Colors:** `#00FF41` center fading to transparent
- **Usage:** Background decoration

#### `gradient-purple.png`
- **Dimensions:** 600x600px
- **Format:** PNG with transparency
- **Content:** Radial gradient blob
- **Colors:** `#8B5CF6` center fading to transparent

#### `gradient-blue.png`
- **Dimensions:** 500x500px
- **Format:** PNG with transparency
- **Content:** Radial gradient blob
- **Colors:** `#00D4FF` center fading to transparent

#### `avatar-1.png`
- **Dimensions:** 80x80px
- **Format:** PNG
- **Content:** Professional headshot (placeholder for testimonial)
- **Style:** Dark background, subtle green tint

#### `avatar-2.png`
- **Dimensions:** 80x80px
- **Format:** PNG
- **Content:** Professional headshot
- **Style:** Dark background, subtle blue tint

#### `avatar-3.png`
- **Dimensions:** 80x80px
- **Format:** PNG
- **Content:** Professional headshot
- **Style:** Dark background, subtle purple tint

---

## Color Reference

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Neon Green | `#00FF41` | rgb(0, 255, 65) | Primary brand, CTAs, accents |
| Neon Green Glow | `rgba(0, 255, 65, 0.4)` | - | Glows, shadows |
| Neon Green Soft | `rgba(0, 255, 65, 0.15)` | - | Backgrounds, badges |
| Electric Blue | `#00D4FF` | rgb(0, 212, 255) | Web3/Tech elements |
| Cyber Purple | `#8B5CF6` | rgb(139, 92, 246) | AI/Premium elements |
| Hot Pink | `#FF006E` | rgb(255, 0, 110) | Urgency, CTAs |
| Gold | `#FFD700` | rgb(255, 215, 0) | Success, ratings |
| Pure Black | `#000000` | rgb(0, 0, 0) | Primary background |
| Almost Black | `#0A0A0A` | rgb(10, 10, 10) | Secondary background |
| Card Background | `#111111` | rgb(17, 17, 17) | Cards, surfaces |
| White | `#FFFFFF` | rgb(255, 255, 255) | Primary text |
| Gray | `#A0A0A0` | rgb(160, 160, 160) | Secondary text |
| Muted | `#666666` | rgb(102, 102, 102) | Muted text |
| Avalanche Red | `#E84142` | rgb(232, 65, 66) | Avalanche branding |

---

## How to Use in Code

```tsx
// Import images
import heroMockup from '../assets/screenshots/hero-mockup.png';
import logo from '../assets/logos/zeroprompt-logo.png';

// Use in Image component
<Image source={heroMockup} style={{ width: '100%', height: 600 }} />

// Or for web with require
<Image source={require('../assets/logos/zeroprompt-logo.png')} />
```

---

## Notes

- All images should be optimized for web (use TinyPNG, ImageOptim, or similar)
- Prefer WebP format for photos when possible (with PNG fallback)
- SVG is preferred for logos and icons
- All images should look good on both light and dark backgrounds (use transparency)
- Screenshots should be taken at 2x resolution for Retina displays
