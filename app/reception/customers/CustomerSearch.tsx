'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { MaterialIcon } from '@/components/ui/MaterialIcon'

interface CustomerSearchProps {
  initialQuery: string
}

export function CustomerSearch({ initialQuery }: CustomerSearchProps) {
  const router = useRouter()
  const params = useSearchParams()
  const [q, setQ] = useState(initialQuery)

  useEffect(() => {
    setQ(initialQuery)
  }, [initialQuery])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const next = new URLSearchParams(params.toString())
    if (q) next.set('q', q)
    else next.delete('q')
    router.replace(`/reception/customers?${next.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 max-w-2xl">
      <div className="relative flex-1">
        <MaterialIcon
          name="search"
          size={20}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant"
        />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ชื่อ-นามสกุล หรือเบอร์โทรศัพท์"
          className="w-full bg-surface-container-lowest border border-outline-variant rounded-full pl-12 pr-4 py-3 text-body-md text-on-surface focus:border-secondary focus:ring-1 focus:ring-secondary transition-colors"
        />
      </div>
      <button
        type="submit"
        className="px-6 py-3 bg-primary text-secondary rounded-full font-semibold text-label-md uppercase tracking-wider hover:bg-primary-container transition-colors"
      >
        ค้นหา
      </button>
    </form>
  )
}
