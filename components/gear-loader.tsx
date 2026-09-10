'use client'

import React from 'react'

interface GearLoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  text?: string
  subtext?: string
  className?: string
  variant?: 'blue' | 'emerald' | 'amber' | 'dark'
}

export function GearLoader({
  size = 'md',
  text = 'Yuklanmoqda...',
  subtext,
  className = '',
  variant = 'blue',
}: GearLoaderProps) {
  const sizeMap = {
    sm: { main: 28, sec: 18, third: 14, gap: 'gap-2', font: 'text-xs' },
    md: { main: 44, sec: 28, third: 20, gap: 'gap-3', font: 'text-sm' },
    lg: { main: 64, sec: 40, third: 28, gap: 'gap-4', font: 'text-base' },
    xl: { main: 88, sec: 56, third: 38, gap: 'gap-5', font: 'text-lg' },
  }

  const colorMap = {
    blue: {
      gear1: 'text-blue-600',
      gear2: 'text-indigo-500',
      gear3: 'text-sky-400',
      textColor: 'text-slate-800',
      subColor: 'text-slate-500',
      badgeBg: 'bg-blue-50 border-blue-200 text-blue-700',
    },
    emerald: {
      gear1: 'text-emerald-600',
      gear2: 'text-teal-500',
      gear3: 'text-green-400',
      textColor: 'text-slate-800',
      subColor: 'text-slate-500',
      badgeBg: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    },
    amber: {
      gear1: 'text-amber-600',
      gear2: 'text-orange-500',
      gear3: 'text-yellow-400',
      textColor: 'text-slate-800',
      subColor: 'text-slate-500',
      badgeBg: 'bg-amber-50 border-amber-200 text-amber-700',
    },
    dark: {
      gear1: 'text-blue-400',
      gear2: 'text-indigo-300',
      gear3: 'text-teal-300',
      textColor: 'text-white',
      subColor: 'text-slate-400',
      badgeBg: 'bg-slate-800 border-slate-700 text-slate-200',
    },
  }

  const s = sizeMap[size]
  const c = colorMap[variant]

  return (
    <div className={`flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-300 ${s.gap} ${className}`}>
      {/* Animated Interlocking 3-Gear System */}
      <div className="relative flex items-center justify-center" style={{ width: s.main * 1.7, height: s.main * 1.5 }}>
        {/* Main Big Gear (Rotates Clockwise) */}
        <div className={`absolute -top-1 -left-1 ${c.gear1} animate-[spin_4s_linear_infinite] drop-shadow-sm`}>
          <svg
            width={s.main}
            height={s.main}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
            <circle cx="12" cy="12" r="7" />
            <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.25" />
          </svg>
        </div>

        {/* Second Medium Gear (Rotates Counter-Clockwise - Interlocked) */}
        <div
          className={`absolute -bottom-1 right-0 ${c.gear2} animate-[spin_3s_linear_infinite_reverse] drop-shadow-sm`}
        >
          <svg
            width={s.sec}
            height={s.sec}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2.5" fill="currentColor" fillOpacity="0.3" />
          </svg>
        </div>

        {/* Third Small Top Gear (Rotates Clockwise Fast) */}
        <div
          className={`absolute top-0 right-1 ${c.gear3} animate-[spin_2s_linear_infinite] drop-shadow-sm`}
        >
          <svg
            width={s.third}
            height={s.third}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
            <circle cx="12" cy="12" r="5" />
            <circle cx="12" cy="12" r="2" fill="currentColor" fillOpacity="0.35" />
          </svg>
        </div>
      </div>

      {/* Text & Status */}
      {(text || subtext) && (
        <div className="space-y-1">
          {text && (
            <div className={`font-bold tracking-tight ${s.font} ${c.textColor} flex items-center justify-center gap-1.5`}>
              <span>{text}</span>
            </div>
          )}
          {subtext && (
            <p className={`text-xs ${c.subColor} max-w-xs mx-auto`}>
              {subtext}
            </p>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Inline Small Gear Spinner for Buttons
 */
export function ButtonGearSpinner({ className = 'size-4', isReverse = false }: { className?: string; isReverse?: boolean }) {
  return (
    <svg
      className={`${className} ${isReverse ? 'animate-[spin_2.5s_linear_infinite_reverse]' : 'animate-[spin_2.5s_linear_infinite]'}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="3" fill="currentColor" fillOpacity="0.3" />
    </svg>
  )
}

/**
 * Double Interlocked Gear Icon for Tab Buttons or Badges
 */
export function DoubleGearIcon({ className = 'size-4' }: { className?: string }) {
  return (
    <span className={`relative inline-flex items-center justify-center ${className}`}>
      <svg
        className="size-3.5 text-current animate-[spin_5s_linear_infinite]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="12" cy="12" r="7" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
      </svg>
      <svg
        className="size-2 text-current absolute -bottom-0.5 -right-0.5 animate-[spin_3s_linear_infinite_reverse]"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
      >
        <circle cx="12" cy="12" r="6" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2" />
      </svg>
    </span>
  )
}
