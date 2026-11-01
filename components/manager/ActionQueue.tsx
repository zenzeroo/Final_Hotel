import Link from 'next/link'
import type { DashboardAlert, DashboardAlertSeverity, ManagerActionQueue } from '@/lib/data/types'
import { actionKinds, seeAllShown, type ActionKind } from '@/lib/manager/action-queue'
import { formatTHB } from '@/lib/pricing'
import { formatDate } from '@/lib/dates'
import { LOCALE_BCP47, type Locale } from '@/lib/i18n/config'
import { getT } from '@/lib/i18n/t'
import { MaterialIcon } from '@/components/ui/MaterialIcon'
import { ApproveRefundButton } from './ApproveRefundButton'
import { RejectRefundButton } from './RejectRefundButton'
import { ConfirmMaintenanceButton } from './ConfirmMaintenanceButton'
import { ResolveDamageButton } from './ResolveDamageButton'
import { ApproveReviewButton } from './ApproveReviewButton'
import { AssignTaskButton } from '@/components/housekeeping/AssignTaskButton'
import { TASK_TYPE_KEY, timeAgo } from '@/components/housekeeping/labels'

const SEVERITY_RANK: Record<DashboardAlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
const SEVERITY_DOT: Record<DashboardAlertSeverity, string> = {
  critical: 'bg-error',
  warning: 'bg-secondary',
  info: 'bg-outline',
}
const MAX_ROOMS = 5

/**
 * The dashboard's first panel: everything waiting on the manager, most
 * severe first. Actionable kinds list up to ACTION_LIMIT items with their
 * buttons (the same ones the detail pages use); link-only warnings get one
 * sentence and a link. The alert's own count is the total ("see all").
 */
export function ActionQueue({
  alerts,
  queue,
  locale,
}: {
  alerts: DashboardAlert[]
  queue: ManagerActionQueue
  locale: Locale
}) {
  const t = getT(locale)
  const bcp = LOCALE_BCP47[locale]
  const actionable = new Set<string>(actionKinds(alerts))
  const ordered = alerts
    .filter((a) => a.count > 0)
    .map((a, i) => ({ a, i }))
    .sort((x, y) => SEVERITY_RANK[x.a.severity] - SEVERITY_RANK[y.a.severity] || x.i - y.i)
    .map(({ a }) => a)

  const params = (a: DashboardAlert) => ({
    count: a.count,
    rooms: a.rooms?.length
      ? a.rooms.slice(0, MAX_ROOMS).join(', ') +
        (a.rooms.length > MAX_ROOMS ? ` ${t('manager.alerts.more', { count: a.rooms.length - MAX_ROOMS })}` : '')
      : '',
    amount: a.amount != null ? formatTHB(a.amount, bcp) : '',
  })

  const rows = (kind: ActionKind): React.ReactNode[] => {
    switch (kind) {
      case 'refundsPending':
        return queue.refunds.map((r) => (
          <Row
            key={r.id}
            main={`${r.bookingCode} · ${r.guestName}`}
            figure={formatTHB(r.amount, bcp)}
            detail={[r.reason, t('manager.actions.requestedOn', { date: formatDate(r.requestedAt, bcp) }), r.checkIn && r.checkOut ? `${formatDate(r.checkIn, bcp)} – ${formatDate(r.checkOut, bcp)}` : null]}
            actions={
              <>
                <ApproveRefundButton refundId={r.id} />
                <RejectRefundButton refundId={r.id} />
              </>
            }
          />
        ))
      case 'maintenanceCritical':
        return queue.repairs.map((m) => (
          <Row
            key={m.id}
            main={`${t('staff.roomN', { room: m.room_unit?.unit_label ?? '—' })} · ${m.title}`}
            detail={[m.reporter?.full_name ?? null, formatDate(m.created_at, bcp)]}
            actions={m.status === 'open' ? <ConfirmMaintenanceButton reportId={m.id} /> : null}
          />
        ))
      case 'damageUrgent':
        return queue.damage.map((d) => (
          <Row
            key={d.id}
            main={`${t('staff.roomN', { room: d.roomNumber })} · ${d.description}`}
            figure={d.costEstimate != null ? formatTHB(d.costEstimate, bcp) : undefined}
            detail={[d.reportedBy]}
            actions={<ResolveDamageButton reportId={d.id} defaultCost={d.costEstimate} />}
          />
        ))
      case 'unassignedTasks':
        return queue.tasks.map((task) => (
          <Row
            key={task.id}
            main={`${t('staff.roomN', { room: task.roomNumber })} · ${t(TASK_TYPE_KEY[task.taskType])}`}
            detail={[task.urgent ? t('manager.actions.urgent') : null, timeAgo(task.requestedAt, locale)]}
            actions={<AssignTaskButton taskId={task.id} housekeepers={queue.housekeepers} currentAssigneeId={null} />}
          />
        ))
      case 'reviewsPending':
        return queue.reviews.map((r) => (
          <Row
            key={r.id}
            main={`${r.guestName} · ${'★'.repeat(r.rating)}`}
            detail={[r.title, r.body ? (r.body.length > 140 ? `${r.body.slice(0, 140)}…` : r.body) : null]}
            actions={<ApproveReviewButton reviewId={r.id} />}
          />
        ))
    }
  }

  return (
    <section aria-labelledby="needs-action" className="bg-surface-container-lowest rounded-2xl">
      <h2 id="needs-action" className="sr-only">
        {t('manager.actions.title')}
      </h2>
      {ordered.length === 0 ? (
        <p className="px-5 md:px-6 py-6 flex items-center gap-2 text-body-md text-on-surface-variant">
          <MaterialIcon name="check_circle" size={20} className="text-primary" />
          {t('manager.actions.nothingWaiting')}
        </p>
      ) : (
        <div>
        {ordered.map((a) => {
          const p = params(a)
          const items = actionable.has(a.kind) ? rows(a.kind as ActionKind) : null
          const title = t(`manager.alerts.${a.kind}.title`, p)
          // Hide/delete live on the reviews page, so reviews always link there.
          const link = !items
            ? t(`manager.alerts.${a.kind}.cta`)
            : seeAllShown(items.length, a.count)
              ? t('manager.actions.seeAll', { count: a.count })
              : a.kind === 'reviewsPending'
                ? t('manager.actions.manageReviews')
                : null
          return (
            <div key={a.id} className="px-5 md:px-6 py-4 border-t border-surface-container first:border-t-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="flex items-center gap-2 text-body-lg font-semibold text-on-surface">
                  <span aria-hidden className={`w-2 h-2 rounded-full shrink-0 ${SEVERITY_DOT[a.severity]}`} />
                  {title}
                </h3>
                {link && (
                  <Link
                    href={a.href}
                    aria-label={`${link} — ${title}`}
                    className="text-[14px] font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"
                  >
                    {link}
                  </Link>
                )}
              </div>
              {items && items.length > 0 ? (
                <ul className="mt-2">{items}</ul>
              ) : (
                <p className="mt-1 text-body-md text-on-surface-variant">{t(`manager.alerts.${a.kind}.desc`, p)}</p>
              )}
            </div>
          )
        })}
        </div>
      )}
    </section>
  )
}

/** One waiting item: what it is on the left, its buttons on the right. */
function Row({
  main,
  figure,
  detail,
  actions,
}: {
  main: string
  figure?: string
  detail: (string | null | undefined)[]
  actions: React.ReactNode
}) {
  const sub = detail.filter(Boolean).join(' · ')
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 border-t border-surface-container first:border-t-0">
      <div className="flex-1 min-w-56">
        <p className="text-body-md text-on-surface [overflow-wrap:anywhere]">
          {main}
          {figure && <span className="ml-2 font-semibold text-primary tabular-nums whitespace-nowrap">{figure}</span>}
        </p>
        {sub && <p className="text-[14px] text-on-surface-variant mt-0.5 [overflow-wrap:anywhere]">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </li>
  )
}
