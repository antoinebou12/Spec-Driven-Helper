# UX & design system

Make the experience coherent and accessible.

## Navigation and information architecture

<!-- sdd:answer design.1 -->
Left navigation with Requests, Knowledge base and Settings; each request has a shareable URL; breadcrumbs on detail pages.
<!-- sdd:end -->

## Screen inventory

<!-- sdd:answer design.2 -->
| Screen | Purpose | Primary action | Use case |
| --- | --- | --- | --- |
| Request list | Find requests | Filter and open | UC-002 |
| New request | Capture an issue | Submit | UC-001 |
| Request detail | Follow and reply | Reply | UC-002, UC-003 |
| Triage queue | Assign and answer | Reply | UC-003 |
<!-- sdd:end -->

## Components and interaction states

<!-- sdd:answer design.3 -->
Button, text field, file drop zone, status badge, timeline, data table, dialog — each with default, hover, focus-visible, loading, empty, error and disabled states. Built on shadcn/ui primitives.
<!-- sdd:end -->

## Color and typography tokens

<!-- sdd:answer design.4 -->
Color roles surface, text, muted, accent, danger, success; body 16 px / 1.5; 4 px spacing scale; light and dark themes with at least 4.5:1 text contrast.
<!-- sdd:end -->

## Responsive behavior

<!-- sdd:answer design.5 -->
Below 768 px the navigation becomes a menu button, tables become cards and touch targets are at least 44 px. Supports 200% zoom.
<!-- sdd:end -->

## Keyboard and assistive technology

<!-- sdd:answer design.6 -->
Skip link to main content; logical focus order; status changes announced in a polite live region; dialogs trap and restore focus; tested with NVDA and VoiceOver.
<!-- sdd:end -->

## UX validation plan

<!-- sdd:answer design.7 -->
Clickable prototype tested with 5 customers; success = 4 of 5 submit a request unaided in under 3 minutes.
<!-- sdd:end -->
