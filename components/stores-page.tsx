
'use client'

import { useState, useTransition } from 'react'
import {
  Building2,
  Edit3,
  MapPin,
  Plus,
  Power,
  Store,
  Phone,
  X,
  GitBranch,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'
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
    <label className="flex flex-col gap-2 text-sm font-bold text-slate-700">
      <span>{label}</span>
      <input
        required={required}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
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

  const totalBranches = stores.reduce(
    (total, store) => total + store.dokkan_branches.length,
    0
  )

  const totalActiveBranches = stores.reduce(
    (total, store) => total + getActiveBranchCount(store),
    0
  )

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
    <section className="space-y-5 sm:space-y-6" dir="rtl">
      {/* Header */}
      <header className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-l from-blue-50 via-white to-white p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
              <Building2 size={25} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
                المتاجر والفروع
              </h2>
              <p className="mt-1 text-xs leading-6 text-slate-500 sm:text-sm">
                إدارة المتاجر والفروع ومتابعة حالتها
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingStore(null)
              setName('')
              setPhone('')
              setError('')
              setShowStoreForm(true)
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:w-auto"
          >
            <Plus size={19} />
            إنشاء متجر
          </button>
        </div>
      </header>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 sm:h-10 sm:w-10">
            <Store size={20} />
          </div>
          <p className="text-[11px] text-slate-500 sm:text-sm">
            المتاجر
          </p>
          <p className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
            {stores.length}
          </p>
        </div>

        <div className="rounded-2xl border border-green-100 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-green-50 text-green-600 sm:h-10 sm:w-10">
            <GitBranch size={20} />
          </div>
          <p className="text-[11px] text-slate-500 sm:text-sm">
            الفروع النشطة
          </p>
          <p className="mt-1 text-xl font-extrabold text-green-700 sm:text-2xl">
            {totalActiveBranches}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600 sm:h-10 sm:w-10">
            <Building2 size={20} />
          </div>
          <p className="text-[11px] text-slate-500 sm:text-sm">
            إجمالي الفروع
          </p>
          <p className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">
            {totalBranches}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold leading-6 text-red-700"
        >
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="إغلاق التنبيه"
            className="mr-auto rounded-lg p-1 hover:bg-red-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Main content */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.5fr)]">
        {/* Stores list */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-extrabold text-slate-900">
                  قائمة المتاجر
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  اختر متجرًا لعرض فروعه
                </p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {stores.length} متجر
              </span>
            </div>
          </div>

          <div className="space-y-2 p-3">
            {stores.map((store) => {
              const activeCount = getActiveBranchCount(store)
              const selected = selectedStore?.id === store.id

              return (
                <button
                  type="button"
                  key={store.id}
                  onClick={() => openStore(store)}
                  className={`w-full rounded-xl border p-3 text-right transition sm:p-4 ${
                    selected
                      ? 'border-blue-300 bg-blue-50/70 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        selected
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      <Store size={21} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="break-words font-extrabold text-slate-900">
                          {store.name}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                            store.status === 'active'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {store.status === 'active' ? 'نشط' : 'مؤرشف'}
                        </span>
                      </div>

                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                        <Phone size={13} />
                        {store.phone || 'لا يوجد رقم هاتف'}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                          {activeCount} فرع نشط
                        </span>
                        <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">
                          الإجمالي {store.dokkan_branches.length}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}

            {!stores.length && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <Store className="mx-auto mb-3 text-slate-400" size={32} />
                <p className="font-bold text-slate-700">
                  لا توجد متاجر بعد
                </p>
                <p className="mt-1 text-xs leading-6 text-slate-500">
                  أنشئ أول متجر للبدء في إدارة الفروع
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Selected store details */}
        {selectedStore ? (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <Building2 size={22} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="break-words font-extrabold text-slate-900">
                      {selectedStore.name}
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                      تفاصيل المتجر والفروع التابعة له
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStore(selectedStore)
                      setName(selectedStore.name)
                      setPhone(selectedStore.phone || '')
                      setError('')
                      setShowStoreForm(true)
                    }}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:text-sm"
                  >
                    <Edit3 size={16} />
                    تعديل المتجر
                  </button>

                  <button
                    type="button"
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
                    className="flex items-center justify-center gap-2 rounded-xl border border-red-100 px-3 py-2.5 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-40 sm:text-sm"
                  >
                    <Power size={16} />
                    أرشفة
                  </button>
                </div>
              </div>
            </div>

            {/* Branch summary and controls */}
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-extrabold text-slate-900">
                    فروع المتجر
                  </h4>
                  <p className="mt-1 text-xs text-slate-500">
                    {activeBranchCount} فرع نشط من أصل{' '}
                    {selectedStore.dokkan_branches.length}
                  </p>
                </div>

                {canCreateBranch && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBranch(null)
                      setName('')
                      setAddress('')
                      setError('')
                      setShowBranchForm(true)
                    }}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-blue-700 sm:text-sm"
                  >
                    <Plus size={17} />
                    إضافة فرع
                  </button>
                )}
              </div>

              {!subscriptionResolved && (
                <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800 sm:text-sm">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p>
                    خطة المتجر غير محددة أو الاشتراك غير نشط. لا يمكن إضافة
                    فروع أو إعادة تنشيط فروع قبل مراجعة بيانات الاشتراك.
                  </p>
                </div>
              )}

              {subscriptionResolved && branchLimitReached && (
                <div className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-800 sm:text-sm">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <p>
                    الخطة المجانية تسمح بفرع نشط واحد فقط. يمكنك إيقاف الفرع
                    الحالي قبل تنشيط فرع آخر.
                  </p>
                </div>
              )}

              <div className="mt-4 space-y-3">
                {selectedStore.dokkan_branches.map((branch) => {
                  const isReactivationBlocked =
                    branch.status === 'inactive' &&
                    !canReactivateBranch

                  return (
                    <article
                      key={branch.id}
                      className="rounded-2xl border border-slate-200 p-3 transition hover:border-blue-200 sm:p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            branch.status === 'active'
                              ? 'bg-green-50 text-green-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          <GitBranch size={20} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="break-words font-extrabold text-slate-900">
                              {branch.name}
                            </p>
                            <span
                              className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                                branch.status === 'active'
                                  ? 'bg-green-50 text-green-700'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {branch.status === 'active' ? 'نشط' : 'متوقف'}
                            </span>
                          </div>

                          <p className="mt-2 flex items-start gap-1.5 text-xs leading-5 text-slate-500">
                            <MapPin size={14} className="mt-0.5 shrink-0" />
                            <span>{branch.address || 'لا يوجد عنوان'}</span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                        <button
                          type="button"
                          aria-label={`تعديل ${branch.name}`}
                          onClick={() => {
                            setEditingBranch(branch)
                            setName(branch.name)
                            setAddress(branch.address || '')
                            setError('')
                            setShowBranchForm(true)
                          }}
                          disabled={busy}
                          className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 sm:text-sm"
                        >
                          <Edit3 size={15} />
                          تعديل الفرع
                        </button>

                        <button
                          type="button"
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
                          className={`flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-40 sm:text-sm ${
                            branch.status === 'active'
                              ? 'border-red-100 text-red-600 hover:bg-red-50'
                              : 'border-green-100 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          <Power size={15} />
                          {branch.status === 'active' ? 'إيقاف' : 'تفعيل'}
                        </button>
                      </div>
                    </article>
                  )
                })}

                {!selectedStore.dokkan_branches.length && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <GitBranch className="mx-auto mb-3 text-slate-400" size={30} />
                    <p className="font-bold text-slate-700">
                      لا توجد فروع لهذا المتجر
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      يمكنك إضافة فرع عندما تسمح حالة الاشتراك بذلك
                    </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
            <Store className="mb-3 text-slate-400" size={36} />
            <p className="font-bold text-slate-700">
              اختر متجرًا لعرض تفاصيله
            </p>
            <p className="mt-1 text-xs text-slate-500">
              ستظهر هنا الفروع وإعدادات المتجر
            </p>
          </div>
        )}
      </div>

      {/* Store modal */}
      {showStoreForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setShowStoreForm(false)
            }
          }}
        >
          <form
            onSubmit={submitStore}
            className="my-auto max-h-[94dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Store size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900">
                    {editingStore ? 'تعديل المتجر' : 'إنشاء متجر جديد'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    أدخل بيانات المتجر
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowStoreForm(false)}
                disabled={busy}
                aria-label="إغلاق"
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

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

            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowStoreForm(false)}
                disabled={busy}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    جارٍ الحفظ...
                  </>
                ) : (
                  'حفظ المتجر'
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Branch modal */}
      {showBranchForm && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setShowBranchForm(false)
            }
          }}
        >
          <form
            onSubmit={submitBranch}
            className="my-auto max-h-[94dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <GitBranch size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900">
                    {editingBranch ? 'تعديل الفرع' : 'إضافة فرع جديد'}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    أدخل بيانات الفرع
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBranchForm(false)}
                disabled={busy}
                aria-label="إغلاق"
                className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

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

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setShowBranchForm(false)}
                disabled={busy}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    جارٍ الحفظ...
                  </>
                ) : (
                  'حفظ الفرع'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
