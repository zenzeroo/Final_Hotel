import type { DashboardAlert, DashboardAlertSeverity } from '../data/types'

/** Items shown per kind on the dashboard; the rest are one "see all" link away. */
export const ACTION_LIMIT = 5

/** Alert kinds the manager can settle right on the dashboard. */
export type ActionKind = 'refundsPending' | 'maintenanceCritical' | 'damageUrgent' | 'unassignedTasks' | 'reviewsPending'

const ACTION_KINDS: ReadonlySet<string> = new Set<ActionKind>([
  'refundsPending',
  'maintenanceCritical',
  'damageUrgent',
  'unassignedTasks',
  'reviewsPending',
])

const SEVERITY_RANK: Record<DashboardAlertSeverity, number> = { critical: 0, warning: 1, info: 2 }

/**
 * The actionable kinds that have something waiting, most severe first (ties
 * keep the alerts' own order). Link-only warnings — no housekeeper on
 * shift, dirty rooms without a task — are left out; they have no one-tap fix.
 */
export function actionKinds(alerts: readonly DashboardAlert[]): ActionKind[] {
  return alerts
    .filter((a) => a.count > 0 && ACTION_KINDS.has(a.kind))
    .map((a, i) => ({ a, i }))
    .sort((x, y) => SEVERITY_RANK[x.a.severity] - SEVERITY_RANK[y.a.severity] || x.i - y.i)
    .map(({ a }) => a.kind as ActionKind)
}

/**
 * Whether a kind needs its "see all" link: whenever the dashboard lists fewer
 * items than the alert counts — over the limit, or counted rows the list
 * could not load — so nothing waiting is ever out of reach.
 */
export function seeAllShown(listed: number, total: number): boolean {
  return listed < total
}
