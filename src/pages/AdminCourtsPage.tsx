import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import type { CourtGroup, Court, Sport } from '../types'

const sportOptions: Sport[] = ['tennis', 'pickleball', 'badminton']

interface CourtGroupWithCourts extends CourtGroup {
  courts: Court[]
}

// --- Group Form ---

interface GroupFormData {
  name: string
  description: string
  timezone: string
}

const emptyGroupForm: GroupFormData = {
  name: '',
  description: '',
  timezone: 'America/New_York',
}

function GroupForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: GroupFormData
  onSave: (data: GroupFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
          placeholder="e.g. Central Park Courts"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <input
          type="text"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
          placeholder="Optional description"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Timezone
        </label>
        <input
          type="text"
          value={form.timezone}
          onChange={(e) => setForm({ ...form, timezone: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
          placeholder="America/New_York"
        />
      </div>
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || saving}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// --- Court Form ---

interface CourtFormData {
  name: string
  sport: Sport
  surface_type: string
  is_lit: boolean
  notes: string
}

const emptyCourtForm: CourtFormData = {
  name: '',
  sport: 'tennis',
  surface_type: '',
  is_lit: false,
  notes: '',
}

function CourtForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: CourtFormData
  onSave: (data: CourtFormData) => void
  onCancel: () => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Court Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
          placeholder="e.g. Court 1"
        />
      </div>
      <CourtFieldsShared form={form} setForm={setForm} idSuffix="edit" />
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onSave(form)}
          disabled={!form.name.trim() || saving}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// --- Shared court fields (sport, surface, lighting, notes) ---

function CourtFieldsShared({
  form,
  setForm,
  idSuffix,
}: {
  form: CourtFormData
  setForm: (f: CourtFormData) => void
  idSuffix: string
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sport
          </label>
          <select
            value={form.sport}
            onChange={(e) =>
              setForm({ ...form, sport: e.target.value as Sport })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm bg-white"
          >
            {sportOptions.map((s) => (
              <option key={s} value={s} className="capitalize">
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Surface Type
          </label>
          <input
            type="text"
            value={form.surface_type}
            onChange={(e) =>
              setForm({ ...form, surface_type: e.target.value })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
            placeholder="e.g. Hard, Clay"
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          id={`is-lit-${idSuffix}`}
          type="checkbox"
          checked={form.is_lit}
          onChange={(e) => setForm({ ...form, is_lit: e.target.checked })}
          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
        />
        <label htmlFor={`is-lit-${idSuffix}`} className="text-sm text-gray-700">
          Court has lighting
        </label>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notes
        </label>
        <input
          type="text"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
          placeholder="Optional notes"
        />
      </div>
    </>
  )
}

// --- Bulk Court Form ---

function BulkCourtForm({
  existingCount,
  onSave,
  onCancel,
  saving,
}: {
  existingCount: number
  onSave: (courts: CourtFormData[]) => void
  onCancel: () => void
  saving: boolean
}) {
  const [count, setCount] = useState(1)
  const [namePrefix, setNamePrefix] = useState('Court')
  const [courtFields, setCourtFields] = useState<CourtFormData>({
    ...emptyCourtForm,
    name: '',
  })

  const startNumber = existingCount + 1
  const preview =
    count === 1
      ? `${namePrefix} ${startNumber}`
      : `${namePrefix} ${startNumber}–${startNumber + count - 1}`

  const handleSave = () => {
    const courts: CourtFormData[] = Array.from({ length: count }, (_, i) => ({
      ...courtFields,
      name: `${namePrefix.trim()} ${startNumber + i}`,
    }))
    onSave(courts)
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Number of Courts
          </label>
          <input
            type="number"
            min={1}
            max={50}
            value={count}
            onChange={(e) =>
              setCount(Math.max(1, Math.min(50, Number(e.target.value))))
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Name Prefix
          </label>
          <input
            type="text"
            value={namePrefix}
            onChange={(e) => setNamePrefix(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-sm"
            placeholder="e.g. Court"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Will create: <span className="font-medium text-gray-700">{preview}</span>
      </p>
      <CourtFieldsShared form={courtFields} setForm={setCourtFields} idSuffix="bulk" />
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!namePrefix.trim() || count < 1 || saving}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
        >
          {saving
            ? 'Adding…'
            : `Add ${count} ${count === 1 ? 'Court' : 'Courts'}`}
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// --- Main Page ---

export function AdminCourtsPage() {
  const { profile, user } = useAuth()
  const [groups, setGroups] = useState<CourtGroupWithCourts[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Group editing state
  const [showGroupForm, setShowGroupForm] = useState(false)
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null)

  // Court editing state (keyed by group id)
  const [showCourtForm, setShowCourtForm] = useState<string | null>(null)
  const [editingCourtId, setEditingCourtId] = useState<string | null>(null)

  // Confirmation state
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'group' | 'court'
    id: string
    name: string
  } | null>(null)

  const fetchData = useCallback(async () => {
    const { data: groupData } = await supabase
      .from('court_groups')
      .select('*')
      .order('name')

    const { data: courtData } = await supabase
      .from('courts')
      .select('*')
      .order('name')

    if (groupData) {
      const courtsByGroup = new Map<string, Court[]>()
      for (const court of courtData ?? []) {
        const list = courtsByGroup.get(court.court_group_id) ?? []
        list.push(court)
        courtsByGroup.set(court.court_group_id, list)
      }
      setGroups(
        groupData.map((g) => ({
          ...g,
          courts: courtsByGroup.get(g.id) ?? [],
        }))
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // --- Access check ---
  if (!profile?.is_admin) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center max-w-sm">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Access denied
          </h2>
          <p className="text-sm text-gray-500">
            You need administrator privileges to manage courts.
          </p>
        </div>
      </div>
    )
  }

  // --- Group CRUD ---

  const handleSaveGroup = async (data: GroupFormData) => {
    if (!user) return
    setSaving(true)

    if (editingGroupId) {
      await supabase
        .from('court_groups')
        .update({
          name: data.name.trim(),
          description: data.description.trim() || null,
          timezone: data.timezone.trim(),
        })
        .eq('id', editingGroupId)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('court_groups').insert({
        name: data.name.trim(),
        description: data.description.trim() || null,
        timezone: data.timezone.trim(),
        created_by: user.id,
      } as any)
    }

    setSaving(false)
    setShowGroupForm(false)
    setEditingGroupId(null)
    await fetchData()
  }

  const handleDeleteGroup = async (id: string) => {
    await supabase.from('courts').delete().eq('court_group_id', id)
    await supabase.from('court_groups').delete().eq('id', id)
    setConfirmDelete(null)
    await fetchData()
  }

  // --- Court CRUD ---

  const handleSaveCourt = async (
    data: CourtFormData,
    courtGroupId: string
  ) => {
    setSaving(true)

    if (editingCourtId) {
      await supabase
        .from('courts')
        .update({
          name: data.name.trim(),
          sport: data.sport,
          surface_type: data.surface_type.trim() || null,
          is_lit: data.is_lit,
          notes: data.notes.trim() || null,
        })
        .eq('id', editingCourtId)
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await supabase.from('courts').insert({
        court_group_id: courtGroupId,
        name: data.name.trim(),
        sport: data.sport,
        surface_type: data.surface_type.trim() || null,
        is_lit: data.is_lit,
        notes: data.notes.trim() || null,
      } as any)
    }

    setSaving(false)
    setShowCourtForm(null)
    setEditingCourtId(null)
    await fetchData()
  }

  const handleBulkAddCourts = async (
    courts: CourtFormData[],
    courtGroupId: string
  ) => {
    setSaving(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await supabase.from('courts').insert(
      courts.map((c) => ({
        court_group_id: courtGroupId,
        name: c.name.trim(),
        sport: c.sport,
        surface_type: c.surface_type.trim() || null,
        is_lit: c.is_lit,
        notes: c.notes.trim() || null,
      })) as any
    )

    setSaving(false)
    setShowCourtForm(null)
    await fetchData()
  }

  const handleDeleteCourt = async (id: string) => {
    await supabase.from('courts').delete().eq('id', id)
    setConfirmDelete(null)
    await fetchData()
  }

  // --- Render ---

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-gray-500">Loading…</div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Manage Courts</h1>
        <button
          onClick={() => {
            setEditingGroupId(null)
            setShowGroupForm(true)
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium transition-colors"
        >
          + New Group
        </button>
      </div>

      {/* New group form */}
      {showGroupForm && !editingGroupId && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-900 mb-3">
            New Court Group
          </h2>
          <GroupForm
            initial={emptyGroupForm}
            onSave={handleSaveGroup}
            onCancel={() => setShowGroupForm(false)}
            saving={saving}
          />
        </div>
      )}

      {groups.length === 0 && !showGroupForm && (
        <div className="text-center py-12 text-gray-500">
          <p>No court groups yet. Create one to get started.</p>
        </div>
      )}

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-lg">
            <h3 className="font-semibold text-gray-900 mb-2">
              Delete {confirmDelete.type === 'group' ? 'group' : 'court'}?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to delete{' '}
              <strong>{confirmDelete.name}</strong>?
              {confirmDelete.type === 'group' &&
                ' All courts in this group will also be deleted.'}
              {' '}This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  confirmDelete.type === 'group'
                    ? handleDeleteGroup(confirmDelete.id)
                    : handleDeleteCourt(confirmDelete.id)
                }
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Groups */}
      <div className="space-y-6">
        {groups.map((group) => (
          <div
            key={group.id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            {/* Group header */}
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50">
              {editingGroupId === group.id ? (
                <GroupForm
                  initial={{
                    name: group.name,
                    description: group.description ?? '',
                    timezone: group.timezone,
                  }}
                  onSave={handleSaveGroup}
                  onCancel={() => {
                    setEditingGroupId(null)
                    setShowGroupForm(false)
                  }}
                  saving={saving}
                />
              ) : (
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      🏟️ {group.name}
                    </h2>
                    {group.description && (
                      <p className="text-sm text-gray-600 mt-0.5">
                        {group.description}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {group.timezone} · {group.courts.length}{' '}
                      {group.courts.length === 1 ? 'court' : 'courts'}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setEditingGroupId(group.id)
                        setShowGroupForm(true)
                      }}
                      className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() =>
                        setConfirmDelete({
                          type: 'group',
                          id: group.id,
                          name: group.name,
                        })
                      }
                      className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Courts */}
            <div className="divide-y divide-gray-100">
              {group.courts.map((court) => (
                <div key={court.id} className="px-5 py-3">
                  {editingCourtId === court.id ? (
                    <CourtForm
                      initial={{
                        name: court.name,
                        sport: court.sport,
                        surface_type: court.surface_type ?? '',
                        is_lit: court.is_lit,
                        notes: court.notes ?? '',
                      }}
                      onSave={(data) => handleSaveCourt(data, group.id)}
                      onCancel={() => setEditingCourtId(null)}
                      saving={saving}
                    />
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-gray-900 truncate">
                          {court.name}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 capitalize">
                          {court.sport}
                        </span>
                        {court.surface_type && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">
                            {court.surface_type}
                          </span>
                        )}
                        {court.is_lit && (
                          <span className="text-xs text-yellow-600">💡</span>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setEditingCourtId(court.id)}
                          className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() =>
                            setConfirmDelete({
                              type: 'court',
                              id: court.id,
                              name: court.name,
                            })
                          }
                          className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add court form / button */}
              {showCourtForm === group.id ? (
                <div className="px-5 py-4">
                  <BulkCourtForm
                    existingCount={group.courts.length}
                    onSave={(courts) => handleBulkAddCourts(courts, group.id)}
                    onCancel={() => setShowCourtForm(null)}
                    saving={saving}
                  />
                </div>
              ) : (
                <div className="px-5 py-3">
                  <button
                    onClick={() => {
                      setEditingCourtId(null)
                      setShowCourtForm(group.id)
                    }}
                    className="text-sm text-green-600 hover:text-green-700 font-medium"
                  >
                    + Add Court
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
