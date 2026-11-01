/**
 * Openly licensed pictures used on the customer pages, with their credits.
 * They show the world around the hotel (the plant it is named after, the
 * road it stands on) — never the hotel's own rooms. Files live in
 * `public/found/`; `public/found/credits.json` keeps the full source record.
 * The footer prints every credit, so add new pictures here, not inline.
 */
export interface FoundImage {
  src: string
  width: number
  height: number
  /** What the picture shows, per locale. */
  alt: { th: string; en: string }
  title: string
  creator: string
  license: string
  licenseUrl: string
  page: string
}

export const GINGER_PLATE: FoundImage = {
  src: '/found/ginger-koehler-1896.png',
  width: 1920,
  height: 2501,
  alt: {
    th: 'ภาพพฤกษศาสตร์ของต้นขิง ใบ ดอก และเหง้า จากหนังสือพืชสมุนไพรของ Köhler ปี 1896',
    en: 'Botanical plate of the ginger plant, its leaves, flower and root, from Köhler’s Medicinal Plants, 1896',
  },
  title: 'Illustration of Zingiber officinale',
  creator: 'Franz Eugen Köhler, 1896',
  license: 'CC0',
  licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/deed.en',
  page: 'https://commons.wikimedia.org/wiki/File:Illustration_of_Zingiber_officinale.png',
}

export const SUKHUMVIT_ROAD: FoundImage = {
  src: '/found/sukhumvit-road-2024.jpg',
  width: 3200,
  height: 1800,
  alt: {
    th: 'ถนนสุขุมวิทยามค่ำ ใต้ทางรถไฟฟ้า BTS รถติดไฟแดงยาวไปถึงตึกสูง',
    en: 'Sukhumvit Road at night under the BTS skytrain, traffic running towards the towers',
  },
  title: 'Bangkok, Thailand, Sukhumvit Road, 2024',
  creator: 'OPK-Photography',
  license: 'CC BY-SA 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  page: 'https://commons.wikimedia.org/wiki/File:Bangkok,_Thailand,_Sukhumvit_Road,_2024.jpg',
}

export const FOUND_IMAGES: FoundImage[] = [GINGER_PLATE, SUKHUMVIT_ROAD]
