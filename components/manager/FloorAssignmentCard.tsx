import type { FloorAssignment } from '@/lib/data/types'

interface FloorAssignmentCardProps {
  assignments: FloorAssignment[]
  // Phase 1: read-only. Phase 2 will wire up an update action.
}

export function FloorAssignmentCard({ assignments }: FloorAssignmentCardProps) {
  return (
    <div className="bg-surface-container-lowest rounded-lg shadow-level-1 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-headline-sm text-headline-sm text-primary">Floor Assignments</h3>
        <button
          type="button"
          disabled
          className="text-caption uppercase tracking-wider text-on-surface-variant opacity-50 cursor-not-allowed"
          title="Phase 2"
        >
          Save
        </button>
      </div>
      <ul className="flex flex-col gap-3">
        {assignments.map((a) => (
          <li key={a.floor} className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-body-md font-semibold text-primary">Floor {a.floor}</p>
              <p className="text-caption text-on-surface-variant">
                {a.label} · {a.totalRooms} rooms
              </p>
            </div>
            <select
              defaultValue={a.housekeeperId ?? ''}
              disabled
              className="bg-surface-container-low border border-outline-variant rounded-md px-3 py-2 text-body-md text-on-surface cursor-not-allowed opacity-80"
            >
              <option value="">Unassigned</option>
              {a.housekeeperId ? (
                <option value={a.housekeeperId}>{a.housekeeperName}</option>
              ) : null}
            </select>
          </li>
        ))}
      </ul>
    </div>
  )
}
