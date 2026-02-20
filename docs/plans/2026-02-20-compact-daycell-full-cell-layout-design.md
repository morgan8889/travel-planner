# Compact DayCell Full-Cell Layout Design

**Date**: 2026-02-20
**Status**: Approved

## Problem

In the quarter view, grid line borders appear only around the date number (a small centered box) rather than spanning the full allocated cell area like the month view. Three properties in the compact `DayCell` combine to cause this:

1. `rounded-sm` — rounds corners, giving a badge/pill look instead of a flush grid cell
2. `flex items-center justify-center` — centers content in a small area rather than anchoring top-left
3. No `h-full` — the div doesn't stretch to fill the grid row's full height

## Goal

Make compact DayCell borders span the full grid cell, with the date number in the top-left corner — matching the month view's visual character.

## Approach

Single change to `DayCell.tsx` compact mode div (line 41):

| Property | Before | After |
|---|---|---|
| Rounding | `rounded-sm` | *(removed)* |
| Flex alignment | `items-center justify-center` | `items-start p-1` |
| Height | `min-h-[2.5rem]` | `h-full min-h-[2.5rem]` |

## Non-Goals

- No changes to QuarterView.tsx, MonthView.tsx, or any other file
- No changes to click handlers, holiday/custom day colors, today ring, or trip bars
