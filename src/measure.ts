import { prepare, layout, clearCache } from '@chenglou/pretext'
import type { Block } from './markdown'

export interface MeasureSettings {
  fontFamily: string
  monoFontFamily: string
  marginMm: number
  lineHeightRatio: number
  paragraphSpacing: number
}

export interface FitResult {
  fontSize: number
  overflow: boolean
}

const HEADING_SCALES: Record<number, number> = {
  1: 2.0,
  2: 1.5,
  3: 1.17,
  4: 1.0,
  5: 0.83,
  6: 0.67,
}

// A4 at 96 DPI
const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123
const MM_TO_PX = 96 / 25.4

function buildFontString(size: number, family: string, bold: boolean): string {
  return bold ? `700 ${size}px "${family}"` : `${size}px "${family}"`
}

function computeTotalHeight(blocks: Block[], baseFontSize: number, settings: MeasureSettings): number {
  const marginPx = settings.marginMm * MM_TO_PX
  const printableWidth = A4_WIDTH_PX - 2 * marginPx

  let totalHeight = 0
  let prevBottomMargin = 0 // Track for CSS margin collapsing simulation

  for (const block of blocks) {
    if (block.type === 'space') {
      // Space tokens represent blank lines; treat as a small gap
      prevBottomMargin = Math.max(prevBottomMargin, baseFontSize * 0.25)
      continue
    }

    if (block.type === 'hr') {
      // hr has margin: 1em 0 in CSS, plus 1px border
      const hrTopMargin = baseFontSize
      // Collapse with previous bottom margin
      totalHeight += Math.max(hrTopMargin, prevBottomMargin)
      totalHeight += 1 // 1px border
      prevBottomMargin = baseFontSize // hr bottom margin
      continue
    }

    // Effective font size
    let effectiveSize = baseFontSize
    let isBold = false
    let fontFamily = settings.fontFamily
    let usePreWrap = false

    if (block.type === 'heading' && block.headingLevel) {
      effectiveSize = baseFontSize * (HEADING_SCALES[block.headingLevel] ?? 1)
      isBold = true
    } else if (block.type === 'code') {
      effectiveSize = baseFontSize * 0.875
      fontFamily = settings.monoFontFamily
      usePreWrap = true
    }

    // Available width
    let availableWidth = printableWidth
    if (block.type === 'listitem' && block.listIndentLevel !== undefined) {
      availableWidth -= (block.listIndentLevel + 1) * baseFontSize * 2
    }
    if (block.type === 'blockquote') {
      availableWidth -= baseFontSize * 2
    }
    availableWidth = Math.max(availableWidth, effectiveSize * 2)

    // Line height
    const lineHeightPx = effectiveSize * settings.lineHeightRatio

    // Measure with Pretext
    const fontString = buildFontString(effectiveSize, fontFamily, isBold)
    const prepared = prepare(block.text, fontString, usePreWrap ? { whiteSpace: 'pre-wrap' } : undefined)
    const result = layout(prepared, availableWidth, lineHeightPx)

    // Compute this block's CSS margins
    let topMargin = 0
    let bottomMargin = 0

    if (block.type === 'heading' && block.headingLevel) {
      if (block.headingLevel <= 3) {
        topMargin = effectiveSize * 0.67
        bottomMargin = effectiveSize * 0.33
      } else {
        topMargin = effectiveSize * 0.5
        bottomMargin = effectiveSize * 0.25
      }
    } else if (block.type === 'listitem') {
      topMargin = baseFontSize * 0.15
      bottomMargin = baseFontSize * 0.15
    } else {
      // paragraph, blockquote
      topMargin = baseFontSize * settings.paragraphSpacing
      bottomMargin = baseFontSize * settings.paragraphSpacing
    }

    // CSS margin collapsing: take the max of adjacent margins
    totalHeight += Math.max(topMargin, prevBottomMargin)
    totalHeight += result.height
    prevBottomMargin = bottomMargin
  }

  return totalHeight
}

export function findOptimalFontSize(blocks: Block[], settings: MeasureSettings): FitResult {
  if (blocks.length === 0) {
    return { fontSize: 16, overflow: false }
  }

  const marginPx = settings.marginMm * MM_TO_PX
  const printableHeight = A4_HEIGHT_PX - 2 * marginPx

  let lo = 6
  let hi = 72
  let best = lo

  // Binary search: find max font size that fits
  while (hi - lo > 0.25) {
    const mid = (lo + hi) / 2
    const totalHeight = computeTotalHeight(blocks, mid, settings)

    if (totalHeight <= printableHeight) {
      best = mid
      lo = mid
    } else {
      hi = mid
    }
  }

  // Check if even minimum size overflows
  const overflow = best <= 6.25 && computeTotalHeight(blocks, 6, settings) > printableHeight

  return { fontSize: Math.round(best * 4) / 4, overflow }
}

export function clearMeasureCache(): void {
  clearCache()
}
