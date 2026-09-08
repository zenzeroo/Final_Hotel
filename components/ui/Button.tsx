import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'

interface BaseProps {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  children: ReactNode
  className?: string
}

type ButtonAsButton = BaseProps & ComponentProps<'button'> & { href?: undefined }
type ButtonAsLink = BaseProps & ComponentProps<typeof Link> & { href: string }

type ButtonProps = ButtonAsButton | ButtonAsLink

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-primary text-on-primary border border-primary hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed',
  secondary:
    'bg-transparent text-primary border border-primary hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed',
  ghost:
    'bg-transparent text-on-surface hover:bg-primary-fixed hover:text-primary',
}

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-label-md',
  md: 'px-6 py-3 text-label-md',
  lg: 'px-8 py-4 text-body-md',
}

const BASE_STYLES =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold tracking-wider uppercase transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary'

export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    fullWidth = false,
    children,
    className = '',
  } = props

  const classes = `${BASE_STYLES} ${VARIANT_STYLES[variant]} ${SIZE_STYLES[size]} ${fullWidth ? 'w-full' : ''} ${className}`.trim()

  if ('href' in props && props.href !== undefined) {
    const { href, ...rest } = props
    return (
      <Link href={href} className={classes} {...rest}>
        {children}
      </Link>
    )
  }

  const { ...rest } = props as ButtonAsButton
  return (
    <button className={classes} {...rest}>
      {children}
    </button>
  )
}
