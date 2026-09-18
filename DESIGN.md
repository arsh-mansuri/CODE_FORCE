# 🎨 PropVibe Design System & Screen Specification

> **Source of Truth**: Extracted from [Stitch Project `13313655275948398401`](https://stitch.withgoogle.com/projects/13313655275948398401)
> **6 Designed Screens** · Material Design 3 Tokens · Mobile-First Editorial Aesthetic
> **Last Updated**: September 2026

---

## 1. Design Philosophy

PropVibe uses an **editorial warmth** aesthetic — think Hinge meets Airbnb meets The New York Times real estate section. The design language is warm, tactile, and intentionally **not generic tech-purple**. It uses terracotta primaries, sage-green secondary accents, and serif editorial headlines mixed with geometric sans-serif body text.

### Core Principles
- **Warm, Not Cold**: Terracotta + cream palette replaces cold blue/purple SaaS defaults
- **Editorial Typography**: Serif (`Newsreader`) for headlines, sans-serif (`Plus Jakarta Sans`) for body — creates magazine-quality hierarchy
- **Material Design 3 Surfaces**: Layered surface containers create depth without heavy shadows
- **Mobile-First**: All screens designed at 780px width (mobile viewport), max-width `480px` container
- **Functional Every Pixel**: Zero placeholder screens — every button, slider, and badge maps to real backend state

---

## 2. Color Palette (Material Design 3 Tokens)

### Primary — Terracotta Family
| Token | Hex | Usage |
|:---|:---|:---|
| `primary` | `#923326` | Text accents, active nav icons, links |
| `primary-container` | `#b24a3b` | CTA buttons, sent message bubbles, match badges |
| `on-primary` | `#ffffff` | Text on primary buttons |
| `on-primary-container` | `#ffe8e4` | Text on primary-container surfaces |
| `primary-fixed` | `#ffdad4` | Hover backgrounds, soft tint fills |
| `primary-fixed-dim` | `#ffb4a8` | Decorative blurred orbs, glow effects |
| `on-primary-fixed` | `#410100` | Deep contrast text on fixed primary |
| `on-primary-fixed-variant` | `#82271b` | Muted variant text |
| `surface-tint` | `#a13e30` | Surface tint overlay |
| `inverse-primary` | `#ffb4a8` | Inverse surface contexts |

### Secondary — Sage Green Family
| Token | Hex | Usage |
|:---|:---|:---|
| `secondary` | `#2a6a48` | Verified badges, match score positive, active indicators |
| `secondary-container` | `#aceec4` | Match compatibility pill backgrounds |
| `on-secondary` | `#ffffff` | Text on secondary surfaces |
| `on-secondary-container` | `#2f6e4c` | Text on secondary-container |
| `secondary-fixed` | `#aff1c6` | Decorative glow orbs in celebration screen |
| `secondary-fixed-dim` | `#93d5ac` | Muted secondary tint |
| `on-secondary-fixed` | `#002111` | Deep secondary text |
| `on-secondary-fixed-variant` | `#0a5132` | Variant secondary text |

### Tertiary — Warm Neutral Family
| Token | Hex | Usage |
|:---|:---|:---|
| `tertiary` | `#55534d` | Subdued metadata text |
| `tertiary-container` | `#6e6b65` | Neutral badge backgrounds |
| `on-tertiary` | `#ffffff` | Text on tertiary surfaces |
| `on-tertiary-container` | `#f1ece4` | Text on tertiary-container |
| `tertiary-fixed` | `#e7e2da` | Soft background fill |
| `tertiary-fixed-dim` | `#cac6be` | Dimmed tertiary |
| `on-tertiary-fixed` | `#1d1c17` | Deep neutral text |
| `on-tertiary-fixed-variant` | `#494741` | Muted variant |

### Surface System (Layered Depth)
| Token | Hex | Usage |
|:---|:---|:---|
| `background` / `surface` | `#fff8f5` | Page background — warm off-white |
| `surface-bright` | `#fff8f5` | Same as surface for light mode |
| `surface-dim` | `#e3d8d1` | Pressed/disabled states |
| `surface-container-lowest` | `#ffffff` | Cards, modals, nav bars — pure white |
| `surface-container-low` | `#fdf1eb` | Secondary cards, bento cells |
| `surface-container` | `#f7ece5` | Hover states, filters |
| `surface-container-high` | `#f1e6df` | Active surfaces |
| `surface-container-highest` | `#ebe0da` | Highest elevation |
| `surface-variant` | `#ebe0da` | Dividers, borders |
| `on-surface` | `#201b17` | Primary text — near-black warm |
| `on-surface-variant` | `#56423f` | Secondary text — muted brown |
| `on-background` | `#201b17` | Body text on background |

### Outline & Border
| Token | Hex | Usage |
|:---|:---|:---|
| `outline` | `#8a726e` | Prominent borders, input focus rings |
| `outline-variant` | `#ddc0bb` | Subtle card borders (used at `/60`, `/70` opacity) |

### Error
| Token | Hex | Usage |
|:---|:---|:---|
| `error` | `#ba1a1a` | Error states, destructive actions |
| `error-container` | `#ffdad6` | Error background |
| `on-error` | `#ffffff` | Text on error |
| `on-error-container` | `#93000a` | Text on error-container |

### Inverse (Dark Overlays)
| Token | Hex | Usage |
|:---|:---|:---|
| `inverse-surface` | `#352f2b` | Dark overlays, image tags |
| `inverse-on-surface` | `#faefe8` | Text on dark overlays |

---

## 3. Typography Scale

### Typefaces
- **Headlines & Display**: `Newsreader` (variable weight 300–700, optical size 6–72, italic support) — Serif editorial feel
- **Body, Labels & UI**: `Plus Jakarta Sans` (weights 400–700, italic support) — Clean geometric sans-serif

### Type Ramp

| Token | Font | Size | Line Height | Letter Spacing | Weight | Usage |
|:---|:---|:---|:---|:---|:---|:---|
| `display-lg` | Newsreader | 40px | 48px | -0.02em | 500 | Hero headlines (desktop) |
| `display-lg-mobile` | Newsreader | 32px | 40px | -0.02em | 500 | Hero headlines (mobile) |
| `headline-lg` | Newsreader | 30px | 38px | -0.015em | 500 | Section titles (desktop) |
| `headline-lg-mobile` | Newsreader | 24px | 32px | -0.01em | 500 | Profile names, card titles |
| `headline-md` | Newsreader | 22px | 30px | — | 400 | Prompt text, quotes |
| `headline-sm` | Newsreader | 18px | 26px | — | 500 | Sub-headers, chat names |
| `body-lg` | Plus Jakarta Sans | 17px | 26px | — | 400 | Long-form text |
| `body-md` | Plus Jakarta Sans | 15px | 22px | — | 400 | Body copy, messages |
| `body-sm` | Plus Jakarta Sans | 13px | 18px | — | 400 | Metadata, descriptions |
| `label-lg` | Plus Jakarta Sans | 14px | 20px | 0.01em | 600 | Button labels, nav text |
| `label-md` | Plus Jakarta Sans | 12px | 16px | 0.02em | 600 | Chip text, badges |
| `label-sm` | Plus Jakarta Sans | 11px | 14px | 0.03em | 600 | Timestamps, captions, nav |

---

## 4. Spacing & Layout System

### Spacing Tokens
| Token | Value | Usage |
|:---|:---|:---|
| `space-xs` | 4px (0.25rem) | Tight gaps, icon-to-text |
| `space-sm` | 8px (0.5rem) | Compact padding, chip gaps |
| `space-md` | 16px (1rem) | Card padding, section spacing |
| `space-lg` | 24px (1.5rem) | Generous card padding |
| `space-xl` | 36px (2.25rem) | Section dividers |

### Margin Tokens (Content Insets)
| Token | Value | Breakpoint |
|:---|:---|:---|
| `margin-mobile` | 20px (1.25rem) | < 768px |
| `margin-tablet` | 32px (2rem) | 768px–1024px |
| `margin-desktop` | 48px (3rem) | > 1024px |

### Gutter Tokens (Grid Gaps)
| Token | Value | Breakpoint |
|:---|:---|:---|
| `gutter-mobile` | 12px (0.75rem) | < 768px |
| `gutter-tablet` | 20px (1.25rem) | 768px–1024px |
| `gutter-desktop` | 24px (1.5rem) | > 1024px |
| `gutter` | 16px (1rem) | Default |

### Layout
- **Max content width**: `max-w-md` (480px) — mobile-first container
- **Bottom nav height**: 56px (h-14)
- **Top app bar height**: 56px (h-14)
- **Bottom action bar clearance**: `pb-36` (144px) to account for action bar + nav
- **Body minimum height**: `max(884px, 100dvh)`

### Border Radius
| Token | Value | Usage |
|:---|:---|:---|
| `DEFAULT` | 4px (0.25rem) | Tags, small badges |
| `lg` | 8px (0.5rem) | Bento cells, inner cards |
| `xl` | 12px (0.75rem) | Primary cards, modals |
| `full` | 9999px | Buttons, pills, avatars |

---

## 5. Icon System

**Material Symbols Outlined** with variable font settings:
```css
font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
```

### Key Icons by Feature
| Context | Icon Name | Fill? | Size |
|:---|:---|:---|:---|
| Match / Like | `favorite` | FILL 1 | 20–24px |
| Verified User | `verified_user` / `verified` | FILL 1 | 16–18px |
| Location | `near_me` / `location_on` | — | 20px |
| Filter | `tune` | — | 22px |
| Chat | `chat_bubble` / `mode_comment` | FILL 1 | 18px |
| Send | `send` | FILL 1 | 20px |
| Close | `close` | — | 24px |
| Back | `arrow_back` | — | 22px |
| Calendar | `calendar_month` | — | 20px |
| Money | `payments` | — | 13–20px |
| Cleanliness | `cleaning_services` / `sparkles` | — | 13px |
| Sleep | `wb_sunny` | — | 13–14px |
| Work | `laptop_mac` | — | 13px |
| TrueCost | `calculate` | — | 16px |
| Bolt (match energy) | `bolt` | FILL 1 | 18px |
| Shield | `shield_with_heart` | FILL 1 | 14px |
| Check | `check_circle` / `done_all` | FILL 1 | 14px |
| Star Rating | `star` | FILL 1 | 14px |
| Balance | `balance` | — | 16px |
| Call | `call` | — | 20px |
| More | `more_vert` | — | 20px |
| Add | `add_circle` | — | 24px |
| Mic | `mic` | — | 20px |
| Apartment | `apartment` | — | 22px |
| Person | `person` | — | 22px |
| Task | `task_alt` | — | 14px |

---

## 6. Component Specifications

### 6.1 Bottom Navigation Bar
```
Position: fixed bottom-0, z-50
Background: surface-container-lowest, shadow-md
Height: 56px (h-14)
Max Width: max-w-md, mx-auto
Layout: flex justify-around items-center

4 Destinations:
  1. Match    — icon: favorite (FILL 1)    — active: text-primary, font-bold
  2. Explore  — icon: apartment             — inactive: text-on-surface-variant
  3. Reviews  — icon: verified_user          — inactive: text-on-surface-variant
  4. Profile  — icon: person                 — inactive: text-on-surface-variant

Each destination: flex flex-col items-center gap-0.5
Active state: text-primary, font-bold
Hover: hover:text-primary transition-colors
Press: active:scale-90 transition-transform duration-100
Label: font-label-sm text-label-sm
```

### 6.2 Top App Bar
```
Position: sticky top-0, z-40
Background: surface-container-lowest/90 backdrop-blur-md
Border: shadow-sm (Discovery) | border-b border-surface-variant (Chat)
Height: 56px (h-14)
Padding: px-margin-mobile

Content varies by screen:
  - Discovery: Location label (Newsreader headline-sm) + Filter button
  - Chat: Back button + Avatar (40px) + Name + Status + Action icons
```

### 6.3 Profile Discovery Card (Editorial)
```
Container: bg-surface-container-lowest, border border-outline-variant/60, rounded-xl, p-space-md, shadow-sm

Header Section:
  - Name: headline-lg-mobile (Newsreader), tracking-tight
  - Verified badge: verified_user (FILL 1) in text-secondary, 18px
  - Subtitle: body-md, text-on-surface-variant
  - Compatibility badge: pill shape, bg-secondary-container/40, border-secondary/25
    - Heart icon 14px + "94% Match" in label-sm, text-secondary, font-bold

Lifestyle Chips (below divider):
  - Container: flex flex-wrap gap-1.5, mt-3.5, pt-3, border-t border-outline-variant/40
  - Each chip: inline-flex, px-2.5 py-1, rounded-full
  - Background: bg-surface-container-low, border border-outline-variant/60
  - Font: label-md
  - Icon: material-symbols 13px, colored per category (primary/secondary/tertiary)
  - Budget chip: special style — bg-primary-container/10, border-primary-container/30, text-primary
```

### 6.4 Editorial Photo Card
```
Container: relative, rounded-xl, overflow-hidden, border border-outline-variant/70, shadow-sm
Image: w-full aspect-[4/5] (portrait) or aspect-[4/3] (landscape), object-cover
Gradient overlay: absolute inset-0, bg-gradient-to-t from-black/40 via-transparent to-transparent

Bottom-left tag: absolute, bg-surface-container-lowest/90 backdrop-blur-md
  - px-2.5 py-1, rounded-full, border border-outline-variant/50
  - Text: label-sm

Floating like button: absolute bottom-3 right-3
  - w-11 h-11 (portrait) or w-10 h-10 (landscape)
  - rounded-full, bg-surface-container-lowest, shadow-md, border border-outline-variant/70
  - Icon: favorite (FILL 1), text-primary
  - Interaction: active:scale-90 transition-transform duration-100
```

### 6.5 Hinge-Style Prompt Card
```
Container: bg-surface-container-lowest, border border-outline-variant/70, rounded-xl, p-space-lg, shadow-sm
Layout: relative, pr-10 (space for like button)

Prompt label: label-sm, text-on-surface-variant, uppercase, tracking-wider, mb-2
Prompt text: headline-md (Newsreader), text-on-surface, leading-snug, wrapped in quotes

Like button: absolute bottom-4 right-4
  - w-9 h-9, rounded-full, bg-surface-bright, border border-outline-variant/80
  - Icon: favorite, text-primary, 18px (outline, not filled)
  - Hover: hover:border-primary-container
  - Press: active:scale-90 transition-all duration-100
```

### 6.6 Bento Info Grid
```
Container: grid grid-cols-2 gap-3

Each cell:
  - bg-surface-container-lowest, border border-outline-variant/70, rounded-xl, p-space-md
  - Icon: material-symbols 20px (primary or secondary colored)
  - Label: label-sm, text-on-surface-variant, uppercase, mt-1
  - Value: body-md, text-on-surface, font-semibold, mt-0.5
  - Subtitle: body-sm, text-tertiary
```

### 6.7 Sticky Action Bar (Discovery)
```
Position: fixed bottom-14 (above bottom nav), z-40
Container: pointer-events-none → inner pointer-events-auto
Max Width: max-w-md mx-auto, px-margin-mobile py-2
Layout: flex items-center justify-between

Left — Pass Button:
  - w-12 h-12, rounded-full, bg-surface-container-lowest, shadow-md
  - border border-outline-variant, text-on-surface
  - Icon: close, 24px

Center — Comment/Connect:
  - h-12, px-5, rounded-full, bg-surface-container-lowest, shadow-md
  - border border-outline-variant/80
  - Icon: mode_comment (text-primary, 18px) + label-lg text

Right — Like/Match:
  - w-12 h-12, rounded-full, bg-primary-container, text-on-primary, shadow-md
  - Icon: favorite (FILL 1), 24px
```

### 6.8 Match Celebration Modal
```
Container: max-w-md, bg-surface-container-low, rounded-xl (sm+), shadow-2xl
  - Fullscreen on mobile, rounded modal on tablet+

Decorative orbs:
  - Top-left: w-64 h-64, bg-primary-fixed, rounded-full, blur-3xl, opacity-40
  - Top-right: w-60 h-60, bg-secondary-fixed, rounded-full, blur-3xl, opacity-30

Header: Compatibility pill (bg-secondary-container) + Close button (9×9 circle)

Avatar Section:
  - Two overlapping circular avatars (w-24 h-24 mobile, w-28 h-28 sm)
  - Border: 2px border-primary-container, p-1 white ring
  - Central heart badge: w-11 h-11 circle, bg-surface-container-lowest
  - "94% VIBE" pill below: bg-primary-container, text-on-primary-container, 10px bold

Lifestyle Grid: 2×2 bento grid showing shared habits (see §6.6)

Icebreaker Prompts: Tappable buttons with emoji + text, hover:bg-surface-container

Footer Actions:
  - Primary CTA: w-full h-12 rounded-full bg-primary-container → "Send a Message"
  - Secondary CTA: w-full h-11 rounded-full border-1.5 → "Run Rent Harmony Split"
  - Text link: "Keep exploring matches" (underline, label-sm)
```

### 6.9 Chat Interface
```
Header: Sticky, avatar (40px) + name + verified badge + status + Call/More icons

Pinned Context Banner:
  - bg-surface-container-low, rounded-xl, p-3.5, border border-outline-variant/50
  - Compatibility score, shared habits summary
  - Quick action pills (scrollable): "View TrueCost 2BR", "Calculate Rent Split", "Verified Stays"

Suggested Chips:
  - Horizontal scroll row, rounded-full pills
  - bg-surface-container-lowest, border border-outline-variant
  - Hover: bg-primary-fixed border-primary

Message Bubbles:
  - Incoming: bg-surface-container-lowest, rounded-2xl rounded-bl-sm, border border-outline-variant/50
    - Avatar: 28px circle, left side
    - Timestamp below: label-sm, text-on-surface-variant/70
  - Outgoing: bg-primary-container, text-on-primary-container, rounded-2xl rounded-br-sm
    - Read receipt: done_all (FILL 1, text-primary) + timestamp
  - Max width: 85% (text) / 90% (with rich card)

Rich Shared Listing Card (inside bubble):
  - rounded-xl, border border-outline-variant/60
  - Image: h-32, bg-cover
  - Price tag: absolute bottom-right on image
  - Title + location below image

Input Bar:
  - Fixed above bottom nav (bottom-14), z-40
  - bg-surface-container-lowest/95 backdrop-blur-md
  - Attach button (add_circle) + Text input (rounded-full, h-11) + Mic button + Send button
  - Send: w-11 h-11 rounded-full bg-primary text-on-primary
```

### 6.10 TrueCost Hub (Property Detail)
```
Hero: Full-width image with gradient overlay + price/type badge
Property header: Newsreader headline, address, verified badge

TrueCost Score Card:
  - Large circular score display
  - Breakdown bars for: Base Rent, Utilities, Maintenance, Hidden Fees

Landlord Responsiveness Section:
  - Star rating (secondary colored, FILL 1)
  - Response time badge
  - Metric pills in bento grid

Cost Breakdown Table:
  - Alternating bg-surface-container-low rows
  - Green checkmarks for transparent items
  - Red flags for hidden fees

Lease Risk Scanner:
  - Risk chips: high (error), medium (primary), info (secondary)
  - Expandable clause cards
```

### 6.11 Verified Stay Reviews
```
Overall Rating Header:
  - Large score display with star breakdown
  - Category ratings in horizontal bars

Review Cards:
  - Avatar + Name + Verified badge + Date
  - Star rating inline
  - Review text in body-md
  - Helpful/Flag action pills

Filter Chips:
  - Horizontal scroll: "All", "Positive", "Critical", "Landlord Response"
  - Active: bg-primary-container text-on-primary
```

### 6.12 Submit Flag Form
```
Category Selection:
  - Illustrated icon cards in grid
  - Categories: Safety, Noise, Maintenance, Lease Issue, Other

Detail Form:
  - Textarea with character count
  - Photo upload zone (dashed border)
  - Anonymous toggle

Submit CTA:
  - Full-width rounded-full primary button
  - Confirmation modal on success
```

---

## 7. Interaction & Animation Patterns

### Micro-Interactions
| Element | Trigger | Animation |
|:---|:---|:---|
| All buttons | Press | `active:scale-90` or `active:scale-95`, `duration-100` |
| Nav items | Hover | `hover:text-primary transition-colors duration-150` |
| Like buttons | Press | `active:scale-90 transition-transform duration-100` |
| Cards | Hover | `hover:bg-surface-container transition-colors` |
| Prompt taps | Click | Flash border to `#b24a3b` for 400ms |
| Icebreaker tap | Click | Border flash + `active:scale-[0.99]` |

### Transitions
- Color transitions: `transition-colors duration-150`
- Transform transitions: `transition-transform duration-100`
- Combined: `transition-all duration-150`
- Backdrop blur: `backdrop-blur-md` on headers and input bars
- Opacity on overlays: `opacity-90` / `opacity-95`

### Match Celebration (Future Canvas Confetti)
- Trigger: On mutual match detection
- Duration: 3 seconds burst
- Colors: primary (`#923326`), secondary (`#2a6a48`), primary-fixed (`#ffdad4`)

---

## 8. Screen → Component → File Mapping

| Screen | Component Directory | Key Components |
|:---|:---|:---|
| **Roommate Discovery** | `components/discovery/` | `DiscoveryFeed`, `ProfileCard`, `PhotoCard`, `PromptCard`, `BentoGrid`, `LifestyleChips`, `ActionBar` |
| **Mutual Match** | `components/discovery/` | `MatchCelebration`, `CompatibilityGrid`, `IcebreakerPrompts` |
| **Chat** | `components/discovery/` | `ChatView`, `MessageBubble`, `ContextBanner`, `SuggestedChips`, `ListingCard`, `ChatInput` |
| **TrueCost Hub** | `components/truecost/` | `TrueCostHub`, `CostBreakdown`, `LeaseRiskScanner`, `LandlordScore` |
| **Verified Reviews** | `components/reviews/` | `ReviewsFeed`, `ReviewCard`, `RatingBar`, `FilterChips` |
| **Submit Flag** | `components/reviews/` | `SubmitFlag`, `CategoryGrid`, `FlagForm` |
| **Shared Layout** | `components/layout/` | `TopAppBar`, `BottomNav`, `Container` |
| **Auth** | `components/auth/` | `LoginForm`, `SignupFlow` |
| **Profile** | `components/profile/` | `ProfileView`, `EditProfile` |
| **Rent Harmony** | `components/harmony/` | `RentSliders`, `EnvyFreeResult`, `RoomCards` |

---

## 9. Responsive Behavior

| Breakpoint | Container | Margin | Gutter | Typography |
|:---|:---|:---|:---|:---|
| **< 768px** | `max-w-md` (480px) | 20px | 12px | `display-lg-mobile`, `headline-lg-mobile` |
| **768–1024px** | `max-w-md` | 32px | 20px | Desktop type ramp |
| **> 1024px** | `max-w-md` centered | 48px | 24px | Full desktop ramp |

The app is **mobile-native** — the max-w-md container is always centered. On desktop, the app appears as a centered phone-sized column with the warm `#fff8f5` background extending to full viewport.

---

## 10. CSS Custom Properties (Vanilla CSS Mapping)

When implementing in Vanilla CSS (not Tailwind), map these tokens as CSS custom properties:

```css
:root {
  /* Primary */
  --color-primary: #923326;
  --color-primary-container: #b24a3b;
  --color-on-primary: #ffffff;
  --color-on-primary-container: #ffe8e4;
  --color-primary-fixed: #ffdad4;
  --color-primary-fixed-dim: #ffb4a8;

  /* Secondary */
  --color-secondary: #2a6a48;
  --color-secondary-container: #aceec4;
  --color-on-secondary: #ffffff;
  --color-on-secondary-container: #2f6e4c;

  /* Tertiary */
  --color-tertiary: #55534d;
  --color-tertiary-container: #6e6b65;

  /* Surface */
  --color-surface: #fff8f5;
  --color-surface-container-lowest: #ffffff;
  --color-surface-container-low: #fdf1eb;
  --color-surface-container: #f7ece5;
  --color-surface-container-high: #f1e6df;
  --color-surface-container-highest: #ebe0da;
  --color-surface-variant: #ebe0da;
  --color-surface-dim: #e3d8d1;

  /* On Surface */
  --color-on-surface: #201b17;
  --color-on-surface-variant: #56423f;
  --color-on-background: #201b17;

  /* Outline */
  --color-outline: #8a726e;
  --color-outline-variant: #ddc0bb;

  /* Error */
  --color-error: #ba1a1a;
  --color-error-container: #ffdad6;

  /* Inverse */
  --color-inverse-surface: #352f2b;
  --color-inverse-on-surface: #faefe8;

  /* Typography */
  --font-serif: 'Newsreader', Georgia, 'Times New Roman', serif;
  --font-sans: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;

  /* Spacing */
  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2.25rem;
  --margin-mobile: 1.25rem;
  --margin-tablet: 2rem;
  --margin-desktop: 3rem;

  /* Radii */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-full: 9999px;
}
```

---

## 11. Google Fonts Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300..700;1,6..72,300..700&family=Plus+Jakarta+Sans:ital,wght@0,400..700;1,400..700&display=swap" rel="stylesheet" />
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
```

---

## 12. Stitch Screen Reference Links

| # | Screen Title | Dimensions | Device |
|:---|:---|:---|:---|
| 1 | Roommate Discovery | 780 × 3906 | Mobile |
| 2 | Mutual Match Celebration | 780 × 2022 | Mobile |
| 3 | Roommate Chat with Elena | 780 × 2510 | Mobile |
| 4 | Property TrueCost Hub | 780 × 4096 | Mobile |
| 5 | Verified Stay Reviews & Flags | 780 × 4274 | Mobile |
| 6 | Submit Verified Flag | 780 × 3288 | Mobile |

**Stitch Project**: [`stitch.withgoogle.com/projects/13313655275948398401`](https://stitch.withgoogle.com/projects/13313655275948398401)

---

## 13. Implementation Priority (Hackathon)

### Phase 1 — Core Demo (Hours 1–8)
1. `BottomNav` + `TopAppBar` (shared layout shell)
2. `DiscoveryFeed` with `ProfileCard` + `LifestyleChips` + `ActionBar`
3. `MatchCelebration` modal with confetti
4. `RentSliders` (Sperner engine visualization)

### Phase 2 — Polish (Hours 9–16)
5. `ChatView` with `MessageBubble` + `ContextBanner`
6. `PhotoCard` with editorial image treatment
7. `PromptCard` (Hinge-style)
8. `BentoGrid` for details

### Phase 3 — Differentiation (Hours 17–24)
9. `TrueCostHub` with `CostBreakdown`
10. `ReviewsFeed` + `SubmitFlag`
11. `LeaseRiskScanner` (AI integration)
12. Dark mode toggle (M3 dark scheme)
