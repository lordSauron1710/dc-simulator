# Accessibility Policy

DC Simulator must meet WCAG 2.1 AA expectations for the interactive UI around the 3D scene. The canvas can be visually complex, but the control surface still has to be operable, understandable, and resilient.

## Core Rules

- Use semantic HTML for every interactive control.
  - Buttons are buttons. Links are links. Do not use clickable `div` or `span` elements.
- Every icon-only control must have an accessible name.
- Focus must remain visible at all times.
  - Never remove focus styles without a clear replacement.
- Keyboard access is mandatory.
  - All primary actions must work without a mouse.
  - The 3D canvas must not trap focus.
- Motion must respect user preference.
  - Scroll tours, camera motion, and panel animation must honor `prefers-reduced-motion`.
- Color cannot be the only signal.
  - Selection, warnings, and status changes need text, icons, or labels in addition to color.
- Screen-reader users need text equivalents for important scene state.
  - If a selection changes the active object or KPI context, that change should be understandable from nearby text, not only from the canvas.

## Repo-Specific Requirements

- The page should keep a clear landmark structure such as `main`, `nav`, and labeled toolbars or panels.
- Left-rail, inspector, presets, and control toggles must expose their expanded or collapsed state when relevant.
- Range controls and dropdowns must expose labels, values, and units.
- Any under-construction or status banner must use meaningful text, not emoji alone.
- Pointer-event layering around the canvas must not make keyboard users lose access to controls.

## Visual Requirements

- Maintain at least 4.5:1 contrast for normal text and 3:1 for large text and UI components.
- Use minimum 44x44px touch targets for mobile controls.
- Keep the layout usable at 200% zoom without clipped controls or unreadable overlays.

## Pre-Merge Checklist

- [ ] Tab through the whole page and verify logical focus order
- [ ] Verify every icon button has an accessible name
- [ ] Check reduced-motion behavior for camera and panel transitions
- [ ] Verify contrast on dark-panel text, pills, sliders, and overlays
- [ ] Confirm screen-reader-visible text exists for the active selection and key KPIs

## Recommended Tools

- Lighthouse accessibility audit
- axe DevTools
- VoiceOver or NVDA
- Browser emulation for `prefers-reduced-motion`
