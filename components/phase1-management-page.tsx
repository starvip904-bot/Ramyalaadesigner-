
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
      // التعديل يحدث فقط عندما يكون للسجل رقم حقيقي.
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
        // السجل الجديد بدون ID يجب أن يمر بعملية إنشاء.
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
      {/* Header */}
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

      {/* Summary */}
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

      {/* Search */}
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

      {/* Messages */}
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

      {/* Records */}
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

      {/* Add / Edit Modal */}
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

  async function submit(form: FormData) {
    if (busy) return

    setBusy(true)
    setError('')
    setSuccess('')

    const next = {
      storeId,
      address: String(form.get('address') ?? ''),
      logoUrl: String(form.get('logoUrl') ?? ''),
      invoicePrefix: String(form.get('invoicePrefix') ?? 'INV'),
      nextInvoiceNumber: Number(
        form.get('nextInvoiceNumber') ?? 1
      ),
      printFormat: String(
        form.get('printFormat') ?? 'thermal'
      ),
      paperSize: String(form.get('paperSize') ?? '80mm'),
      rtl: form.get('rtl') === 'on',
      currency: 'EGP',
      taxEnabled: form.get('taxEnabled') === 'on',
      taxRate: form.get('taxRate')
        ? Number(form.get('taxRate'))
        : null,
    }

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
      setSuccess('تم حفظ الإعدادات بنجاح')
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'تعذر حفظ الإعدادات'
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      action={submit}
      className="grid gap-5 rounded-2xl border border-[#e2e8f0] bg-white p-5"
    >
      <div>
        <h2 className="text-xl font-extrabold">
          إعدادات المتجر والفواتير
        </h2>
        <p className="mt-1 text-sm text-[#94a3b8]">
          مستقلة للمتجر الحالي · العملة EGP · دعم RTL
        </p>
      </div>

      <input
        name="address"
        defaultValue={saved?.address ?? ''}
        placeholder="عنوان المتجر"
        className="rounded-xl border px-3 py-2.5"
      />

      <input
        name="logoUrl"
        defaultValue={saved?.logo_url ?? ''}
        placeholder="رابط شعار المتجر"
        className="rounded-xl border px-3 py-2.5"
      />

      <div className="grid gap-4 md:grid-cols-3">
        <input
          name="invoicePrefix"
          defaultValue={saved?.invoice_prefix ?? 'INV'}
          placeholder="بادئة الفاتورة"
          className="rounded-xl border px-3 py-2.5"
        />

        <input
          required
          min="1"
          type="number"
          name="nextInvoiceNumber"
          defaultValue={saved?.next_invoice_number ?? 1}
          placeholder="رقم الفاتورة التالي"
          className="rounded-xl border px-3 py-2.5"
        />

        <select
          name="paperSize"
          defaultValue={saved?.paper_size ?? '80mm'}
          className="rounded-xl border px-3 py-2.5"
        >
          <option value="58mm">58mm</option>
          <option value="80mm">80mm</option>
          <option value="a4">A4</option>
        </select>
      </div>

      <select
        name="printFormat"
        defaultValue={saved?.print_format ?? 'thermal'}
        className="rounded-xl border px-3 py-2.5"
      >
        <option value="thermal">طباعة حرارية</option>
        <option value="a4">طباعة A4</option>
      </select>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="rtl"
          defaultChecked={saved?.rtl ?? true}
        />
        واجهة وفاتورة RTL
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          name="taxEnabled"
          defaultChecked={saved?.tax_enabled ?? false}
        />
        تفعيل الضريبة (اختياري)
      </label>

      <input
        name="taxRate"
        type="number"
        min="0"
        max="100"
        step="0.01"
        defaultValue={saved?.tax_rate ?? ''}
        placeholder="نسبة الضريبة عند التفعيل"
        className="rounded-xl border px-3 py-2.5"
      />

      {error && (
        <p role="alert" className="text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="text-sm font-bold text-emerald-700">
          {success}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-fit rounded-xl bg-[#2563eb] px-5 py-2.5 font-bold text-white disabled:opacity-50"
      >
        {busy ? 'جارٍ الحفظ...' : 'حفظ الإعدادات'}
      </button>
    </form>
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
