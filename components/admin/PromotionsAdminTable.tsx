'use client'

import Link from 'next/link'
import { useState, useTransition } from 'react'
import type { Promotion } from '@/lib/data/types'
import { formatDiscount } from '@/lib/pricing'
import { formatDateRange } from '@/lib/dates'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { useLocale } from '@/lib/i18n/useT'
import { TogglePromotionButton } from '@/components/manager/TogglePromotionButton'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ConfirmModal } from '@/components/ui/ConfirmModal'
import { deletePromotionAction } from '@/app/actions/promotions'
import { useT } from '@/lib/i18n/useT'

interface PromotionsAdminTableProps {
  promotions: Promotion[]
  now: Date
}

function isExpired(p: Promotion, now: Date): boolean {
  return new Date(p.valid_until).getTime() < now.getTime()
}

function isUpcoming(p: Promotion, now: Date): boolean {
  return new Date(p.valid_from).getTime() > now.getTime()
}

function DeleteButton({ id, code }: { id: string; code: string }) {
  const t = useT()
  const [pending, startTransition] = useTransition()
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null)

  async function handleConfirm() {
    const fd = new FormData()
    fd.set('id', id)
    setConfirmMessage(null)
    startTransition(async () => {
      await deletePromotionAction(fd)
    })
  }

  return (
    <>
      <form
        action={(fd) => {
          // Form action kept for keyboard/screen-reader submission; in
          // practice the CenterModal/ConfirmModal path runs first.
          void fd
          setConfirmMessage(
            t('admin.promotions.deleteConfirm', { code }),
          )
        }}
        className="inline"
      >
        <input type="hidden" name="id" value={id} />
        <button
          type="button"
          onClick={() =>
            setConfirmMessage(
              t('admin.promotions.deleteConfirm', { code }),
            )
          }
          disabled={pending}
          title={t('admin.promotions.deleteTitle', { code })}
          className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-error hover:bg-error-container transition-colors disabled:opacity-60"
        >
          <MaterialIcon name="delete" size={18} />
        </button>
      </form>
      {confirmMessage && (
        <ConfirmModal
          open
          body={confirmMessage}
          variant="danger"
          okLabel={t('admin.common.delete')}
          onCancel={() => setConfirmMessage(null)}
          onConfirm={handleConfirm}
        />
      )}
    </>
  )
}

export function PromotionsAdminTable({ promotions, now }: PromotionsAdminTableProps) {
  const t = useT()
  const localeBcp = LOCALE_BCP47[useLocale()]
  if (promotions.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-12 text-center">
        <MaterialIcon name="local_offer" size={48} className="text-on-surface-variant mb-3" />
        <p className="text-body-lg text-on-surface-variant">{t('admin.promotions.empty')}</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-surface-container-low border-b border-outline-variant">
            <tr className="text-label-md uppercase tracking-wider text-on-surface-variant">
              <th className="text-left px-4 py-3 font-medium">{t('admin.promotions.colCode')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('admin.promotions.colName')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('admin.promotions.colDiscount')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('admin.promotions.colAppliesTo')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('admin.promotions.colMinNights')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('admin.promotions.colPeriod')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('admin.common.status')}</th>
              <th className="text-right px-4 py-3 font-medium">{t('admin.common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {promotions.map((p) => {
              const expired = isExpired(p, now)
              const upcoming = isUpcoming(p, now)
              return (
                <tr key={p.id} className="hover:bg-primary-fixed transition-colors">
                  <td className="px-4 py-4">
                    <span className="font-mono text-body-md font-bold text-primary bg-secondary-container px-2 py-1 rounded">
                      {p.code}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-body-md font-medium text-primary">{p.name}</p>
                    {p.description && (
                      <p className="text-caption text-on-surface-variant mt-0.5">
                        {p.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <span className="text-body-md font-semibold text-secondary">
                      {formatDiscount(p)}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-caption text-on-surface-variant">
                    {p.applies_to_room_types && p.applies_to_room_types.length > 0
                      ? p.applies_to_room_types.join(', ')
                      : t('admin.common.all')}
                  </td>
                  <td className="px-4 py-4 text-body-md text-on-surface">
                    {t('admin.promotions.nights', { count: p.min_nights })}
                  </td>
                  <td className="px-4 py-4 text-caption text-on-surface-variant">
                    {formatDateRange(p.valid_from, p.valid_until, localeBcp)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-1 items-start">
                      {expired && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] uppercase tracking-wider font-semibold">
                          <MaterialIcon name="schedule" size={12} />
                          {t('admin.promotions.expired')}
                        </span>
                      )}
                      {upcoming && !expired && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-[10px] uppercase tracking-wider font-semibold">
                          <MaterialIcon name="event_upcoming" size={12} />
                          {t('admin.promotions.upcoming')}
                        </span>
                      )}
                      {!p.is_active && !expired && !upcoming && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] uppercase tracking-wider font-semibold">
                          <MaterialIcon name="pause" size={12} />
                          {t('admin.promotions.inactive')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="inline-flex items-center gap-1">
                      <TogglePromotionButton promotionId={p.id} isActive={p.is_active} />
                      <Link
                        href={`/admin/promotions/${p.id}/edit`}
                        title={t('admin.common.edit')}
                        className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-on-surface hover:bg-primary-fixed hover:text-primary transition-colors"
                      >
                        <MaterialIcon name="edit" size={18} />
                      </Link>
                      <DeleteButton id={p.id} code={p.code} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
