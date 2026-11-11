
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

  const filtered = rows.filter((row) =>
    `${row.name} ${row.phone ?? ''}`
      .toLowerCase()
      .includes(search.toLowerCase())
  )

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
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-extrabold">{label}</h2>
          <p className="mt-1 text-sm text-[#94a3b8]">
            بيانات المتجر الحالي فقط
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateForm}
          className="rounded-xl bg-[#2563eb] px-4 py-2.5 text-sm font-bold text-white"
        >
          إضافة {isCustomer ? 'عميل' : 'مورد'}
        </button>
      </div>

      <input
        aria-label={`البحث في ${label}`}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="ابحث بالاسم أو الهاتف"
        className="mt-5 w-full rounded-xl border border-[#e2e8f0] px-4 py-3 outline-none focus:border-[#2563eb]"
      />

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700"
        >
          {error}
        </p>
      )}

      {success && (
        <p
          role="status"
          className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-700"
        >
          {success}
        </p>
      )}

      <div className="mt-5 grid gap-3">
        {filtered.map((row) => (
          <div
            key={row.id}
            className="flex flex-col gap-3 rounded-xl border border-[#edf0f2] p-4 md:flex-row md:items-center md:justify-between"
          >
            <div>
              <p className="font-bold">{row.name}</p>
              <p className="mt-1 text-sm text-[#64748b]">
                {row.phone || 'بدون هاتف'}
                {row.address ? ` · ${row.address}` : ''}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setError('')
                  setSuccess('')
                  setEditing(row)
                }}
                className="rounded-lg border border-[#dfe5e7] px-3 py-2 text-sm font-semibold"
              >
                تعديل
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => archive(row.id)}
                className="rounded-lg border border-[#f0caca] px-3 py-2 text-sm font-semibold text-[#b23838] disabled:opacity-50"
              >
                أرشفة
              </button>
            </div>
          </div>
        ))}

        {!filtered.length && (
          <p className="py-10 text-center text-sm text-[#94a3b8]">
            لا توجد بيانات مطابقة
          </p>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <form
            key={editing.id || 'new-party'}
            onSubmit={submit}
            className="grid w-full max-w-lg gap-4 rounded-2xl bg-white p-6"
          >
            <h3 className="text-lg font-extrabold">
              {editing.id ? 'تعديل' : 'إضافة'}{' '}
              {isCustomer ? 'عميل' : 'مورد'}
            </h3>

            <input
              required
              name="name"
              defaultValue={editing.name}
              placeholder="الاسم"
              className="rounded-xl border px-3 py-2.5"
            />

            <input
              name="phone"
              defaultValue={editing.phone ?? ''}
              placeholder="رقم الهاتف"
              className="rounded-xl border px-3 py-2.5"
            />

            <input
              name="address"
              defaultValue={editing.address ?? ''}
              placeholder="العنوان"
              className="rounded-xl border px-3 py-2.5"
            />

            <textarea
              name="notes"
              defaultValue={editing.notes ?? ''}
              placeholder="ملاحظات"
              className="rounded-xl border px-3 py-2.5"
            />

            <p className="text-xs text-[#94a3b8]">
              بيانات العميل أو المورد مستقلة عن المتاجر الأخرى.
            </p>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[#2563eb] px-4 py-2.5 font-bold text-white disabled:opacity-50"
              >
                {busy ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setEditing(null)
                  setError('')
                }}
                className="rounded-xl border px-4 py-2.5 font-semibold"
              >
                إلغاء
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
