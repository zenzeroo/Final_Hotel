import amenitiesJson from '../../data/mock-amenities.json'
import type { Amenity } from '@/lib/data/types'
import { AmenityCard } from './AmenityCard'

interface AmenityGridProps {
  amenitySlugs: string[]
}

const amenities: Amenity[] = amenitiesJson as Amenity[]

export function AmenityGrid({ amenitySlugs }: AmenityGridProps) {
  const items = amenities.filter((a) => amenitySlugs.includes(a.slug))

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((a) => (
        <AmenityCard key={a.slug} amenity={a} />
      ))}
    </div>
  )
}
