# UX review against Apple's Human Interface Guidelines (2026-10-09)

This review follows the procedure of the [apple-design skill](https://github.com/dickwu/apple-design-skill) (`SKILL.md`, with its HIG pages `accessibility`, `layout`, `typography`, `color`, `dark-mode`, `designing-for-macos`, `designing-for-ios`, `sidebars`, `toolbars`, `buttons`, `motion`, `writing` and `cross-platform`). It is a web app, so desktop rules come from macOS (13 pt text by default, 10 pt minimum, 28 × 28 pt controls by default and 20 × 20 pt minimum) and phone rules come from iOS (17 pt text, 44 × 44 pt controls by default, 28 × 28 pt minimum). The project's own floor stays at WCAG 2.2's 24 × 24 px.

**Evidence:**

- `pnpm ux:review`: 27 screenshots (9 views at desktop, tablet and phone widths) and contact sheets.
- A contrast script run on every text and background token pair in `style.css`, in light and dark.
- A live check at 375 px and at 1280 px.

## Summary

The overall rating is **Needs work**, now **Good** after the fixes below. The design has a clear thesis: a calm, document-first workspace with one accent and colour kept for status. Its signature element is the completeness ring with the per-section progress bars. Text contrast was already sound (every text pair is at least 4.5:1 in both themes). The failures were the edges of controls and how the app follows system settings. On phones, the app frame pushed the content down.

## Critical

1. **Form controls had no visible edge.**
   - **What:** text fields, selects and switches were outlined only by `--line-strong`. That is `#cfd4dc` on `#ffffff` at 1.49:1, and `#344052` on `#121821` at 1.70:1. Non-text contrast needs 3:1 for the boundary that identifies a control.
   - **Why:** `accessibility.md`, "Color and effects": use sufficient contrast, in both appearances.
   - **Fix (done):** a new token, `--control-line`, used for `input`, `select`, `textarea` and `.switch`. It is `#858e9d` in light, at least 3.06:1 on every surface, and `#66738a` in dark, at least 3.46:1. Dividers keep `--line-strong`.

## Improvements

- **High: the app stopped following the system appearance.**
  - **What:** the first visit stored the system appearance as if it were the person's choice (`sdd-theme`). After that, the app never followed a later change in the system setting.
  - **Why:** `dark-mode.md`, "Best practices": follow the system appearance and don't offer an app-specific appearance setting.
  - **Fix (done):** `appearance.ts` defaults to **Match system** and follows `prefers-color-scheme` live. Light and Dark remain as explicit choices, kept as an accessibility preference (see the deviations below).
- **High: no response to Increase Contrast.**
  - **What:** the stylesheet had no `prefers-contrast` rule.
  - **Why:** `accessibility.md`, "Color and effects": provide a higher-contrast scheme when the setting is on.
  - **Fix (done):** a `prefers-contrast: more` block in both themes:
    - Secondary text becomes `#4a5361` (7.2:1 or more) in light and `#c3cbd8` (10:1 or more) in dark.
    - Dividers and control edges get stronger.
- **High: on phones, the frame came before the content.**
  - **What:** six stacked rows before the page title on a 390 px screen: brand, project, Views, Dashboard/Settings/account, breadcrumb and toolbar. That is about 340 px, or 42% of an 812 px screen.
  - **Why:** `designing-for-ios.md` and `layout.md`: give content priority, and keep actions in one toolbar.
  - **Fix (done):** Dashboard, Settings and the account now open from the Views menu. The breadcrumb row, which repeated the view name and whose sidebar toggle does nothing on phones, is hidden. The title starts about 110 px higher.
- **Medium: text below the minimum size.**
  - **What:** the collapsed-rail count badge was 0.65rem (9.1 px) and the section dots were 0.7rem (9.8 px). The macOS minimum is 10 pt.
  - **Why:** `typography.md`, "Best practices".
  - **Fix (done):** both are now 0.75rem (10.5 px).
- **Medium: secondary navigation text on the hover row.**
  - **What:** `#6b7382` on `#f2f4f7` was 4.33:1.
  - **Fix (done):** `--nav-muted` is now `#646c7b`, at 4.80:1.
- **Medium: two primary buttons where only one works.**
  - **What:** under Readiness, "Approve revision N as baseline" stayed primary while disabled, directly above "Review all and approve".
  - **Why:** `buttons.md`: one prominent button for the most likely action.
  - **Fix (done):** the disabled one becomes secondary whenever the one-click action is offered.
- **Medium (backlog): phone targets.**
  - **What:** buttons are 36 px, small buttons 30 px and icon buttons 34 px. On a phone they shrink toward 24 px in the crowded toolbar. All are above the iOS minimum of 28 pt but below its 44 pt default.
  - **Fix:** a `pointer: coarse` size step, once the phone toolbar has fewer controls (see the next item).
- **Medium (backlog): the phone toolbar packs nine controls into one row.**
  - **What:** search, status, readiness, language, theme, display, shortcuts, docs and help.
  - **Fix:** keep search and status in the row, and move language, theme, display, shortcuts, docs and help into one "More" menu.
- **Medium (backlog): tables on phones.**
  - **What:** the Requirements & decisions table keeps four columns at 390 px, so titles wrap a word per line.
  - **Fix:** a stacked row layout below 560 px.
- **Medium (backlog): the type scale.**
  - **What:** `style.css` and `builder.css` use about 37 different font sizes, 15 of them between 0.7rem and 0.95rem.
  - **Why:** `typography.md`: a limited set of sizes with clear hierarchy.
  - **Fix:** five size tokens (caption, footnote, body, headline, title) and a pass to map the values onto them.
- **Low (handed to TASK-154/155):** `builder.css` has an 11 px label. The conversation styles belong to the work in progress on the composer.

## Craft notes

- The point of view holds: neutral surfaces, one accent, colour only for status, and Lucide icons at one weight. No generic generated-UI look.
- Boldness is spent in one place, the completeness ring. Keep it the only large figure on a page.
- Motion is short and `prefers-reduced-motion` turns off all animation and transition. Since the motion pass below, the top bar uses blur and transparency, and `prefers-reduced-transparency` makes it solid.

## Motion and feel (TASK-174)

A second pass with the same skill, on what the first review left out: response on press, springs, spatial consistency, boundaries and materials.

- **Fixed: no response on press.**
  - **What:** buttons, chips, navigation items, tabs and step pills only changed colour on hover; nothing answered a press.
  - **Why:** an interface should respond the moment a finger or pointer goes down.
  - **Fix:** `:active` scales them to 0.97 with a 100 ms transform. Layout and contrast are unchanged.
- **Fixed: bouncy springs where nothing was thrown.**
  - **What:** conversation cards and the live document sprang in with visible overshoot and a tilt, and chart bars and walkthrough steps used fixed durations.
  - **Why:** overshoot signals momentum; an element that simply appears should settle.
  - **Fix:** one set of springs in `motion.ts` (`ui` and `snappy` critically damped, `momentum` only after a gesture). Cards rise 8 px and settle, and the tilt is gone.
- **Fixed: steps always slid in from the right.**
  - **What:** going back in a walkthrough looked like going forward.
  - **Why:** spatial consistency: movement should match the direction of travel.
  - **Fix:** forward enters from the right, back from the left, and a step change can be interrupted at any point.
- **Fixed: dialogs popped in and out.**
  - **Fix:** they fade and scale in over 180 ms and leave along the same path over 140 ms; Radix waits for the exit. The exit uses its own keyframes, because reusing the entrance in reverse made Radix skip the wait.
- **Fixed: the panel divider stopped dead at its limits.**
  - **Fix:** past a limit, the handle follows with growing resistance (`rubberband`, constant 0.55) and springs back with its release velocity. The stored width stays clamped and the keyboard is unchanged.
- **Fixed: an opaque top bar and an abrupt theme switch.**
  - **Fix:** a translucent, blurred top bar (solid under reduced transparency or more contrast), and colours that cross-fade for 250 ms when light and dark change.
- **Fixed: one tracking for every heading.**
  - **Fix:** tighter tracking for larger headings (h1 −0.02em at line-height 1.2, down to h4 at 0), `font-optical-sizing: auto` and balanced heading wraps.
- **Deviation:** reduced motion stays instant instead of being replaced by fades. The browser tests check settled colours that way, and an instant change meets WCAG 2.3.3.
- **Backlog:** Board and Stack drag and drop use native HTML5 drag, which cannot hand off to a spring. A pointer-based drag with momentum would need a rewrite; the keyboard and menu alternatives already exist.

## What works

- Visible 2 px focus rings on every surface.
- A skip link and a keyboard path for every drag and drop.
- Labelled icon-only buttons.
- Status shown with words as well as colour.
- Grouped readiness blockers with direct review links.
- The phone Views menu.
- Every text pair has contrast of 4.5:1 or more in light and dark.

## Platform notes and deliberate deviations

- **In-app theme and font choice.** The HIG advises against an app-specific appearance setting. Here it is an accessibility and preference control in a browser, which has no per-site system setting. It now defaults to Match system.
- **No menu bar.** A web app has no menu bar. Every command is reachable from the sidebar, the top-bar actions, keyboard shortcuts (Alt+1–9, Alt+0, ?) and project search (Ctrl+K).
