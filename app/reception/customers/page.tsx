import { searchCustomers } from '@/lib/data/staff'
import { formatDate } from '@/lib/dates'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { CustomerSearch } from './CustomerSearch'

export const dynamic = 'force-dynamic'

export default async function CustomersPage(props: PageProps<'/reception/customers'>) {
  const searchParams = await props.searchParams
  const q = typeof searchParams.q === 'string' ? searchParams.q : ''
  const customers = q ? await searchCustomers(q) : []

  return (
    <div className="p-6 md:p-8">
      <div className="mb-6">
        <h1 className="font-display text-3xl text-primary">ค้นหาลูกค้า</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          ค้นหาด้วยชื่อ-นามสกุล หรือเบอร์โทรศัพท์
        </p>
      </div>

      <CustomerSearch initialQuery={q} />

      {q && customers.length === 0 && (
        <div className="mt-8 text-center py-16 bg-surface-container-lowest rounded-2xl border border-outline-variant">
          <MaterialIcon name="person_off" size={48} className="text-outline-variant mx-auto mb-3" />
          <p className="text-body-md text-on-surface-variant">ไม่พบลูกค้าที่ตรงกับ "{q}"</p>
        </div>
      )}

      {customers.length > 0 && (
        <div className="mt-6 bg-surface-container-lowest rounded-2xl shadow-(--shadow-ambient) border border-outline-variant overflow-x-auto overflow-y-hidden">
          <table className="w-full">
            <thead className="bg-surface-container">
              <tr>
                <Th>ชื่อ</Th>
                <Th>เบอร์โทร</Th>
                <Th>สมัครเมื่อ</Th>
                <Th align="right">ดำเนินการ</Th>
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
                      {formatDate(c.created_at)}
                    </span>
                  </Td>
                  <Td align="right">
                    <a
                      href={`/reception/bookings?q=${encodeURIComponent(c.full_name ?? '')}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-primary text-primary text-caption font-semibold uppercase tracking-wider hover:bg-primary-fixed hover:text-primary hover:border-primary-fixed transition-colors"
                    >
                      <MaterialIcon name="bookmark" size={14} />
                      ดูการจอง
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
          <p className="text-body-md text-on-surface-variant">พิมพ์ชื่อหรือเบอร์โทรเพื่อค้นหา</p>
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
