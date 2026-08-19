import Link from 'next/link'

export function Footer() {
  const year = new Date().getFullYear()
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
          <FooterLink href="/privacy">Privacy Policy</FooterLink>
          <FooterLink href="/terms">Terms of Service</FooterLink>
          <FooterLink href="/contact">Contact Us</FooterLink>
          <FooterLink href="/careers">Careers</FooterLink>
        </nav>

        <p className="text-caption text-secondary/70">
          © {year} Zenzero Hotel. All rights reserved.
        </p>
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
