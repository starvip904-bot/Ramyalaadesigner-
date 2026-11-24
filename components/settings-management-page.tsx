
'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import {
  saveStoreSettings,
} from '@/app/actions/phase1'
import ThemeToggle from '@/components/theme-toggle'
import {
  Store,
  Receipt,
  Printer,
  Percent,
  Image as ImageIcon,
  Save,
  Settings2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Palette,
  Bell,
  Building2,
} from 'lucide-react'

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

type SettingsTab =
  | 'store'
  | 'invoices'
  | 'tax'
  | 'appearance'

const tabs: {
  id: SettingsTab
  label: string
  description: string
  icon: typeof Store
}[] = [
  {
    id: 'store',
    label: 'بيانات المتجر',
    description: 'العنوان والشعار',
    icon: Store,
  },
  {
    id: 'invoices',
    label: 'الفواتير والطباعة',
    description: 'الترقيم وحجم الورق',
    icon: Receipt,
  },
  {
    id: 'tax',
    label: 'الضرائب',
    description: 'نسبة الضريبة واتجاه الفاتورة',
    icon: Percent,
  },
  {
    id: 'appearance',
    label: 'المظهر والإشعارات',
    description: 'شكل التطبيق والتنبيهات',
    icon: Palette,
  },
]

export default function SettingsManagementPage({
  storeId,
  initial,
}: {
  storeId: string
  initial: Settings
}) {
  const router = useRouter()

  const [activeTab, setActiveTab] = useState<SettingsTab>('store')
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
    const taxRateValue = String(
      form.get('taxRate') ?? ''
    ).trim()

    const taxRate =
      taxRateValue === '' ? null : Number(taxRateValue)

    if (!invoicePrefix) {
      setActiveTab('invoices')
      setError('أدخل بادئة الفاتورة أولاً')
      setSuccess('')
      return
    }

    if (
      !Number.isSafeInteger(nextInvoiceNumber) ||
      nextInvoiceNumber < 1
    ) {
      setActiveTab('invoices')
      setError(
        'رقم الفاتورة التالي يجب أن يكون رقمًا صحيحًا أكبر من صفر'
      )
      setSuccess('')
      return
    }

    if (
      taxEnabled &&
      (
        taxRate === null ||
        !Number.isFinite(taxRate) ||
        taxRate < 0 ||
        taxRate > 100
      )
    ) {
      setActiveTab('tax')
      setError('أدخل نسبة ضريبة صحيحة من 0 إلى 100')
      setSuccess('')
      return
    }

    if (
      taxRate !== null &&
      (
        !Number.isFinite(taxRate) ||
        taxRate < 0 ||
        taxRate > 100
      )
    ) {
      setActiveTab('tax')
      setError('نسبة الضريبة يجب أن تكون من 0 إلى 100')
      setSuccess('')
      return
    }

    const next = {
      storeId,
      address: String(
        form.get('address') ?? ''
      ).trim(),
      logoUrl: String(
        form.get('logoUrl') ?? ''
      ).trim(),
      invoicePrefix,
      nextInvoiceNumber,
      printFormat: String(
        form.get('printFormat') ?? 'thermal'
      ),
      paperSize: String(
        form.get('paperSize') ?? '80mm'
      ),
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

  const labelClass =
    'mb-2 block text-sm font-bold text-slate-700'

  function changeTab(tab: SettingsTab) {
    setActiveTab(tab)
    setError('')
    setSuccess('')
  }

  return (
    <section
      className="space-y-5 sm:space-y-6"
      dir="rtl"
    >
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
              إدارة إعدادات المتجر والفواتير والمظهر من مكان واحد
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-white/80 p-3 text-xs leading-6 text-slate-600">
          <Building2
            size={17}
            className="mt-0.5 shrink-0 text-blue-600"
          />
          <p>
            هذه الإعدادات تخص المتجر الحالي فقط، ويتم حفظ
            بيانات المتجر والفواتير من خلال إعدادات المتجر
            المرتبطة بحسابك.
          </p>
        </div>
      </header>

      <nav
        aria-label="أقسام إعدادات المتجر"
        className="grid grid-cols-2 gap-2 sm:grid-cols-4"
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => changeTab(tab.id)}
              aria-pressed={active}
              className={`flex min-h-[92px] flex-col items-start justify-center gap-2 rounded-2xl border p-3 text-right transition sm:p-4 ${
                active
                  ? 'border-blue-300 bg-blue-50 text-blue-800 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-slate-50'
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Icon size={19} />
              </span>

              <span>
                <span className="block text-xs font-extrabold sm:text-sm">
                  {tab.label}
                </span>
                <span className="mt-1 block text-[10px] leading-4 text-slate-500 sm:text-xs">
                  {tab.description}
                </span>
              </span>
            </button>
          )
        })}
      </nav>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold leading-6 text-red-700"
        >
          <AlertCircle
            size={19}
            className="mt-0.5 shrink-0"
          />
          <span className="min-w-0 flex-1 break-words">
            {error}
          </span>
          <button
            type="button"
            onClick={() => setError('')}
            aria-label="إغلاق التنبيه"
            className="rounded-lg p-1 hover:bg-red-100"
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-bold text-green-700"
        >
          <CheckCircle2
            size={19}
            className="shrink-0"
          />
          {success}
        </div>
      )}

      <form
        onSubmit={submit}
        className="space-y-4"
      >
        {/* الصفحة الأولى: بيانات المتجر */}
        <section
          hidden={activeTab !== 'store'}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
              <Store size={21} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900">
                بيانات المتجر
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                المعلومات الأساسية التي تظهر في بيانات المتجر
              </p>
            </div>
          </div>

          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
            <label className="min-w-0">
              <span className={labelClass}>
                عنوان المتجر
              </span>
              <input
                name="address"
                defaultValue={saved?.address ?? ''}
                placeholder="اكتب عنوان المتجر"
                className={inputClass}
              />
            </label>

            <label className="min-w-0">
              <span
                className={`${labelClass} flex items-center gap-2`}
              >
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

        {/* الصفحة الثانية: الفواتير والطباعة */}
        <section
          hidden={activeTab !== 'invoices'}
          className="space-y-4"
        >
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
                <span className={labelClass}>
                  بادئة الفاتورة
                </span>
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
                <span className={labelClass}>
                  رقم الفاتورة التالي
                </span>
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
                <span className={labelClass}>
                  تنسيق الطباعة
                </span>
                <select
                  name="printFormat"
                  defaultValue={saved?.print_format ?? 'thermal'}
                  className={inputClass}
                >
                  <option value="thermal">
                    طباعة حرارية
                  </option>
                  <option value="a4">
                    طباعة A4
                  </option>
                </select>
              </label>

              <label className="min-w-0">
                <span className={labelClass}>
                  حجم الورق
                </span>
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
        </section>

        {/* الصفحة الثالثة: الضرائب */}
        <section
          hidden={activeTab !== 'tax'}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        >
          <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <Percent size={21} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900">
                إعدادات الضرائب والفاتورة
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
              <span className={labelClass}>
                نسبة الضريبة (%)
              </span>
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

        {/* الصفحة الرابعة: المظهر والإشعارات */}
        <section
          hidden={activeTab !== 'appearance'}
          className="space-y-4"
        >
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <Palette size={21} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900">
                  مظهر التطبيق
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  اختر طريقة عرض دكان
                </p>
              </div>
            </div>

            <div className="space-y-3 p-4 sm:p-5">
              <p className="text-sm leading-6 text-slate-600">
                يمكنك اختيار المظهر التلقائي حسب إعدادات الجهاز،
                أو استخدام الوضع الفاتح أو الداكن.
              </p>

              <div className="inline-flex max-w-full rounded-xl border border-slate-200 bg-slate-50 p-2">
                <ThemeToggle />
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/70 p-4 sm:p-5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                <Bell size={21} />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900">
                  تفضيلات الإشعارات
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  إدارة التنبيهات التي تصلك من التطبيق
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-5">
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-sm font-bold text-amber-800">
                  إعدادات الإشعارات قيد التجهيز
                </p>
                <p className="mt-2 text-xs leading-6 text-amber-700">
                  نظام الإشعارات يحتاج إلى ربط تفضيلات المستخدم
                  بخدمة إرسال التنبيهات. لم يتم تفعيل خيارات
                  وهمية أو حفظ تفضيلات غير مرتبطة بالنظام.
                </p>
              </div>
            </div>
          </section>
        </section>

        <div className="sticky bottom-2 z-10 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none">
          <button
            type="submit"
            disabled={busy}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-extrabold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:min-w-48"
          >
            {busy ? (
              <>
                <RefreshCw
                  size={18}
                  className="animate-spin"
                />
                جارٍ حفظ الإعدادات...
              </>
            ) : (
              <>
                <Save size={18} />
                حفظ إعدادات المتجر
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  )
}
