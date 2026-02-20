# Quarter View Day Grid Lines

**Date**: 2026-02-20
**Status**: Approved

## Problem

The month view renders a visible grid of `border-b border-r border-cloud-100` lines around every day cell, giving it clear structure. The quarter view uses compact `DayCell` components with no borders — only `gap-px` on the week grid, which produces no visible lines.

## Goal

Add consistent grid lines to all cells in the quarter view (current-month days and padding cells alike), matching the visual character of the month view.

## Approach

**Option A — Border on cells** (selected)

Mirror the month view's border strategy: `border-b border-r` on each cell, closed by `border-t border-l` on the week-row container.

## Changes

### `frontend/src/components/planning/DayCell.tsx`

In compact mode, add `border-b border-r border-cloud-100` to the cell div. Applies to all compact cells automatically.

### `frontend/src/components/planning/QuarterView.tsx`

1. Week-row day grid: add `border-t border-l border-cloud-100`, remove `gap-px`.
2. Empty padding cells: add `border-b border-r border-cloud-100` so they form the grid.
3. Day-header row: add `border-b border-cloud-200` to match the month view header separator.

## Non-Goals

- No changes to trip bars, today ring, holiday/custom day colors, selected states, or click handlers.
- No changes to year view behavior.
