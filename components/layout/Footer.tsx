import Link from 'next/link'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export async function Footer() {
  const year = new Date().getFullYear()
  const t = getT(await getLocale())
  return (
    <footer className="bg-primary text-secondary py-16 mt-20">
      <div className="max-w-(--spacing-container-max) mx-auto px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) flex flex-col items-center gap-8">
        <Link
          href="/"
          className="font-display text-3xl font-bold text-secondary"
        >
          Zenzero Hotel
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-body-md">
          <FooterLink href="/privacy">{t('footer.privacy')}</FooterLink>
          <FooterLink href="/terms">{t('footer.terms')}</FooterLink>
          <FooterLink href="/contact">{t('footer.contact')}</FooterLink>
          <FooterLink href="/careers">{t('footer.careers')}</FooterLink>
        </nav>

        <p className="text-caption text-secondary/70">{t('footer.copyright').replace('2024', String(year))}</p>
      </div>
    </footer>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="text-secondary/80 hover:text-secondary transition-colors"
    >
      {children}
    </Link>
  )
}
