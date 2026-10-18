import { listAllCustomers } from '@/lib/data/staff'
import { formatDate } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { CustomerSearch } from './CustomerSearch'
import { LOCALE_BCP47 } from '@/lib/i18n/config'
import { getLocale } from '@/lib/i18n/getLocale'
import { getT } from '@/lib/i18n/t'

export const dynamic = 'force-dynamic'

export default async function CustomersPage(props: PageProps<'/reception/customers'>) {
  const locale = await getLocale()
  const t = getT(locale)
  const searchParams = await props.searchParams
  const q = typeof searchParams.q === 'string' ? searchParams.q : ''
  const result = await listAllCustomers({ search: q })
  const customers = result.rows

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">{t('reception.customersPage.title')}</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          {t('reception.customersPage.subtitle')}
        </p>
      </div>

      <CustomerSearch initialQuery={q} />

      {q && customers.length === 0 && (
        <div className="mt-8 text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant">
          <MaterialIcon name="person_off" size={48} className="text-outline-variant mx-auto mb-3" />
          <p className="text-body-md text-on-surface-variant">{t('reception.customersPage.noMatch', { q })}</p>
        </div>
      )}

      {customers.length > 0 && (
        <div className="mt-6 bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient) border border-outline-variant overflow-x-auto overflow-y-hidden">
          <p className="text-body-md text-on-surface-variant px-4 pt-3 pb-1">
            {t('reception.customersPage.countPeople', { count: result.total })}
          </p>
          <table className="w-full">
            <thead className="bg-surface-container">
              <tr>
                <Th>{t('reception.customersPage.colName')}</Th>
                <Th>{t('reception.customersPage.colPhone')}</Th>
                <Th>{t('reception.customersPage.colJoined')}</Th>
                <Th align="right">{t('reception.customersPage.colActions')}</Th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-outline-variant hover:bg-primary-fixed transition-colors">
                  <Td>
                    <p className="text-body-md font-medium text-on-surface">{c.full_name ?? '—'}</p>
                    <p className="text-caption text-on-surface-variant font-mono">#{c.id.slice(0, 8)}</p>
                  </Td>
                  <Td>
                    <span className="text-body-md text-on-surface">{c.phone ?? '—'}</span>
                  </Td>
                  <Td>
                    <span className="text-body-md text-on-surface-variant">
                      {formatDate(c.created_at, LOCALE_BCP47[locale])}
                    </span>
                  </Td>
                  <Td align="right">
                    <a
                      href={`/reception/bookings?q=${encodeURIComponent(c.full_name ?? '')}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary text-primary text-caption font-semibold uppercase tracking-wider hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
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

      {!q && (
        <div className="mt-8 text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant">
          <MaterialIcon name="search" size={48} className="text-outline-variant mx-auto mb-3" />
          <p className="text-body-md text-on-surface-variant">{t('reception.customersPage.typeToSearch')}</p>
        </div>
      )}
    </div>
  )
}

function Th({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <th
      className={`px-4 py-3 text-caption text-on-surface-variant uppercase tracking-wider font-semibold ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      {children}
    </th>
  )
}

function Td({ children, align }: { children: React.ReactNode; align?: 'left' | 'right' }) {
  return (
    <td className={`px-4 py-3 ${align === 'right' ? 'text-right' : 'text-left'}`}>{children}</td>
  )
}
