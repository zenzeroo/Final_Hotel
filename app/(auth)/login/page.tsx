import Image from 'next/image'
import Link from 'next/link'
import { r2Url } from '@/lib/r2/publicUrl'
import { LoginForm } from './LoginForm'

export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams
  const next = typeof searchParams.next === 'string' ? searchParams.next : '/'

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
          <h1 className="font-display text-3xl font-bold text-primary">ยินดีต้อนรับกลับมา</h1>
          <p className="text-body-md text-on-surface-variant mt-2">
            เข้าสู่ระบบเพื่อจัดการการจองของคุณ
          </p>
        </div>

        <LoginForm next={next} />

        <p className="mt-8 text-center text-body-md text-on-surface-variant">
          ยังไม่มีบัญชี?{' '}
          <Link
            href={`/register${next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`}
            className="text-primary font-semibold hover:text-secondary transition-colors"
          >
            สมัครสมาชิก
          </Link>
        </p>
      </div>
    </main>
  )
}
