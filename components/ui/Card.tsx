import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /**
   * When true, hover lifts the card shadow (existing variant).
   * Kept as a separate prop for backward compat with cards that want
   * a softer hover (e.g. a settings card that just deepens slightly).
   */
  hoverable?: boolean
  /**
   * Phase 26 — when true, the card lifts on hover (RoomCard-style
   * polish: shadow upgrade + -translate-y-1 + smooth transition).
   * Establishes the canonical hover-lift vocabulary.
   */
  lift?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const PADDING_STYLES = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

const HOVER_LIFT =
  'transition-all duration-300 hover:shadow-(--shadow-ambient-md) hover:-translate-y-1'
const HOVER_SHADOW = 'transition-shadow duration-300 hover:shadow-(--shadow-ambient-md)'

export function Card({
  children,
  hoverable = false,
  lift = false,
  padding = 'md',
  className = '',
  ...rest
}: CardProps) {
  const classes = [
    'bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient)',
    PADDING_STYLES[padding],
    lift ? HOVER_LIFT : hoverable ? HOVER_SHADOW : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  )
}
