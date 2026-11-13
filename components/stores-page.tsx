
'use client'

import { useState, useTransition } from 'react'
import { Building2, Edit3, MapPin, Plus, Power, Store } from 'lucide-react'
import {
  archiveStoreAction,
  createBranchAction,
  createStoreAction,
  setBranchStatusAction,
  updateBranchAction,
  updateStoreAction,
} from '@/app/actions/stores'

type Branch = {
  id: string
  name: string
  address: string | null
  status: 'active' | 'inactive'
}

type StoreRecord = {
  id: string
  name: string
  phone: string | null
  status: 'active' | 'inactive'
  plan_code: string | null
  subscription_status: string | null
  dokkan_branches: Branch[]
}

function Field({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-[#465260]">
      <span>{label}</span>
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 outline-none focus:border-[#2563eb]"
      />
    </label>
  )
}

function getActiveBranchCount(store: StoreRecord) {
  return store.dokkan_branches.filter(
    (branch) => branch.status === 'active'
  ).length
}

function isKnownActiveSubscription(store: StoreRecord) {
  const knownPlans = [
    'free',
    'basic',
    'professional',
    'enterprise',
  ]

  return (
    !!store.plan_code &&
    knownPlans.includes(store.plan_code) &&
    store.subscription_status === 'active'
  )
}

function getSubscriptionErrorMessage(message: string) {
  if (message.includes('FREE_PLAN_BRANCH_LIMIT_REACHED')) {
    return 'الخطة المجانية تسمح بفرع نشط واحد فقط. أوقف فرعًا آخر قبل إعادة تنشيط هذا الفرع.'
  }

  if (message.includes('SUBSCRIPTION_PLAN_UNRESOLVED')) {
    return 'لا يمكن تنفيذ العملية لأن خطة المتجر غير محددة أو الاشتراك غير نشط. يرجى مراجعة بيانات الاشتراك أولًا.'
  }

  return 'تعذر تنفيذ العملية. تحقق من الصلاحيات والبيانات.'
}

export default function StoresPage({
  initialStores,
}: {
  initialStores: StoreRecord[]
}) {
  const [stores] = useState(initialStores)
  const [selectedStore, setSelectedStore] = useState<StoreRecord | null>(
    initialStores[0] ?? null
  )
  const [editingStore, setEditingStore] = useState<StoreRecord | null>(null)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)
  const [showStoreForm, setShowStoreForm] = useState(false)
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [error, setError] = useState('')
  const [busy, startTransition] = useTransition()

  const refresh = () => window.location.reload()

  const subscriptionResolved = selectedStore
    ? isKnownActiveSubscription(selectedStore)
    : false

  const isFreePlan =
    selectedStore?.plan_code === 'free' &&
    selectedStore?.subscription_status === 'active'

  const activeBranchCount = selectedStore
    ? getActiveBranchCount(selectedStore)
    : 0

  const branchLimitReached = Boolean(
    isFreePlan && activeBranchCount >= 1
  )

  const canCreateBranch =
    subscriptionResolved && !branchLimitReached

  const canReactivateBranch =
    subscriptionResolved &&
    (!isFreePlan || activeBranchCount < 1)

  const submitStore = (event: React.FormEvent) => {
    event.preventDefault()
    setError('')

    startTransition(async () => {
      try {
        if (editingStore) {
          await updateStoreAction({ id: editingStore.id, name, phone })
        } else {
          await createStoreAction({ name, phone })
        }

        setShowStoreForm(false)
        setEditingStore(null)
        setName('')
        setPhone('')
        refresh()
      } catch {
        setError('تعذر حفظ المتجر. تحقق من الصلاحيات والبيانات.')
      }
    })
  }

  const submitBranch = (event: React.FormEvent) => {
    event.preventDefault()

    if (!selectedStore) return

    if (!editingBranch && !canCreateBranch) {
      setError(
        !subscriptionResolved
          ? 'خطة المتجر غير محددة أو الاشتراك غير نشط. لا يمكن إضافة فروع قبل مراجعة الاشتراك.'
          : 'الخطة المجانية تسمح بفرع نشط واحد فقط.'
      )
      return
    }

    setError('')

    startTransition(async () => {
      try {
        if (editingBranch) {
          await updateBranchAction({
            id: editingBranch.id,
            name,
            address,
          })
        } else {
          await createBranchAction({
            storeId: selectedStore.id,
            name,
            address,
          })
        }

        setShowBranchForm(false)
        setEditingBranch(null)
        setName('')
        setAddress('')
        refresh()
      } catch (err) {
        const message = err instanceof Error ? err.message : ''

        setError(getSubscriptionErrorMessage(message))
      }
    })
  }

  const openStore = (store: StoreRecord) => {
    setSelectedStore(store)
    setError('')
    setShowBranchForm(false)
    setEditingBranch(null)
  }

  const changeBranchStatus = (
    branch: Branch,
    nextStatus: 'active' | 'inactive'
  ) => {
    if (
      nextStatus === 'active' &&
      !canReactivateBranch
    ) {
      setError(
        !subscriptionResolved
          ? 'لا يمكن إعادة تنشيط الفرع لأن خطة المتجر غير محددة أو الاشتراك غير نشط.'
          : 'لا يمكن إعادة تنشيط الفرع. الخطة المجانية تسمح بفرع نشط واحد فقط.'
      )
      return
    }

    setError('')

    startTransition(async () => {
      try {
        await setBranchStatusAction(branch.id, nextStatus)
        refresh()
      } catch (err) {
        const message = err instanceof Error ? err.message : ''
        setError(getSubscriptionErrorMessage(message))
      }
    })
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-[#64748b]">
            Supabase · بيانات حقيقية
          </p>
          <h2 className="mt-1 text-2xl font-extrabold">
            المتاجر والفروع
          </h2>
          <p className="mt-1 text-sm text-[#94a3b8]">
            إدارة المتاجر والفروع والصلاحيات من قاعدة البيانات
          </p>
        </div>

        <button
          onClick={() => {
            setEditingStore(null)
            setName('')
            setPhone('')
            setShowStoreForm(true)
          }}
          className="flex items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-bold text-white"
        >
          <Plus /> إنشاء متجر
        </button>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-[#ffebeb] p-3 text-sm font-bold text-[#c43e3e]"
        >
          {error}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[.9fr_1.4fr]">
        <div className="space-y-3">
          {stores.map((store) => {
            const activeCount = getActiveBranchCount(store)

            return (
              <button
                key={store.id}
                onClick={() => openStore(store)}
                className={`w-full rounded-2xl border p-5 text-right transition ${
                  selectedStore?.id === store.id
                    ? 'border-[#76bdb0] bg-[#f4faf8]'
                    : 'border-[#e2e8f0] bg-white hover:border-[#b6d9d2]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-11 items-center justify-center rounded-xl bg-[#eaf2ff] text-[#2563eb]">
                      <Store />
                    </div>
                    <div>
                      <p className="font-extrabold">{store.name}</p>
                      <p className="mt-1 text-xs text-[#94a3b8]">
                        {store.phone || 'لا يوجد رقم هاتف'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                      store.status === 'active'
                        ? 'bg-[#e4f4ef] text-[#2563eb]'
                        : 'bg-[#ffebeb] text-[#c43e3e]'
                    }`}
                  >
                    {store.status === 'active' ? 'نشط' : 'مؤرشف'}
                  </span>
                </div>

                <p className="mt-4 text-xs text-[#64748b]">
                  {activeCount} فروع نشطة من أصل {store.dokkan_branches.length}
                </p>
              </button>
            )
          })}

          {!stores.length && (
            <div className="rounded-2xl border border-dashed border-[#b9d5d0] bg-white p-8 text-center text-sm text-[#94a3b8]">
              لا توجد متاجر بعد. أنشئ أول متجر للبدء.
            </div>
          )}
        </div>

        {selectedStore ? (
          <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
            <div className="flex flex-col justify-between gap-3 border-b border-[#edf0f2] pb-5 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-extrabold">
                  {selectedStore.name}
                </h3>
                <p className="mt-1 text-xs text-[#94a3b8]">
                  الفروع المرتبطة بالمتجر
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingStore(selectedStore)
                    setName(selectedStore.name)
                    setPhone(selectedStore.phone || '')
                    setShowStoreForm(true)
                  }}
                  className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm font-bold"
                >
                  <Edit3 /> تعديل المتجر
                </button>

                <button
                  onClick={() =>
                    startTransition(async () => {
                      try {
                        await archiveStoreAction(selectedStore.id)
                        refresh()
                      } catch {
                        setError('تعذر أرشفة المتجر.')
                      }
                    })
                  }
                  disabled={busy || selectedStore.status === 'inactive'}
                  className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm font-bold disabled:opacity-50"
                >
                  <Power /> أرشفة
                </button>
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm font-bold text-[#64748b]">
                الفروع ({activeBranchCount} نشط)
              </p>

              {canCreateBranch && (
                <button
                  onClick={() => {
                    setEditingBranch(null)
                    setName('')
                    setAddress('')
                    setError('')
                    setShowBranchForm(true)
                  }}
                  className="flex items-center gap-2 rounded-xl bg-[#eaf2ff] px-3 py-2 text-xs font-bold text-[#2563eb]"
                >
                  <Plus /> إضافة فرع
                </button>
              )}
            </div>

            {!subscriptionResolved && (
              <div className="mt-3 rounded-xl border border-[#f0dfb4] bg-[#fffaf0] p-3 text-sm text-[#8a641d]">
                خطة المتجر غير محددة أو الاشتراك غير نشط. لا يمكن إضافة فروع أو إعادة تنشيط فروع قبل مراجعة بيانات الاشتراك.
              </div>
            )}

            {subscriptionResolved && branchLimitReached && (
              <div className="mt-3 rounded-xl border border-[#f0dfb4] bg-[#fffaf0] p-3 text-sm text-[#8a641d]">
                الخطة المجانية تسمح بفرع نشط واحد فقط. يمكنك إيقاف الفرع الحالي قبل تنشيط فرع آخر.
              </div>
            )}

            <div className="mt-4 grid gap-3">
              {selectedStore.dokkan_branches.map((branch) => {
                const isReactivationBlocked =
                  branch.status === 'inactive' &&
                  !canReactivateBranch

                return (
                  <div
                    key={branch.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#edf0f2] p-4"
                  >
                    <div>
                      <p className="font-bold">{branch.name}</p>
                      <p className="mt-1 flex items-center gap-1 text-xs text-[#94a3b8]">
                        <MapPin className="size-3" />
                        {branch.address || 'لا يوجد عنوان'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                          branch.status === 'active'
                            ? 'bg-[#e4f4ef] text-[#2563eb]'
                            : 'bg-[#ffebeb] text-[#c43e3e]'
                        }`}
                      >
                        {branch.status === 'active' ? 'نشط' : 'متوقف'}
                      </span>

                      <button
                        aria-label={`تعديل ${branch.name}`}
                        onClick={() => {
                          setEditingBranch(branch)
                          setName(branch.name)
                          setAddress(branch.address || '')
                          setShowBranchForm(true)
                        }}
                        className="rounded-lg border border-[#e2e8f0] p-2"
                      >
                        <Edit3 className="size-4" />
                      </button>

                      <button
                        aria-label={
                          branch.status === 'active'
                            ? `إيقاف ${branch.name}`
                            : `إعادة تنشيط ${branch.name}`
                        }
                        title={
                          isReactivationBlocked
                            ? 'راجع الخطة أو حد الفروع النشطة'
                            : undefined
                        }
                        disabled={busy || isReactivationBlocked}
                        onClick={() =>
                          changeBranchStatus(
                            branch,
                            branch.status === 'active'
                              ? 'inactive'
                              : 'active'
                          )
                        }
                        className="rounded-lg border border-[#e2e8f0] p-2 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Power className="size-4" />
                      </button>
                    </div>
                  </div>
                )
              })}

              {!selectedStore.dokkan_branches.length && (
                <p className="rounded-xl bg-[#f7f9f9] p-6 text-center text-sm text-[#94a3b8]">
                  لا توجد فروع لهذا المتجر.
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-[#b9d5d0] bg-white text-sm text-[#94a3b8]">
            اختر متجرًا لعرض فروعه
          </div>
        )}
      </div>

      {showStoreForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102b2a]/30 p-4">
          <form
            onSubmit={submitStore}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-lg font-extrabold">
              {editingStore ? 'تعديل المتجر' : 'إنشاء متجر'}
            </h3>

            <div className="mt-5 grid gap-4">
              <Field
                label="اسم المتجر"
                value={name}
                onChange={setName}
                required
              />
              <Field
                label="رقم الهاتف"
                value={phone}
                onChange={setPhone}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowStoreForm(false)}
                className="rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-sm font-bold"
              >
                إلغاء
              </button>
              <button
                disabled={busy}
                className="rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                حفظ
              </button>
            </div>
          </form>
        </div>
      )}

      {showBranchForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#102b2a]/30 p-4">
          <form
            onSubmit={submitBranch}
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h3 className="text-lg font-extrabold">
              {editingBranch ? 'تعديل الفرع' : 'إضافة فرع'}
            </h3>

            <div className="mt-5 grid gap-4">
              <Field
                label="اسم الفرع"
                value={name}
                onChange={setName}
                required
              />
              <Field
                label="العنوان"
                value={address}
                onChange={setAddress}
              />
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowBranchForm(false)}
                className="rounded-xl border border-[#e2e8f0] px-4 py-2.5 text-sm font-bold"
              >
                إلغاء
              </button>
              <button
                disabled={busy}
                className="rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                حفظ
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
