import type { ReactNode } from 'react'

interface TruncatedTextProps {
  /** The text to display. Also rendered into the `title` attribute so the full
   *  string is available on hover (per CLAUDE.md R1 rule: never silently
   *  truncate text without a way to see the full content). */
  text: string
  /** Optional className additions. Base classes include `min-w-0 truncate flex-1`
   *  so the text fits inside its flex parent without pushing siblings. */
  className?: string
  /** Override the rendered tag (default `<span>`). Use when the text sits in
   *  a `<p>` or `<div>` for semantic reasons. */
  as?: 'span' | 'p' | 'div'
  /** Optional children that REPLACE the default `{text}` render. Useful when
   *  the caller wants a different inner element (e.g. `<span className="uppercase">`). */
  children?: ReactNode
}

/**
 * Phase 26 hotfix — Truncates text with CSS ellipsis inside a flex
 * container, while exposing the full text via `title` attribute on hover.
 *
 * Pattern (per CLAUDE.md Pitfall "Server-action try/catch swallows
 * NEXT_REDIRECT" generalization — anything that grows inside a fixed
 * flex row will push its siblings, so always pair width-control with
 * hover-disclosure):
 *   <div className="flex items-center gap-3 min-w-0">
 *     <Icon className="flex-shrink-0" />
 *     <TruncatedText text={label} />
 *     <Chevron className="flex-shrink-0 ml-auto" />
 *   </div>
 *
 * Why `min-w-0` + `flex-1`:
 * - `min-w-0` lets the flex item shrink below its content's natural width
 *   (default `min-width: auto` resists shrinking).
 * - `flex-1` claims any leftover space, so the icon stays left, the
 *   chevron stays right, and the text takes the middle.
 * - `truncate` applies `overflow: hidden; text-overflow: ellipsis;
 *   white-space: nowrap` so long strings become "…" instead of wrapping.
 */
export function TruncatedText({
  text,
  className = '',
  as: Tag = 'span',
  children,
}: TruncatedTextProps) {
  return (
    <Tag
      className={`min-w-0 truncate flex-1 ${className}`.trim()}
      title={text}
    >
      {children ?? text}
    </Tag>
  )
}
