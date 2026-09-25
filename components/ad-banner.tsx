'use client'

import { useEffect, useRef } from 'react'

export function AdBanner() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Avoid double injection if component re-mounts
    if (typeof window !== 'undefined' && containerRef.current && containerRef.current.children.length === 0) {
      const scriptConfig = document.createElement('script')
      scriptConfig.type = 'text/javascript'
      scriptConfig.innerHTML = `
        atOptions = {
          'key' : '56b3fbce57a92c544a70c5b0a2dc9e6c',
          'format' : 'iframe',
          'height' : 60,
          'width' : 468,
          'params' : {}
        };
      `
      containerRef.current.appendChild(scriptConfig)

      const scriptInvoke = document.createElement('script')
      scriptInvoke.type = 'text/javascript'
      scriptInvoke.src = 'https://www.highrevenueformat.com/56b3fbce57a92c544a70c5b0a2dc9e6c/invoke.js'
      containerRef.current.appendChild(scriptInvoke)
    }
  }, [])

  return (
    <div className="flex justify-center items-center my-6 overflow-hidden min-h-[60px] w-full bg-slate-50/50 rounded-lg py-2 border border-slate-100">
      <div ref={containerRef} className="ad-unit-container" />
    </div>
  )
}
