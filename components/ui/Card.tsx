import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  hoverable?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const PADDING_STYLES = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
}

export function Card({
  children,
  hoverable = false,
  padding = 'md',
  className = '',
  ...rest
}: CardProps) {
  const classes = [
    'bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient)',
    PADDING_STYLES[padding],
    hoverable ? 'transition-shadow duration-300 hover:shadow-(--shadow-ambient-md)' : '',
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
