import Image from 'next/image'
import { r2Url } from '@/lib/r2/publicUrl'
import { SearchBar } from '../search/SearchBar'

export function HeroSection() {
  return (
    <section className="relative h-[85vh] min-h-[600px] flex items-center justify-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src={r2Url('hero/home-hero.webp')}
          alt="Zenzero Hotel exterior"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-primary/40 mix-blend-multiply" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-primary/60" />
      </div>

      {/* Heading — positioned in the upper-middle area of the hero (above the
          center line, below the top edge) so the SearchBar has room to sit
          below it. Centered vertically via -translate-y-1/2. */}
      <div className="absolute top-[38%] left-0 right-0 z-10 -translate-y-1/2 px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) flex flex-col items-center text-center pointer-events-none">
        <span className="text-label-md text-secondary font-semibold uppercase tracking-wider mb-4">
          ความหรูหราจากธรรมชาติ
        </span>
        <h1 className="font-display text-4xl md:text-6xl lg:text-7xl text-on-primary font-bold leading-tight max-w-3xl">
          ค้นหาห้องพักในฝันของคุณ
        </h1>
        <p className="text-body-lg text-on-primary/90 mt-6 max-w-xl">
          สัมผัสความหรูหราที่เป็นธรรมชาติ — ทุกรายละเอียดถูกรังสรรค์เพื่อการพักผ่อน การไตร่ตรอง และความมหัศจรรย์อันเงียบสงบ
        </p>
      </div>

      {/* Floating search bar — positioned in the upper-middle area of the hero,
          below the heading block. Uses `variant="overlay"` so date/guests
          changes debounced-navigate to /rooms (or update in-place if already
          on /rooms). Mobile falls back to bottom for thumb-reach. */}
      <div className="absolute inset-x-0 z-20 px-(--spacing-margin-mobile) md:px-(--spacing-margin-desktop) bottom-0 pb-6 md:bottom-auto md:top-[80%] md:pb-0">
        <div className="max-w-(--spacing-container-max) mx-auto">
          <SearchBar variant="hero" />
        </div>
      </div>
    </section>
  )
}
