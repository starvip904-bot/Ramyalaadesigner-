
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  archiveCustomer,
  archiveSupplier,
  createCustomer,
  createSupplier,
  saveStoreSettings,
  updateCustomer,
  updateSupplier,
} from '@/app/actions/phase1'
import {
  Users,
  UserRound,
  Search,
  X,
  Phone,
  MapPin,
  Pencil,
  Archive,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  UserPlus,
  Store,
  Receipt,
  Printer,
  Percent,
  Image as ImageIcon,
  Save,
  Settings2,
} from 'lucide-react'

type Party = {
  id: string
  name: string
  phone: string | null
  address: string | null
  notes: string | null
}

type Settings = {
  address: string | null
  logo_url: string | null
  invoice_prefix: string
  next_invoice_number: number
  print_format: string
  paper_size: string
  rtl: boolean
  currency: string
  tax_enabled: boolean
  tax_rate: number | null
} | null

type Audit = {
  id: string
  action: string
  entity_type: string
  entity_id: string
  actor_id: string | null
  created_at: string
  branch_id: string | null
}

export default function Phase1ManagementPage({
  type,
  storeId,
  initialCustomers = [],
  initialSuppliers = [],
  initialSettings,
  initialAudit = [],
}: {
  type: string
  storeId: string
  initialCustomers?: Party[]
  initialSuppliers?: Party[]
  initialSettings: Settings
  initialAudit?: Audit[]
}) {
  if (type === 'settings') {
    return <SettingsPanel storeId={storeId} initial={initialSettings} />
  }

  if (type === 'audit-log') {
    return <AuditPanel rows={initialAudit} />
  }

  return (
    <PartyPanel
      type={type === 'customers' ? 'customers' : 'suppliers'}
      storeId={storeId}
      initial={type === 'customers' ? initialCustomers : initialSuppliers}
    />
  )
}

function PartyPanel({
  type,
  storeId,
  initial,
}: {
  type: 'customers' | 'suppliers'
  storeId: string
  initial: Party[]
}) {
  const router = useRouter()

  const [rows, setRows] = useState(initial)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Party | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const isCustomer = type === 'customers'
  const label = isCustomer ? 'العملاء' : 'الموردون'
  const singular = isCustomer ? 'عميل' : 'مورد'

  const filtered = rows.filter((row) =>
    `${row.name} ${row.phone ?? ''} ${row.address ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase().trim())
  )

  const withPhoneCount = rows.filter((row) => row.phone?.trim()).length

  function openCreateForm() {
    setError('')
    setSuccess('')
    setEditing({
      id: '',
      name: '',
      phone: '',
      address: '',
      notes: '',
    })
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (busy || !editing) return

    const form = new FormData(event.currentTarget)

    const input = {
      name: String(form.get('name') ?? '').trim(),
      phone: String(form.get('phone') ?? '').trim(),
      address: String(form.get('address') ?? '').trim(),
      notes: String(form.get('notes') ?? '').trim(),
    }

    if (!input.name) {
      setError('أدخل الاسم أولاً')
      return
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      if (editing.id) {
        if (isCustomer) {
          await updateCustomer({
            id: editing.id,
            ...input,
          })
        } else {
          await updateSupplier({
            id: editing.id,
            ...input,
          })
        }

        setRows((current) =>
          current.map((row) =>
            row.id === editing.id
              ? { ...row, ...input }
              : row
          )
        )

        setSuccess('تم تحديث البيانات بنجاح')
      } else {
        if (isCustomer) {
          const result = await createCustomer({
            storeId,
            ...input,
          })

          if (!result.ok) {
            setError(
              `${result.message} — معرف التشخيص: ${result.diagnosticId}`
            )
            return
          }

          setRows((current) => [
            {
              id: result.id,
              ...input,
            },
            ...current,
          ])
        } else {
          const id = await createSupplier({
            storeId,
            ...input,
          })

          setRows((current) => [
            {
              id,
              ...input,
            },
            ...current,
          ])
        }

        setSuccess(
          isCustomer
            ? 'تم إضافة العميل بنجاح'
            : 'تم إضافة المورد بنجاح'
        )
      }

      setEditing(null)
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر حفظ البيانات'
      )
    } finally {
      setBusy(false)
    }
  }

  async function archive(id: string) {
    if (busy) return

    const confirmed = window.confirm(
      `هل تريد أرشفة ${isCustomer ? 'العميل' : 'المورد'}؟`
    )

    if (!confirmed) return

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      if (isCustomer) {
        await archiveCustomer(id)
      } else {
        await archiveSupplier(id)
      }

      setRows((current) =>
        current.filter((row) => row.id !== id)
      )

      setSuccess('تمت الأرشفة بنجاح')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذرت الأرشفة'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-5 sm:space-y-6" dir="rtl">
      <header className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-l from-blue-50 via-white to-white p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
              {isCustomer ? <Users size={25} /> : <UserRound size={25} />}
            </div>

            <div>
              <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
                إدارة {label}
              </h2>
              <p className="mt-1 text-xs leading-6 text-slate-500 sm:text-sm">
                إضافة البيانات ومراجعتها وإدارة سجلات {label}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={openCreateForm}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:w-auto"
          >
            <Plus size={19} />
            إضافة {singular}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            {isCustomer ? <Users size={21} /> : <UserRound size={21} />}
          </div>
          <p className="mt-3 text-xs text-slate-500 sm:text-sm">
            إجمالي {label}
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">
            {rows.length}
          </p>
        </div>

        <div className="rounded-2xl border border-green-100 bg-white p-4 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
            <Phone size={20} />
          </div>
          <p className="mt-3 text-xs text-slate-500 sm:text-sm">
            لديهم رقم هاتف
          </p>
          <p className="mt-1 text-2xl font-extrabold text-green-700">
            {withPhoneCount}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 transition focus-within:border-blue-400 focus-within:bg-white">
          <Search size={19} className="shrink-0 text-slate-400" />

          <input
            aria-label={`البحث في ${label}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث بالاسم أو الهاتف أو العنوان"
            className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-slate-400"
          />

          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              aria-label="مسح البحث"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
            >
              <X size={17} />
            </button>
          )}
        </label>

        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            عرض {filtered.length} من {rows.length}
          </span>
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="font-bold text-blue-600"
            >
              إلغاء البحث
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold leading-6 text-red-700"
        >
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="إغلاق التنبيه"
            className="rounded-lg p-1 hover:bg-red-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700"
        >
          <CheckCircle2 size={19} />
          {success}
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
          <div>
            <h3 className="font-extrabold text-slate-900">
              قائمة {label}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              بيانات المتجر الحالي فقط
            </p>
          </div>

          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
            {filtered.length} سجل
          </span>
        </div>

        <div className="space-y-3 p-3 sm:p-4">
          {filtered.map((row) => (
            <article
              key={row.id}
              className="rounded-2xl border border-slate-200 p-3 transition hover:border-blue-200 sm:p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  {isCustomer ? <UserRound size={21} /> : <Users size={21} />}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="break-words font-extrabold text-slate-900">
                    {row.name}
                  </p>

                  <div className="mt-2 space-y-1.5">
                    <p className="flex items-center gap-2 text-xs text-slate-500">
                      <Phone size={14} className="shrink-0" />
                      <span>{row.phone || 'بدون رقم هاتف'}</span>
                    </p>

                    <p className="flex items-start gap-2 text-xs leading-5 text-slate-500">
                      <MapPin size={14} className="mt-0.5 shrink-0" />
                      <span className="break-words">
                        {row.address || 'لا يوجد عنوان مسجل'}
                      </span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setError('')
                    setSuccess('')
                    setEditing(row)
                  }}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700 disabled:opacity-50 sm:text-sm"
                >
                  <Pencil size={15} />
                  تعديل
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={() => archive(row.id)}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-100 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50 sm:text-sm"
                >
                  <Archive size={15} />
                  أرشفة
                </button>
              </div>
            </article>
          ))}

          {!filtered.length && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
                {search ? <Search size={24} /> : <UserPlus size={24} />}
              </div>

              <p className="mt-3 font-bold text-slate-700">
                {search ? 'لا توجد نتائج مطابقة' : `لا يوجد ${label} بعد`}
              </p>

              <p className="mt-1 text-xs leading-6 text-slate-500">
                {search
                  ? 'جرّب البحث باسم أو رقم هاتف أو عنوان مختلف'
                  : `يمكنك إضافة أول ${singular} للبدء`}
              </p>

              {!search && (
                <button
                  type="button"
                  onClick={openCreateForm}
                  className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white"
                >
                  <Plus size={16} />
                  إضافة {singular}
                </button>
              )}
            </div>
          )}
        </div>
      </section>

      {editing && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy) {
              setEditing(null)
              setError('')
            }
          }}
        >
          <form
            key={editing.id || 'new-party'}
            onSubmit={submit}
            className="my-auto max-h-[94dvh] w-full max-w-lg space-y-4 overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-6"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  {editing.id ? <Pencil size={20} /> : <UserPlus size={20} />}
                </div>

                <div>
                  <h3 className="font-extrabold text-slate-900">
                    {editing.id ? 'تعديل بيانات' : 'إضافة'} {singular}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    أدخل البيانات المطلوبة
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(null)
                  setError('')
                }}
                aria-label="إغلاق"
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </div>

            <label className="flex flex-col gap-2 text-sm font-bold text-slate-700">
              الاسم
              <input
                required
                name="name"
                defaultValue={editing.name}
                placeholder={`اسم ${singular}`}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-bold text-slate-700">
              رقم الهاتف
              <input
                name="phone"
                type="tel"
                inputMode="tel"
                defaultValue={editing.phone ?? ''}
                placeholder="رقم الهاتف"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-bold text-slate-700">
              العنوان
              <input
                name="address"
                defaultValue={editing.address ?? ''}
                placeholder="العنوان"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-bold text-slate-700">
              ملاحظات
              <textarea
                name="notes"
                rows={3}
                defaultValue={editing.notes ?? ''}
                placeholder="أضف أي ملاحظات (اختياري)"
                className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <p className="rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-500">
              بيانات {singular} مرتبطة بالمتجر الحالي فقط، ولا يتم عرضها
              لمتاجر أخرى.
            </p>

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold leading-6 text-red-700"
              >
                <AlertCircle size={18} className="mt-0.5 shrink-0" />
                <span className="break-words">{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(null)
                  setError('')
                }}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-600 disabled:opacity-50"
              >
                إلغاء
              </button>

              <button
                type="submit"
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    جارٍ الحفظ...
                  </>
                ) : (
                  'حفظ البيانات'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}

function SettingsPanel({
  storeId,
  initial,
}: {
  storeId: string
  initial: Settings
}) {
  const router = useRouter()
  const [saved, setSaved] = useState(initial)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (busy) return

    const form = new FormData(event.currentTarget)

    const invoicePrefix = String(
      form.get('invoicePrefix') ?? ''
    ).trim()

    const nextInvoiceNumber = Number(
      form.get('nextInvoiceNumber') ?? 0
    )

    const taxEnabled = form.get('taxEnabled') === 'on'
    const taxRateValue = String(form.get('taxRate') ?? '').trim()
    const taxRate = taxRateValue === '' ? null : Number(taxRateValue)

    if (!invoicePrefix) {
      setError('أدخل بادئة الفاتورة أولاً')
      return
    }

    if (
      !Number.isSafeInteger(nextInvoiceNumber) ||
      nextInvoiceNumber < 1
    ) {
      setError('رقم الفاتورة التالي يجب أن يكون رقمًا صحيحًا أكبر من صفر')
      return
    }

    if (
      taxEnabled &&
      (taxRate === null ||
        !Number.isFinite(taxRate) ||
        taxRate < 0 ||
        taxRate > 100)
    ) {
      setError('أدخل نسبة ضريبة صحيحة من 0 إلى 100')
      return
    }

    if (
      taxRate !== null &&
      (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)
    ) {
      setError('نسبة الضريبة يجب أن تكون من 0 إلى 100')
      return
    }

    const next = {
      storeId,
      address: String(form.get('address') ?? '').trim(),
      logoUrl: String(form.get('logoUrl') ?? '').trim(),
      invoicePrefix,
      nextInvoiceNumber,
      printFormat: String(form.get('printFormat') ?? 'thermal'),
      paperSize: String(form.get('paperSize') ?? '80mm'),
      rtl: form.get('rtl') === 'on',
      currency: 'EGP',
      taxEnabled,
      taxRate,
    }

    setBusy(true)
    setError('')
    setSuccess('')

    try {
      await saveStoreSettings(next)

      const updated = {
        address: next.address,
        logo_url: next.logoUrl,
        invoice_prefix: next.invoicePrefix,
        next_invoice_number: next.nextInvoiceNumber,
        print_format: next.printFormat,
        paper_size: next.paperSize,
        rtl: next.rtl,
        currency: 'EGP',
        tax_enabled: next.taxEnabled,
        tax_rate: next.taxRate,
      }

      setSaved(updated)
      setSuccess('تم حفظ إعدادات المتجر بنجاح')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر حفظ الإعدادات، حاول مرة أخرى'
      )
    } finally {
      setBusy(false)
    }
  }

  const inputClass =
    'w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100'

  const labelClass = 'mb-2 block text-sm font-bold text-slate-700'

  return (
    <section className="space-y-5 sm:space-y-6" dir="rtl">
      <header className="overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-l from-blue-50 via-white to-white p-4 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-sm">
            <Settings2 size={25} />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 sm:text-2xl">
              إعدادات المتجر
            </h2>
            <p className="mt-1 text-xs leading-6 text-slate-500 sm:text-sm">
              تحكم في بيانات المتجر والفواتير والطباعة والضريبة
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-blue-100 bg-white/80 p-3 text-xs leading-6 text-slate-600">
          هذه الإعدادات تخص المتجر الحالي فقط، ويتم حفظها من خلال إعدادات المتجر المرتبطة بحسابك.
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold leading-6 text-red-700"
        >
          <AlertCircle size={19} className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1 break-words">{error}</span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="إغلاق التنبيه"
            className="rounded-lg p-1 hover:bg-red-100"
          >
            <X size={16} />
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700"
        >
          <CheckCircle2 size={19} className="shrink-0" />
          {success}
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Store size={21} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900">
                بيانات المتجر
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                المعلومات التي تظهر في بيانات المتجر
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <label className="min-w-0">
              <span className={labelClass}>عنوان المتجر</span>
              <input
                name="address"
                defaultValue={saved?.address ?? ''}
                placeholder="اكتب عنوان المتجر"
                className={inputClass}
              />
            </label>

            <label className="min-w-0">
              <span className={`${labelClass} flex items-center gap-2`}>
                <ImageIcon size={16} />
                رابط شعار المتجر
              </span>
              <input
                name="logoUrl"
                type="url"
                defaultValue={saved?.logo_url ?? ''}
                placeholder="https://example.com/logo.png"
                className={inputClass}
                dir="ltr"
              />
              <span className="mt-1 block text-xs text-slate-400">
                اختياري — أدخل رابط صورة مباشرًا للشعار
              </span>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Receipt size={21} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900">
                إعدادات الفواتير
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                التحكم في ترقيم الفواتير وطريقة عرضها
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <label className="min-w-0">
              <span className={labelClass}>بادئة الفاتورة</span>
              <input
                required
                name="invoicePrefix"
                defaultValue={saved?.invoice_prefix ?? 'INV'}
                placeholder="مثال: INV"
                className={inputClass}
                dir="ltr"
              />
              <span className="mt-1 block text-xs text-slate-400">
                النص الذي يسبق رقم الفاتورة
              </span>
            </label>

            <label className="min-w-0">
              <span className={labelClass}>رقم الفاتورة التالي</span>
              <input
                required
                min="1"
                step="1"
                type="number"
                name="nextInvoiceNumber"
                defaultValue={saved?.next_invoice_number ?? 1}
                placeholder="1"
                className={inputClass}
                dir="ltr"
              />
              <span className="mt-1 block text-xs text-slate-400">
                يجب أن يكون رقمًا صحيحًا أكبر من صفر
              </span>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
              <Printer size={21} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900">
                إعدادات الطباعة
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                اختر تنسيق الطباعة وحجم الورق
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <label className="min-w-0">
              <span className={labelClass}>تنسيق الطباعة</span>
              <select
                name="printFormat"
                defaultValue={saved?.print_format ?? 'thermal'}
                className={inputClass}
              >
                <option value="thermal">طباعة حرارية</option>
                <option value="a4">طباعة A4</option>
              </select>
            </label>

            <label className="min-w-0">
              <span className={labelClass}>حجم الورق</span>
              <select
                name="paperSize"
                defaultValue={saved?.paper_size ?? '80mm'}
                className={inputClass}
              >
                <option value="58mm">58mm</option>
                <option value="80mm">80mm</option>
                <option value="a4">A4</option>
              </select>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Percent size={21} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900">
                الضريبة واتجاه الكتابة
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                إعدادات اختيارية خاصة بالفواتير
              </p>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-200">
              <input
                type="checkbox"
                name="rtl"
                defaultChecked={saved?.rtl ?? true}
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <span>
                <span className="block text-sm font-bold text-slate-800">
                  اتجاه الكتابة من اليمين إلى اليسار
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  استخدام اتجاه RTL في عرض الواجهة والفاتورة
                </span>
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-blue-200">
              <input
                type="checkbox"
                name="taxEnabled"
                defaultChecked={saved?.tax_enabled ?? false}
                className="mt-1 h-4 w-4 accent-blue-600"
              />
              <span>
                <span className="block text-sm font-bold text-slate-800">
                  تفعيل الضريبة
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  تفعيل خيار الضريبة في إعدادات المتجر
                </span>
              </span>
            </label>

            <label className="block max-w-sm">
              <span className={labelClass}>نسبة الضريبة (%)</span>
              <input
                name="taxRate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                defaultValue={saved?.tax_rate ?? ''}
                placeholder="مثال: 14"
                className={inputClass}
                dir="ltr"
              />
              <span className="mt-1 block text-xs text-slate-400">
                عند تفعيل الضريبة يجب إدخال نسبة من 0 إلى 100
              </span>
            </label>
          </div>
        </section>

        <div className="sticky bottom-2 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <button
            type="submit"
            disabled={busy}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-48"
          >
            {busy ? (
              <>
                <RefreshCw size={18} className="animate-spin" />
                جارٍ حفظ الإعدادات...
              </>
            ) : (
              <>
                <Save size={18} />
                حفظ الإعدادات
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}

function AuditPanel({ rows }: { rows: Audit[] }) {
  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
      <h2 className="text-xl font-extrabold">سجل العمليات</h2>
      <p className="mt-1 text-sm text-[#94a3b8]">
        سجل للقراءة فقط للمستخدمين المصرح لهم
      </p>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[700px] text-right text-sm">
          <thead>
            <tr className="border-b text-[#94a3b8]">
              <th className="p-3">العملية</th>
              <th>النوع</th>
              <th>المعرف</th>
              <th>التاريخ</th>
              <th>الفرع</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-3 font-bold">{row.action}</td>
                <td>{row.entity_type}</td>
                <td className="font-mono text-xs">
                  {row.entity_id}
                </td>
                <td>
                  {new Date(row.created_at).toLocaleString('ar-EG')}
                </td>
                <td>{row.branch_id || 'المتجر'}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {!rows.length && (
          <p className="py-10 text-center text-sm text-[#94a3b8]">
            لا توجد عمليات مسجلة
          </p>
        )}
      </div>
    </section>
  )
}
