# 🥚 Screen Migration Checklist - tami·draft UI

This document tracks the migration of all screens to the new tami·draft design system.

## ✅ Completed Screens (4/15+ screens - 27%)

### 1. Dashboard (`apps/mobile/app/(tabs)/index.tsx`) ✓✓✓
- [x] Uses InitialsAvatar with role colors
- [x] Uses HappinessMeter
- [x] Uses ModeToggle
- [x] Uses FilterPill components
- [x] Uses SegmentTab components
- [x] Uses StatLabel for stats
- [x] All text is lowercase (except names, codes)
- [x] DM Mono for stats/badges/numbers
- [x] DM Sans for body text
- [x] Buttons use 10px radius, mono font
- [x] Cards use 16px radius
- [x] Hover effects work correctly (avatar scales 1.12x, button gray→green)
- [x] Egg emoji empty state
- [x] Full light/dark mode support

### 2. Profile (`apps/mobile/app/(tabs)/profile.tsx`) ✓✓✓
- [x] ModeToggle component integrated (replaces old theme toggle)
- [x] All text lowercase with formatUIText()
- [x] DM Mono for labels and headers
- [x] DM Sans for body text
- [x] Consistent card styling
- [x] Full light/dark mode support

### 3. Social/Leagues (`apps/mobile/app/(tabs)/social.tsx`) ✓✓✓
- [x] All text lowercase with formatUIText()
- [x] DM Mono for headers ($mono, 17px, -0.5 letterSpacing)
- [x] Egg emoji empty state with lowercase message
- [x] Button sizing consistent (size="md")
- [x] Badge formatting with formatBadgeText()
- [x] Full light/dark mode support

### 4. Contests (`apps/mobile/app/(tabs)/contests.tsx`) ✓✓✓
- [x] SegmentTab component for tab switcher
- [x] All text lowercase with formatUIText()
- [x] Three egg emoji empty states (no matches, sign in, no contests)
- [x] formatBadgeText() for LIVE/UPCOMING status
- [x] DM Mono headers
- [x] Consistent button styling
- [x] Full light/dark mode support

## 🔄 Screens To Migrate (11+ remaining)

### 1. Live (`apps/mobile/app/(tabs)/live.tsx`) - IN PROGRESS
**Checklist:**
- [ ] Import InitialsAvatar for player avatars
- [ ] Use Badge for LIVE status
- [ ] Use Card with consistent radius
- [ ] Use StatLabel for live scores
- [ ] All text lowercase
- [ ] DM Mono for scores/numbers
- [ ] Add live pulse animation to LIVE badge
- [ ] Use textStyles for player names

**Key Changes:**
```typescript
// Live match card
<Card live>
  <Badge variant="live">LIVE</Badge>
  <XStack>
    <InitialsAvatar name={player.name} playerRole={player.role} ovr={player.ovr} size={32} />
    <StatLabel label="runs" value={player.runs} />
  </XStack>
</Card>
```

---

### 2. Draft Room (`apps/mobile/app/draft/[id].tsx`) - PRIORITY
**Checklist:**
- [ ] Use InitialsAvatar for players
- [ ] **Add HatchModal for draft picks**
- [ ] Use FilterPill for role filters
- [ ] Use SegmentTab if multiple views
- [ ] Timer display with DM Mono
- [ ] Use Button for draft action
- [ ] Hover effects on player cards
- [ ] Use HappinessMeter if showing team progress

**Key Changes:**
```typescript
const [hatchPlayer, setHatchPlayer] = useState(null);

const handleDraft = (player) => {
  setHatchPlayer(player); // Show hatch animation
};

{hatchPlayer && (
  <HatchModal 
    player={hatchPlayer} 
    onClose={() => {
      setHatchPlayer(null);
      // Add to team logic
    }} 
  />
)}
```

---

### 3. Auction Room (`apps/mobile/app/auction/[id].tsx`)
**Checklist:**
- [ ] Use InitialsAvatar
- [ ] Timer with DM Mono
- [ ] Bid button with consistent styling
- [ ] Use Card for player display
- [ ] Use Badge for auction status
- [ ] All text lowercase

---

### 4. League Screens (`apps/mobile/app/league/`)
**Checklist for each:**
- [ ] `index.tsx` - League list with cards
- [ ] `create.tsx` - Form with consistent buttons
- [ ] `join.tsx` - Join form
- [ ] `[id].tsx` - League detail

**Common Changes:**
- Use Card for league cards
- Use Button for all CTAs
- Use Badge for league status
- InitialsAvatar for league members
- All text lowercase

---

### 5. Match Screens (`apps/mobile/app/match/[id].tsx`)
**Checklist:**
- [ ] Use InitialsAvatar for players
- [ ] Use StatLabel for match stats
- [ ] Use Badge for match status
- [ ] Use Card for scorecard
- [ ] DM Mono for all scores

---

### 6. Team Screens (`apps/mobile/app/team/create.tsx`)
**Checklist:**
- [ ] Use InitialsAvatar in team builder
- [ ] Use FilterPill for role selection
- [ ] Use Button for submit
- [ ] Use Card for player selection
- [ ] Add HappinessMeter for team progress

---

### 7. Contest Detail (`apps/mobile/app/contest/[id].tsx`)
**Checklist:**
- [ ] Use Card for contest info
- [ ] Use Badge for entry status
- [ ] Use Button for join/leave
- [ ] Use InitialsAvatar for participants

---

## 🎨 Global Style Rules (Apply to ALL screens)

### Text Casing
```typescript
// ✅ Correct
"available players"
"my squad"
"draft now"

// ❌ Wrong
"Available Players"
"My Squad"
"Draft Now"

// Exceptions (UPPERCASE)
"BAT", "BOWL", "AR", "WK"  // Roles
"IND", "AUS", "ENG"        // Team codes
"LIVE", "UPCOMING"         // Status

// Exceptions (Title Case)
"Virat Kohli"              // Player names
"Available"                // Tab labels only
```

### Font Usage
```typescript
// DM Mono ($mono) - USE FOR:
- Stats: avg, sr, runs, wkts, econ
- Numbers: OVR badges, scores, timers
- Codes: Team codes (IND, AUS)
- Badges: Role badges (BAT, BOWL)
- Labels: Small labels, hints

// DM Sans ($body) - USE FOR:
- Player names
- Descriptions
- Paragraph text
- Headings
```

### Component Standards
```typescript
// Buttons
<Button 
  size="sm"              // 32px height
  variant="secondary"    // gray → green on hover
  fontFamily="$mono"     // Always mono
>
  {formatUIText("draft")}  // lowercase
</Button>

// Cards
<Card 
  pressable              // Adds hover effect
  borderRadius={16}      // Always 16px
>

// Badges
<Badge 
  variant="role"         // or live, success, danger
  size="sm"
>
  {formatBadgeText("bat")}  // UPPERCASE
</Badge>

// Avatars
<InitialsAvatar 
  name={player.name}
  playerRole={player.role}
  ovr={player.ovr}
  size={46}              // Default, or 32/40 for smaller
/>
```

### Empty States
```typescript
<YStack alignItems="center" paddingVertical="$8">
  <Text fontSize={48} marginBottom="$4">
    {DesignSystem.emptyState.icon}
  </Text>
  <Text {...textStyles.hint} textAlign="center">
    {DesignSystem.emptyState.message}
  </Text>
</YStack>
```

---

## 📦 Import Template (Use in every screen)

```typescript
import { useState } from "react";
import { XStack, YStack, Text } from "tamagui";
import {
  Card,
  Badge,
  Button,
  InitialsAvatar,
  StatLabel,
  HatchModal,
  FilterPill,
  SegmentTab,
  ModeToggle,
  HappinessMeter,
  EggLoadingSpinner,
  DesignSystem,
  textStyles,
  formatUIText,
  formatBadgeText,
} from "@draftcrick/ui";
```

---

## 🔍 Code Review Checklist

Before marking a screen as complete, verify:

- [ ] **No hardcoded colors** - All use theme tokens ($color, $background, etc.)
- [ ] **No hardcoded fonts** - All use $mono or $body
- [ ] **No mixed casing** - Follow the text casing rules
- [ ] **Consistent spacing** - Use theme spacing tokens ($1-$6)
- [ ] **Proper animations** - Use FadeInDown with stagger for lists
- [ ] **Hover effects** - Cards show accent border, buttons change color
- [ ] **Empty states** - Show egg emoji with lowercase message
- [ ] **Loading states** - Use EggLoadingSpinner
- [ ] **No console warnings** - All prop types correct

---

## 🚀 Future Additions

When adding new screens/features, ensure:

1. Import DesignSystem constants
2. Use formatUIText() for all UI labels
3. Use formatBadgeText() for roles/codes/status
4. Use existing components (don't create new ones)
5. Follow textStyles for text elements
6. Test in both light and dark mode
7. Add to this checklist for tracking

---

## 📝 Notes

- Dashboard (`index.tsx`) is the reference implementation
- Consult `TAMI_DRAFT_UI_GUIDE.md` for component usage
- All design tokens are in `packages/ui/src/theme/`
- Global constants are in `packages/ui/src/constants/designSystem.ts`

---

### 8. Wallet Screen (`apps/mobile/app/wallet/index.tsx`)
**Checklist:**
- [ ] All text lowercase
- [ ] DM Mono for amounts and labels
- [ ] Use Card for wallet sections
- [ ] Use Button for transactions
- [ ] Full theme support

### 9. Auth Screens (`apps/mobile/app/auth/*.tsx`)
**Checklist:**
- [ ] Login, Register, Onboarding screens
- [ ] All text lowercase
- [ ] Use Button with consistent styling
- [ ] Egg emoji for welcome/onboarding
- [ ] Full theme support

### 10. Guru Screen (`apps/mobile/app/guru/index.tsx`)
**Checklist:**
- [ ] All text lowercase
- [ ] Use Card for AI responses
- [ ] Use Badge for AI status
- [ ] Full theme support

---

## 📊 Migration Progress Summary

**Overall Progress:** 4/15+ screens completed (27%)

**Tab Screens:** 4/5 completed (80%)
- ✅ Dashboard
- ✅ Profile  
- ✅ Social
- ✅ Contests
- ⏳ Live

**Other Screens:** 0/10+ completed (0%)
- ⏳ Draft, Auction, League, Match, Team, Wallet, Contest Detail, Auth, Guru

**Design System:** 100% complete ✅
**Component Library:** 100% complete (8 components) ✅
**Documentation:** 100% complete ✅

---

**Last Updated:** February 9, 2026 - 3:10 PM EST
**Status:** 4 screens migrated, 11+ remaining
