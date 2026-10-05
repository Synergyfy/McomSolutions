import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../lib/utils';

export interface CHSLogoProps {
  /**
   * 'full': The full horizontal CHS logo (Globe inside C + H + S)
   * 'icon': The square icon mark (C with globe and orbital swooshes)
   */
  variant?: 'full' | 'icon';
  /**
   * Predefined height sizes or override with className
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  /**
   * Optional accompanying text / subtitle next to or below the logo
   */
  showText?: boolean;
  title?: string;
  subtitle?: string;
  /**
   * Wrap with a react-router Link to this destination (e.g. '/')
   */
  linkTo?: string;
  className?: string;
  imageClassName?: string;
  alt?: string;
  priority?: boolean;
}

const SIZE_MAP_FULL: Record<string, string> = {
  xs: 'h-6',
  sm: 'h-8',
  md: 'h-10',
  lg: 'h-12',
  xl: 'h-16',
  '2xl': 'h-20',
};

const SIZE_MAP_ICON: Record<string, string> = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
  '2xl': 'w-20 h-20',
};

export const CHS_LOGO_FULL = '/chs-logo-transparent.png';
export const CHS_LOGO_ICON = '/chs-icon.png';
export const CHS_COMPANY_NAME = 'Central Hub Solution';
export const CHS_SHORT_NAME = 'CHS';

export default function CHSLogo({
  variant = 'full',
  size = 'md',
  showText = false,
  title,
  subtitle,
  linkTo,
  className,
  imageClassName,
  alt = 'Central Hub Solution (CHS)',
}: CHSLogoProps) {
  const src = variant === 'icon' ? CHS_LOGO_ICON : CHS_LOGO_FULL;
  const defaultSizeClass = variant === 'icon' ? SIZE_MAP_ICON[size] : SIZE_MAP_FULL[size];

  const logoImg = (
    <img
      src={src}
      alt={alt}
      className={cn(
        'object-contain transition-transform duration-200 select-none',
        defaultSizeClass,
        variant === 'full' && 'w-auto',
        imageClassName
      )}
      loading="eager"
      decoding="async"
    />
  );

  const content = (
    <div className={cn('inline-flex items-center gap-3', className)}>
      {logoImg}
      {(showText || subtitle || title) && (
        <div className="flex flex-col">
          {title && (
            <span className="font-bold tracking-tight text-gray-900 leading-tight">
              {title}
            </span>
          )}
          {subtitle && (
            <span className="text-[10px] font-bold text-brand-blue uppercase tracking-widest leading-none mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="inline-flex items-center group focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue rounded-lg">
        {content}
      </Link>
    );
  }

  return content;
}
