'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

export interface AdBannerProps {
  /** Auto refresh interval in seconds (default: 18) */
  refreshInterval?: number
  /** Custom wrapper styling */
  className?: string
  /** Optional variant (kept for backwards compatibility) */
  variant?: string
  /** Optional label (kept for backwards compatibility) */
  label?: string
  /** Optional context (kept for backwards compatibility) */
  pageContext?: string
}

export function AdBanner({
  className = '',
}: AdBannerProps) {
  return null
}

/**
 * Standard Native Ad Bar fallback component
 */
export function NativeAdBar({ className = '' }: { className?: string }) {
  return <AdBanner className={className} />
}
