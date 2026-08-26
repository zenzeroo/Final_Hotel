import Image from 'next/image'
import Link from 'next/link'
import { r2Url } from '@/lib/r2/publicUrl'
import { RegisterForm } from './RegisterForm'

export default async function RegisterPage(props: PageProps<'/register'>) {
  const searchParams = await props.searchParams
  const next = typeof searchParams.next === 'string' ? searchParams.next : '/'
  // Phase 14 — surface OAuth callback failures into the form banner.
  const errorMessage = mapOAuthError(searchParams.error)

  return (
    <main className="min-h-screen relative flex items-center justify-center px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) py-12">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src={r2Url('hero/home-hero.webp')}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-primary/60 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-transparent to-primary/70" />
      </div>

      {/* Card */}
      <div className="relative z-10 w-full max-w-md bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient-lg) p-8 md:p-10">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2 mb-2">
          <span className="material-symbols-outlined text-primary" style={{ fontSize: '32px' }}>
            spa
          </span>
          <span className="font-display text-2xl font-bold text-primary">Zenzero Hotel</span>
        </div>

        <div className="text-center mb-8">
          <h1 className="font-display text-3xl font-bold text-primary">สร้างบัญชีใหม่</h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            เริ่มต้นประสบการณ์พักผ่อนที่เหนือระดับ
          </p>
        </div>

        <RegisterForm next={next} errorMessage={errorMessage} />

        <p className="mt-8 text-center text-body-md text-on-surface-variant">
          มีบัญชีอยู่แล้ว?{' '}
          <Link
            href={`/login${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="text-primary font-semibold hover:text-secondary transition-colors"
          >
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </main>
  )
}

/** Phase 14 — same mapping as LoginPage. */
function mapOAuthError(error: string | string[] | undefined): string | undefined {
  const value = Array.isArray(error) ? error[0] : error
  switch (value) {
    case 'oauth_cancelled':
      return 'ยกเลิกการสมัครสมาชิกด้วย Google แล้ว'
    case 'oauth_failed':
      return 'สมัครสมาชิกด้วย Google ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
    default:
      return undefined
  }
}
