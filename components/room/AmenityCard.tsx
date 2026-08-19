import { MaterialIcon } from '../ui/MaterialIcon'
import type { Amenity } from '@/lib/data/types'

interface AmenityCardProps {
  amenity: Amenity
}

export function AmenityCard({ amenity }: AmenityCardProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-surface-container-low rounded-xl">
      <span
        className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-secondary shrink-0"
        aria-hidden
      >
        <MaterialIcon name={amenity.icon} size={24} />
      </span>
      <span className="text-body-md text-on-surface font-medium">{amenity.name_th}</span>
    </div>
  )
}
