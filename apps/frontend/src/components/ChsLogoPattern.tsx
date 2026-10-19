import React from 'react';

/** Subtle, staggered CHS wordmark pattern for registration surfaces. */
export default function ChsLogoPattern({ className = '' }: { className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-[0.16] ${className}`}>
      <div className="absolute inset-x-0 -top-7 flex flex-col gap-2">
        {Array.from({ length: 26 }, (_, row) => (
          <div
            key={row}
            className="flex h-8 w-max shrink-0 items-center gap-3"
            style={{ transform: `translateX(${((row % 5) - 2) * 14}px)` }}
          >
            {Array.from({ length: 30 }, (_, column) => (
              <img
                key={column}
                src="/chs-logo-transparent.png"
                alt=""
                draggable="false"
                className="w-14 shrink-0 select-none object-contain sm:w-16"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
