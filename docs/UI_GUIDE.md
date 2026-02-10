# 🥚 tami·draft UI System Guide

**Retro-Modern Cricket Fantasy Design System**

This guide shows you how to use the tami·draft design system consistently across all screens in your app.

## Quick Reference

### Core Principles
1. **Clean First, Cute Second** - Readability always wins
2. **DM Mono for Stats** - All numbers, stats, badges use DM Mono
3. **DM Sans for Content** - All body text and headings
4. **Initials Avatars** - Player representation via name initials + role color
5. **Egg Mascot** - The hatching animation is the core Tamagotchi moment

---

## Components Library

All components are exported from `@draftcrick/ui`:

```typescript
import {
  // Primitives
  Card,
  Button,
  Badge,
  
  // tami·draft Components
  AnnouncementBanner,
  InitialsAvatar,
  StatLabel,
  HatchModal,
  FilterPill,
  SegmentTab,
  ModeToggle,
  EggLoadingSpinner,
} from "@draftcrick/ui";
```

---

## 1. AnnouncementBanner

Railway-station-style announcement strip that cycles through multiple messages with typing and flip animations.

```typescript
<AnnouncementBanner />
```

**Features:**
- Typing effect: text appears character by character (38ms per character)
- Multiple announcements cycle automatically
- Railway-station flip transition (280ms duration)
- Pause between messages: 3200ms

**Content Management:**
Announcements are configured in the component itself:

```typescript
// Edit ANNOUNCEMENTS array in AnnouncementBanner.tsx
const ANNOUNCEMENTS = [
  "ipl 2026 fantasy leagues are open — create or join now",
  "new feature: auction draft mode is live",
  "weekend challenge: build your dream xi and win rewards",
  "pro tip: diversify picks across roles for higher points",
  "coming soon: head-to-head contests with friends",
];
```

**Appearance:**
- Height: 18px text height within container
- Background: `$backgroundSurface`
- Padding: Vertical `$2`, Horizontal `$4`
- Font: DM Mono, 11px, `$colorSecondary`
- Left indicator: 3x14px accent-colored vertical bar

---

## 2. InitialsAvatar

Player avatar with role-colored background showing initials + OVR badge.

```typescript
<InitialsAvatar 
  name="Virat Kohli"  // Derives "VK" initials
  playerRole="BAT"     // BAT | BOWL | AR | WK
  ovr={97}             // Overall rating (shows in badge)
  size={46}            // Optional, default 46px
/>
```

**Role Colors:**
- `BAT` - Warm amber (#B8862D)
- `BOWL` - Cricket green (#3D9968)
- `AR` - Blue (#4A5DB5)
- `WK` - Purple (#7B5EA7)

---

## 3. StatLabel

Cricket stat display with DM Mono font.

```typescript
<StatLabel label="avg" value={53.4} />
<StatLabel label="sr" value={93.2} />
<StatLabel label="wkts" value={178} />
```

**Common Stats:**
- Batsmen: avg, sr, runs
- Bowlers: wkts, econ, avg
- All-rounders: mix of both
- Keepers: avg, sr, catches

---

## 4. HatchModal

Egg-hatching animation for draft picks (2 seconds).

```typescript
const [hatchPlayer, setHatchPlayer] = useState(null);

// Show modal
setHatchPlayer({
  name: "Virat Kohli",
  role: "BAT",
  team: "IND",
  ovr: 97
});

// Render
{hatchPlayer && (
  <HatchModal 
    player={hatchPlayer}
    onClose={() => setHatchPlayer(null)}
  />
)}
```

**Animation Sequence:**
1. Egg wobbles left (-12deg)
2. Egg wobbles right (12deg)
3. Egg wobbles left (-6deg)
4. Egg cracks & reveals initials avatar
5. Shows player name, role, team + "joined your squad! 🏏"

---

## 5. FilterPill

Role filter button with rounded pill shape.

```typescript
<FilterPill 
  active={roleFilter === "BAT"}
  onPress={() => setRoleFilter("BAT")}
>
  <Text>🏏 Batsmen</Text>
</FilterPill>
```

**States:**
- Inactive: surface bg, border outline
- Active: textPrimary bg, inverted text (dark mode aware)

---

## 6. SegmentTab

Segmented control tab button.

```typescript
<XStack backgroundColor="$backgroundSurfaceAlt" borderRadius="$3" padding="$1">
  <SegmentTab active={tab === "draft"} onPress={() => setTab("draft")}>
    <Text>Available</Text>
    <Text fontFamily="$mono">{count}</Text>
  </SegmentTab>
  <SegmentTab active={tab === "team"} onPress={() => setTab("team")}>
    <Text>My Squad</Text>
  </SegmentTab>
</XStack>
```

---

## 7. ModeToggle

Sun/moon pill switch for theme toggle.

```typescript
<ModeToggle 
  mode={mode}              // "light" | "dark"
  onToggle={toggleMode}
/>
```

**Behavior:**
- Light mode: surfaceAlt track, sun emoji
- Dark mode: accent track, moon emoji
- Smooth 0.3s spring transition

---

## 8. EggLoadingSpinner

Wobbling egg animation for loading states.

```typescript
<EggLoadingSpinner 
  size={48}              // Optional, default 48
  message="loading"      // Optional
/>
```

**Animation:**
- Egg wobbles left/right continuously
- Uses spring easing for natural feel

---

## Primitive Components

### Card

```typescript
<Card 
  pressable          // Adds press interaction
  elevated          // Adds shadow
  live              // Red border for live matches
>
  {content}
</Card>
```

**Specs:**
- 16px border radius
- 1px border
- Hover: accent border at 20% opacity

### Button

```typescript
<Button 
  variant="primary"    // primary | secondary | accent | danger | ghost
  size="sm"           // sm | md | lg
  onPress={handler}
>
  {text}
</Button>
```

**Specs:**
- DM Mono font
- 10px border radius
- Sizes: sm(32px) | md(40px) | lg(48px)

### Badge

```typescript
<Badge 
  variant="role"      // role | success | warning | danger | live | captain
  size="sm"          // sm | md | lg
>
  BAT
</Badge>
```

---

## Typography Scale

All components use these font families:

```typescript
// DM Sans - Body & Headings
fontFamily="$body"     // or "$heading"
fontSize={14}
fontWeight="600"

// DM Mono - Stats & Data
fontFamily="$mono"
fontSize={11}
fontWeight="500"
```

**When to use each:**
- **DM Sans**: Player names, labels, descriptions, buttons text
- **DM Mono**: Stats, OVR badges, timers, round/pick, role badges, team codes

---

## Color Tokens

### Light Mode
```typescript
$background           // #F7F5F0 - Page bg
$backgroundSurface    // #FFFFFF - Cards
$backgroundSurfaceAlt // #EFECEA - Tab containers
$borderColor          // #E5E1DA - Borders

$color                // #1A1A1A - Primary text
$colorSecondary       // #8A8580 - Secondary text
$colorMuted           // #B5B0A8 - Muted text

$colorAccent          // #3D9968 - Green actions
$colorCricket         // #B8862D - Cricket highlights
$colorHatch           // #C25A3A - Draft actions
```

### Dark Mode
```typescript
$background           // #111210 - Page bg
$backgroundSurface    // #1C1D1B - Cards
$backgroundSurfaceAlt // #252624 - Tab containers
$borderColor          // #333432 - Borders

$color                // #EDECEA - Primary text
$colorSecondary       // #9A9894 - Secondary text
$colorMuted           // #5E5D5A - Muted text

$colorAccent          // #5DB882 - Green actions
$colorCricket         // #D4A43D - Cricket highlights
$colorHatch           // #E08060 - Draft actions
```

---

## Common Patterns

### Player Card (Available)

```typescript
<Card pressable>
  <XStack alignItems="center" gap="$3">
    <InitialsAvatar name={player.name} playerRole={player.role} ovr={player.ovr} />
    <YStack flex={1}>
      <Text fontFamily="$body" fontWeight="600" fontSize={14}>
        {player.name}
      </Text>
      <XStack alignItems="center" gap="$2">
        <Badge variant="role" size="sm">{player.role}</Badge>
        <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
          {player.team}
        </Text>
        <Text color="$borderColor">·</Text>
        <StatLabel label="avg" value={player.stats.avg} />
        <StatLabel label="sr" value={player.stats.sr} />
      </XStack>
    </YStack>
    <Button size="sm" variant="secondary" onPress={handleDraft}>
      draft
    </Button>
  </XStack>
</Card>
```

### Player Card (My Team)

```typescript
<Card>
  <XStack alignItems="center" gap="$3">
    <Text fontFamily="$mono" fontSize={11} color="$colorMuted" width={20}>
      {index + 1}
    </Text>
    <InitialsAvatar 
      name={player.name} 
      playerRole={player.role} 
      ovr={player.ovr} 
      size={40} 
    />
    <YStack flex={1}>
      <Text fontFamily="$body" fontWeight="600" fontSize={14}>
        {player.name}
      </Text>
      <XStack alignItems="center" gap="$2">
        <Badge variant="role" size="sm">{player.role}</Badge>
        <Text fontFamily="$mono" fontSize={11} color="$colorMuted">
          {player.team}
        </Text>
      </XStack>
    </YStack>
  </XStack>
</Card>
```

### Timer Display

```typescript
<YStack alignItems="flex-end">
  <Text fontFamily="$mono" fontSize={10} color="$colorMuted">
    rd {round} · pick {pick}
  </Text>
  <Text
    fontFamily="$mono"
    fontSize={22}
    fontWeight="500"
    letterSpacing={1}
    color={seconds < 15 ? "$colorHatch" : "$color"}
  >
    {minutes}:{seconds.padStart(2, "0")}
  </Text>
</YStack>
```

### Empty State

```typescript
<YStack alignItems="center" paddingVertical="$8">
  <Text fontSize={48} marginBottom="$4">🥚</Text>
  <Text 
    fontFamily="$mono" 
    fontSize={12} 
    color="$colorMuted" 
    textAlign="center"
  >
    draft cricketers to hatch your squad
  </Text>
</YStack>
```

---

## Text Casing Rules

1. **All lowercase** for most UI text:
   - "available players"
   - "my squad"
   - "draft"
   - "team happiness"

2. **UPPERCASE** for:
   - Role badges: BAT, BOWL, AR, WK
   - Team codes: IND, AUS, ENG
   - Status labels: LIVE, UPCOMING

3. **Title Case** for:
   - Player names: "Virat Kohli"
   - Tab labels: "Available", "My Squad"

---

## Animation Guidelines

Use `react-native-reanimated` for animations:

```typescript
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";

// Stagger list items
<Animated.View entering={FadeInDown.delay(60 + index * 40).springify()}>
  <Card>...</Card>
</Animated.View>

// Fade in sections
<Animated.View entering={FadeIn.delay(30)}>
  <Header />
</Animated.View>
```

**Timing:**
- Quick interactions: 0.2s
- Mode transitions: 0.4s ease
- Modal entrance: 0.3s ease-out
- Hatch animation: 2s total (600ms, 500ms, 500ms, 900ms stages)

---

## Checklist for New Screens

When implementing a new screen, ensure:

- [ ] Shows `AnnouncementBanner` at the top of the screen
- [ ] Uses `InitialsAvatar` for player representation
- [ ] All stats use `StatLabel` component
- [ ] Buttons use DM Mono font (`fontFamily="$mono"`)
- [ ] Role badges use `Badge variant="role"`
- [ ] Cards have 16px border radius
- [ ] Text is mostly lowercase (except names, codes)
- [ ] Stats/numbers use DM Mono
- [ ] Body text uses DM Sans
- [ ] Animations use `FadeInDown` with stagger
- [ ] Empty states show egg emoji
- [ ] Loading states use `EggLoadingSpinner`
- [ ] Theme toggle uses `ModeToggle` component
- [ ] Colors use theme tokens (e.g., `$colorAccent`)

---

## Migration Example

**Before:**
```typescript
<View style={{ background: "#fff", padding: 16, borderRadius: 8 }}>
  <Image source={playerImage} />
  <Text style={{ fontSize: 16, fontWeight: "bold" }}>{player.name}</Text>
  <Text>AVG: {player.avg}</Text>
  <TouchableOpacity onPress={onDraft}>
    <Text>Draft</Text>
  </TouchableOpacity>
</View>
```

**After:**
```typescript
<Card pressable onPress={onDraft}>
  <XStack alignItems="center" gap="$3">
    <InitialsAvatar 
      name={player.name} 
      playerRole={player.role} 
      ovr={player.ovr} 
    />
    <YStack flex={1}>
      <Text fontFamily="$body" fontWeight="600" fontSize={16}>
        {player.name}
      </Text>
      <StatLabel label="avg" value={player.avg} />
    </YStack>
    <Button size="sm" variant="secondary">
      draft
    </Button>
  </XStack>
</Card>
```

---

## Support

For questions or issues with the design system:
1. Check this guide first
2. Review the reference implementation in `ref/tamigui-sports-draft.jsx`
3. Consult the Tamagui V5 documentation: https://tamagui.dev/
4. Review the handoff doc: `/Downloads/tami-draft-handoff-v2.docx`

---

**Built with ❤️ and 🥚 for cricket fantasy fans**
