import { listBlacklistedCustomers } from '@/lib/data/staff'
import { formatDate } from '@/lib/dates'
import { maskPhone } from '@/lib/phone'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { BlacklistBadge } from '@/components/ui/BlacklistBadge'
import { CustomerSearch } from '../customers/CustomerSearch'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

/**
 * Reception — every blacklisted customer, searchable by name / email /
 * phone. View-only: adding or removing is done by an admin on
 * /admin/customers/[id].
 */
export default async function BlacklistPage(props: PageProps<'/reception/blacklist'>) {
  const locale = await getLocale()
  const t = getT(locale)
  const searchParams = await props.searchParams
  const q = typeof searchParams.q === 'string' ? searchParams.q : ''
  const { rows, total } = await listBlacklistedCustomers({ search: q })

  return (
    <div className="px-4 py-6 md:p-8 lg:p-12">
      <div className="mb-6">
        <h1 className="font-display text-2xl md:text-[28px] leading-[1.25] text-primary flex items-center gap-3">
          <MaterialIcon name="gpp_bad" size={28} className="text-error" />
          {t('reception.blacklistPage.title')}
        </h1>
        <p className="text-body-md text-on-surface-variant mt-1">{t('reception.blacklistPage.subtitle')}</p>
      </div>

      <CustomerSearch initialQuery={q} />

      {rows.length === 0 ? (
        <div className="mt-8 text-center py-16 bg-surface-container-lowest rounded-2xl">
          <MaterialIcon name="verified_user" size={40} className="text-on-surface-variant mx-auto mb-3" />
          <p className="text-body-md text-on-surface-variant">
            {q ? t('reception.blacklistPage.noMatch', { q }) : t('reception.blacklistPage.empty')}
          </p>
        </div>
      ) : (
        <div className="mt-6 bg-surface-container-lowest rounded-2xl overflow-x-auto overflow-y-hidden">
          <p className="text-[14px] text-on-surface-variant px-4 pt-4 pb-2">
            {t('reception.blacklistPage.countPeople', { count: total })}
          </p>
          <table className="w-full">
            <thead className="border-b border-surface-container">
              <tr>
                <Th>{t('reception.customersPage.colName')}</Th>
                <Th>{t('reception.customersPage.colEmail')}</Th>
                <Th>{t('reception.customersPage.colPhone')}</Th>
                <Th>{t('reception.blacklistPage.colReason')}</Th>
                <Th>{t('reception.blacklistPage.colSince')}</Th>
                <Th align="right">{t('reception.customersPage.colActions')}</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-surface-container first:border-t-0 bg-error-container/10 hover:bg-error-container/25 transition-colors">
                  <Td>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-body-md font-medium text-on-surface">{c.full_name ?? '—'}</p>
                      <BlacklistBadge label={t('admin.customersPage.statusBlacklisted')} />
                    </div>
                  </Td>
                  <Td>
                    <span className="text-body-md text-on-surface break-all">{c.email ?? '—'}</span>
                  </Td>
                  <Td>
                    {/* Masked on the server — the full number never reaches the browser. */}
                    <span className="text-body-md text-on-surface tabular-nums whitespace-nowrap">{maskPhone(c.phone) ?? '—'}</span>
                  </Td>
                  <Td>
                    <span className="text-body-md text-on-surface">{c.blacklisted_reason ?? '—'}</span>
                  </Td>
                  <Td>
                    <span className="text-body-md text-on-surface-variant whitespace-nowrap tabular-nums">
                      {c.blacklisted_at ? formatDate(c.blacklisted_at, LOCALE_BCP47[locale]) : '—'}
                    </span>
                  </Td>
                  <Td align="right">
                    <a
                      href={`/reception/bookings?q=${encodeURIComponent(c.full_name ?? '')}`}
                      className="inline-flex items-center gap-1.5 min-h-10 px-3 rounded-lg text-primary text-[14px] font-semibold whitespace-nowrap hover:bg-primary/10 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                    >
                      <MaterialIcon name="bookmark" size={14} />
                      {t('reception.customersPage.viewBookings')}
                    </a>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-4 py-3 text-[13px] text-on-surface-variant font-medium whitespace-nowrap ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Td({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={`px-4 py-4 ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</td>
  )
}
