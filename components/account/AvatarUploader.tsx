'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { r2Url } from '@/lib/r2/publicUrl'
import { uploadAvatarAction } from '@/app/actions/account'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface AvatarUploaderProps {
  avatarKey: string | null
  fullName: string
}

/**
 * Client island — renders the avatar circle with a camera-button overlay.
 * The "photo_camera" button opens a hidden file picker; selecting a JPEG /
 * PNG / WebP file (≤ 2 MB) submits to `uploadAvatarAction` which puts the
 * file in R2 and updates `profiles.avatar_key`.
 *
 * Falls back to initials when no `avatarKey` is set (matches the existing
 * TopNavBar avatar pattern).
 */
export function AvatarUploader({ avatarKey, fullName }: AvatarUploaderProps) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Show a local preview immediately after the user picks a file, before
  // the upload finishes. Falls back to the persisted avatar once cleared.
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  const handlePick = () => inputRef.current?.click()

  const handleFile = (file: File) => {
    setError(null)
    if (file.size > 2 * 1024 * 1024) {
      setError('ไฟล์ต้องมีขนาดไม่เกิน 2 MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('รองรับเฉพาะ JPEG, PNG, WebP')
      return
    }
    setPreview(URL.createObjectURL(file))
  }

  return (
    <div className="relative w-32 h-32 mb-gutter">
      <div className="w-32 h-32 rounded-full overflow-hidden bg-surface-container border-2 border-primary-fixed shadow-sm">
        {preview || avatarKey ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={`รูปโปรไฟล์ของ ${fullName}`}
            className="w-full h-full object-cover"
            src={preview || r2Url(avatarKey)}
          />
        ) : (
          <div className="w-full h-full inline-flex items-center justify-center bg-primary text-secondary font-headline-sm text-headline-sm">
            {initials(fullName)}
          </div>
        )}
      </div>
      <button
        type="button"
        aria-label="เปลี่ยนรูปโปรไฟล์"
        onClick={handlePick}
        className="absolute bottom-0 right-0 bg-primary text-on-primary w-9 h-9 rounded-full flex items-center justify-center border-2 border-surface-container-lowest hover:bg-primary-fixed hover:text-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
      >
        <MaterialIcon name="photo_camera" size={18} />
      </button>
      <UploadForm
        inputRef={inputRef}
        onFile={handleFile}
        onError={setError}
        onSuccess={() => {
          setError(null)
          setPreview(null)
          // Re-fetch Server Components so TopNavBar re-reads getSession()
          // and renders the new avatar immediately. revalidatePath
          // ('/', 'layout') in uploadAvatarAction already invalidated
          // the route cache; this just consumes the new data.
          router.refresh()
        }}
      />
      {error && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap text-caption text-error">
          {error}
        </div>
      )}
    </div>
  )
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2)
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'
}

/**
 * Renders a hidden file input + a form that fires the upload action.
 * Submitted via `requestSubmit` on the form when the user picks a file
 * (instead of requiring a separate submit click).
 */
function UploadForm({
  inputRef,
  onFile,
  onError,
  onSuccess,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  onFile: (file: File) => void
  onError: (msg: string) => void
  onSuccess: () => void
}) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        const result = await uploadAvatarAction(null, formData)
        if (result.ok) onSuccess()
        else onError(result.error)
      }}
    >
      <input
        ref={inputRef}
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          onFile(file)
          // Submit the surrounding form automatically.
          formRef.current?.requestSubmit()
          // Reset input value so picking the same file twice fires change.
          e.target.value = ''
        }}
      />
    </form>
  )
}