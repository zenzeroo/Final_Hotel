import Link from 'next/link'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'
import { FOUND_IMAGES } from '@/lib/found-images'

export async function Footer() {
  const year = new Date().getFullYear()
  const t = getT(await getLocale())
  return (
    <footer className="bg-primary text-on-primary py-16 mt-20">
      <div className="page-x flex flex-col items-center gap-8 text-center">
        <Link
          href="/"
          className="font-wordmark text-3xl font-bold text-secondary-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-container"
        >
          Zenzero Hotel
        </Link>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-body-md">
          <FooterLink href="/privacy">{t('footer.privacy')}</FooterLink>
          <FooterLink href="/terms">{t('footer.terms')}</FooterLink>
          <FooterLink href="/contact">{t('footer.contact')}</FooterLink>
          <FooterLink href="/careers">{t('footer.careers')}</FooterLink>
        </nav>

        <div className="flex flex-col gap-2 text-[13px] text-on-primary/80">
          <p>{t('footer.copyright').replace('2024', String(year))}</p>
          {/* Credits for the openly licensed pictures on the public pages (lib/found-images.ts). */}
          <p>
            {t('footer.credits')}{' '}
            {FOUND_IMAGES.map((img, i) => (
              <span key={img.src}>
                {i > 0 && ' · '}
                <a href={img.page} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                  {img.creator}
                </a>
                {', '}
                <a href={img.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline-offset-4 hover:underline">
                  {img.license}
                </a>
              </span>
            ))}
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-2 py-1 text-on-primary/90 hover:bg-primary-fixed hover:text-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary-container"
    >
      {children}
    </Link>
  )
}
