import { getApprovedAmenities } from '@/lib/data/rooms'
import { AmenityCard } from './AmenityCard'

interface AmenityGridProps {
  amenitySlugs: string[]
}

export async function AmenityGrid({ amenitySlugs }: AmenityGridProps) {
  const items = await getApprovedAmenities(amenitySlugs)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {items.map((a) => (
        <AmenityCard key={a.slug} amenity={a} />
      ))}
    </div>
  )
}