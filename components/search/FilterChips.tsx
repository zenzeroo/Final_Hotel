'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { MaterialIcon } from '../ui/MaterialIcon'
import { useT } from '@/lib/i18n/useT'
import { formatRoomTypesParam, parseRoomTypesParam } from '@/lib/search/roomTypes'

export function FilterChips() {
  const router = useRouter()
  const params = useSearchParams()
  const t = useT()

  // `remove` returns the params without this chip's filter.
  const activeChips: Array<{ key: string; label: string; remove: (p: URLSearchParams) => void }> = []
  const deleteKey = (key: string) => (p: URLSearchParams) => p.delete(key)

  // One chip per selected room type; removing it keeps the other types.
  const types = parseRoomTypesParam(params.get('type'))
  for (const type of types) {
    activeChips.push({
      key: `type:${type}`,
      label: t('customer.filters.type', { value: type }),
      remove: (p) => {
        const rest = types.filter((name) => name !== type)
        if (rest.length) p.set('type', formatRoomTypesParam(rest))
        else p.delete('type')
      },
    })
  }

  const floor = params.get('floor')
  if (floor) activeChips.push({ key: 'floor', label: t('customer.filters.floor', { value: floor }), remove: deleteKey('floor') })

  const priceRange = params.get('priceRange')
  if (priceRange) {
    const label =
      priceRange === 'under3000'
        ? t('roomsList.under3000')
        : priceRange === '3000-6000'
        ? t('roomsList.price3000to6000')
        : t('roomsList.over6000')
    activeChips.push({ key: 'priceRange', label: t('customer.filters.price', { value: label }), remove: deleteKey('priceRange') })
  }

  if (activeChips.length === 0) return null

  const removeChip = (chip: (typeof activeChips)[number]) => {
    const next = new URLSearchParams(params.toString())
    chip.remove(next)
    router.replace(`/rooms?${next.toString()}`, { scroll: false })
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-6">
      {activeChips.map((chip) => (
        <button
          key={chip.key}
          onClick={() => removeChip(chip)}
          className="inline-flex items-center gap-2 h-11 px-4 bg-primary-fixed text-primary text-body-md font-semibold hover:bg-primary hover:text-on-primary transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
        >
          <span>{chip.label}</span>
          <MaterialIcon name="close" size={16} />
        </button>
      ))}
    </div>
  )
}
