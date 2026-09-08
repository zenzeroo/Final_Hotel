'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { MaterialIcon } from '../ui/MaterialIcon'

export function FilterChips() {
  const router = useRouter()
  const params = useSearchParams()

  const activeChips: Array<{ key: string; label: string }> = []

  const type = params.get('type')
  if (type) activeChips.push({ key: 'type', label: `ประเภท: ${type}` })

  const floor = params.get('floor')
  if (floor) activeChips.push({ key: 'floor', label: `ชั้น ${floor}` })

  const priceRange = params.get('priceRange')
  if (priceRange) {
    const label =
      priceRange === 'under3000'
        ? 'ต่ำกว่า ฿3,000'
        : priceRange === '3000-6000'
        ? '฿3,000 - ฿6,000'
        : 'มากกว่า ฿6,000'
    activeChips.push({ key: 'priceRange', label: `ราคา: ${label}` })
  }

  if (activeChips.length === 0) return null

  const removeChip = (key: string) => {
    const next = new URLSearchParams(params.toString())
    next.delete(key)
    router.replace(`/rooms?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {activeChips.map((chip) => (
        <button
          key={chip.key}
          onClick={() => removeChip(chip.key)}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-on-primary rounded-full text-label-md font-semibold hover:bg-primary-container transition-colors duration-200"
        >
          <span>{chip.label}</span>
          <MaterialIcon name="close" size={14} />
        </button>
      ))}
    </div>
  )
}
