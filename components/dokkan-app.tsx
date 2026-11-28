
'use client'

import { useState } from 'react'
import DokkanSidebar from '@/components/dokkan-sidebar'
import ThemeToggle from '@/components/theme-toggle'
import MobileBottomNav from '@/components/mobile-bottom-nav'
import {
  LayoutDashboard,
  Store,
  Package,
  Boxes,
  ShoppingCart,
  ReceiptText,
  Truck,
  Users,
  WalletCards,
  BarChart3,
  UserCog,
  Bell,
  Search,
  Plus,
  Menu,
  X,
  ChevronLeft,
  ArrowUpLeft,
  ArrowDownLeft,
  Filter,
  Download,
  CalendarDays,
  ScanLine,
  CreditCard,
  CircleDollarSign,
  ArrowLeftRight,
  RotateCcw,
  ClipboardList,
  Sparkles,
} from 'lucide-react'
import ManagementPage from '@/components/management-page'
import WorkflowPage from '@/components/workflow-page'
import LogoutButton from '@/components/auth/logout-button'

const navGroups = [
  {
    title: 'الإدارة الأساسية',
    items: [
      { label: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard },
      { label: 'المتاجر والفروع', href: '/stores', icon: Store },
      { label: 'الموظفون والصلاحيات', href: '/employees', icon: UserCog },
    ],
  },
  {
    title: 'المنتجات والمخزون',
    items: [
      { label: 'المنتجات والمخزون', href: '/products', icon: Package },
      { label: 'الجرد', href: '/inventory-counts', icon: ClipboardList },
      { label: 'التحويلات بين الفروع', href: '/transfers', icon: ArrowLeftRight },
    ],
  },
  {
    title: 'المبيعات والعملاء',
    items: [
      { label: 'نقطة البيع POS', href: '/pos', icon: ShoppingCart },
      { label: 'المبيعات والفواتير', href: '/sales', icon: ReceiptText },
      { label: 'المرتجعات والاستبدال', href: '/returns', icon: RotateCcw },
      { label: 'العملاء', href: '/customers', icon: Users },
    ],
  },
  {
    title: 'المشتريات والمالية',
    items: [
      { label: 'الموردون', href: '/suppliers', icon: Truck },
      { label: 'المشتريات ومدفوعات الموردين', href: '/purchases', icon: Truck },
      { label: 'المصروفات', href: '/expenses', icon: WalletCards },
      { label: 'التقارير والأرباح', href: '/reports', icon: BarChart3 },
    ],
  },
  {
    title: 'الاشتراك والإعدادات',
    items: [
      { label: 'اشتراكي وخطتي', href: '/subscription', icon: CreditCard },
      { label: 'الخطط والأسعار', href: '/pricing', icon: Sparkles },
      { label: 'سجل العمليات', href: '/audit-log', icon: ClipboardList },
      { label: 'إعدادات المتجر والفواتير', href: '/settings', icon: Store },
    ],
  },
]

const nav = navGroups.flatMap((group) => group.items)

const pageMeta: Record<string, { title: string; desc: string }> = {
  dashboard: { title: 'نظرة عامة', desc: 'تابع أداء متجرك اليوم' },
  stores: { title: 'المتاجر والفروع', desc: 'إدارة متاجرك وفروعك من مكان واحد' },
  products: { title: 'المنتجات والمخزون', desc: 'إدارة المنتجات والمتغيرات والأرصدة وحركات المخزون' },
  inventory: { title: 'المنتجات والمخزون', desc: 'إدارة المنتجات والمتغيرات والأرصدة وحركات المخزون' },
  'inventory-counts': { title: 'الجرد', desc: 'إنشاء الجرد ومراجعة الفروق واعتماد التسويات' },
  pos: { title: 'نقطة البيع', desc: 'أنشئ فاتورة جديدة بسهولة وسرعة' },
  sales: { title: 'سجل المبيعات', desc: 'راجع جميع عمليات البيع والفواتير' },
  purchases: { title: 'المشتريات والموردين', desc: 'إدارة التوريد والفواتير والموردين' },
  customers: { title: 'العملاء', desc: 'ملف شامل لعملائك ونشاطهم' },
  suppliers: { title: 'الموردون', desc: 'إدارة الموردين وبيانات التوريد' },
  expenses: { title: 'المصروفات', desc: 'تتبع مصروفات وتشغيل متجرك' },
  reports: { title: 'التقارير والأرباح', desc: 'تحليلات وتقارير تساعدك على اتخاذ القرار' },
  employees: { title: 'الموظفون والصلاحيات', desc: 'إدارة فريق العمل وصلاحيات الوصول' },
  transfers: { title: 'التحويلات بين الفروع', desc: 'نقل المخزون بين الفروع' },
  returns: { title: 'المرتجعات والاستبدال', desc: 'إدارة مرتجعات واستبدال المنتجات' },
  'audit-log': { title: 'سجل العمليات', desc: 'تتبع التغييرات والحركات على النظام' },
  settings: { title: 'إعدادات المتجر والفواتير', desc: 'إعدادات المتجر والفواتير والهوية' },
}

// بيانات العرض القديمة محفوظة كما هي مؤقتًا.
// لا تعتمد عليها باعتبارها بيانات فعلية للمتجر.
const products = [
  ['حذاء حريمي كلاسيك', 'أحذية حريمي', '١٢٠', '٢٤٥ ج.م', 'متوفر'],
  ['حذاء أطفال رياضي', 'أحذية أطفال', '٤٨', '٣٩٠ ج.م', 'متوفر'],
  ['شنطة حريمي جلد', 'شنط حريمي', '١٢', '٢٨٠ ج.م', 'منخفض'],
  ['شنطة كروس صغيرة', 'شنط حريمي', '٠', '٤٥٠ ج.م', 'نفد'],
]

const managementRows: Record<string, string[][]> = {
  stores: [
    ['رضا شوب - الإدارة المركزية', 'الفرع الرئيسي', 'نشط', 'اليوم'],
    ['فرع خلوصي', 'شارع خلوصي', 'نشط', 'منذ ٣ أيام'],
    ['فرع شبرا', 'شبرا', 'متوقف', 'منذ أسبوع'],
  ],
  purchases: [
    ['شركة النور للتجارة', 'مواد تغليف', '١٢٬٨٠٠ ج.م', 'نشطة'],
    ['مؤسسة الرواد', 'ملابس جاهزة', '٨٬٤٥٠ ج.م', 'نشطة'],
    ['مورد الخليج', 'إكسسوارات', '٤٬٢٠٠ ج.م', 'مراجعة'],
  ],
  customers: [
    ['أحمد محمد', '١٨ طلباً', '٦٬٤٨٠ ج.م', 'نشط'],
    ['سارة علي', '١٢ طلباً', '٤٬٩٢٠ ج.م', 'نشط'],
    ['خالد عبدالله', '٥ طلبات', '١٬٨٥٠ ج.م', 'جديد'],
  ],
  expenses: [
    ['إيجار الفرع', 'تشغيل', '٨٬٥٠٠ ج.م', 'مدفوعة'],
    ['رواتب الموظفين', 'موارد بشرية', '٢٤٬٠٠٠ ج.م', 'مدفوعة'],
    ['صيانة وتجهيزات', 'تشغيل', '١٬٢٥٠ ج.م', 'مراجعة'],
  ],
  employees: [
    ['محمد عبدالله', 'مدير النظام', 'كل الصلاحيات', 'نشط'],
    ['نورة أحمد', 'مدير فرع', 'المبيعات والمخزون', 'نشط'],
    ['عمر خالد', 'كاشير', 'نقطة البيع فقط', 'نشط'],
  ],
  reports: [
    ['تقرير المبيعات اليومية', 'مبيعات', 'اليوم، ٠٩:٣٠ ص', 'جاهز'],
    ['حركة المخزون', 'مخزون', 'أمس، ٠٦:٤٥ م', 'جاهز'],
    ['أداء الفروع', 'تشغيل', '١ ديسمبر ٢٠٢٤', 'قيد الإنشاء'],
  ],
}

const sales = [
  ['#INV-1048', 'أحمد محمد', 'اليوم، ١٠:٢٤ ص', '٤٨٠ ج.م', 'مكتملة'],
  ['#INV-1047', 'سارة علي', 'اليوم، ٠٩:٥٨ ص', '٢٨٠ ج.م', 'مكتملة'],
  ['#INV-1046', 'عميل نقدي', 'أمس، ٠٨:٣٢ م', '١٬١٥٠ ج.م', 'مكتملة'],
  ['#INV-1045', 'خالد عبدالله', 'أمس، ٠٦:١٠ م', '٣٩٠ ج.م', 'مسترجعة'],
]

function Badge({
  children,
  tone = 'green',
}: {
  children: React.ReactNode
  tone?: 'green' | 'orange' | 'red' | 'blue'
}) {
  const colors = {
    green: 'bg-[var(--success)]/10 text-[var(--success)]',
    orange: 'bg-[var(--warning)]/10 text-[var(--warning)]',
    red: 'bg-[var(--danger)]/10 text-[var(--danger)]',
    blue: 'bg-[var(--info)]/10 text-[var(--info)]',
  }

  return (
    <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${colors[tone]}`}>
      {children}
    </span>
  )
}

function StatCard({
  label,
  value,
  change,
  up,
  icon: Icon,
}: {
  label: string
  value: string
  change: string
  up?: boolean
  icon: React.ElementType
}) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between">
        <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
          <Icon size={21} />
        </div>
        <span
          className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ${
            up
              ? 'bg-[var(--success)]/10 text-[var(--success)]'
              : 'bg-[var(--danger)]/10 text-[var(--danger)]'
          }`}
        >
          {up ? <ArrowUpLeft size={14} /> : <ArrowDownLeft size={14} />}
          {change}
        </span>
      </div>
      <p className="mt-5 text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-[var(--foreground)]">
        {value}
      </p>
    </div>
  )
}

function Header({
  meta,
  onMenu,
  user,
}: {
  meta: { title: string; desc: string }
  onMenu: () => void
  user: { displayName: string; role: string | null }
}) {
  const roleLabels: Record<string, string> = {
    owner: 'مالك المتجر',
    admin: 'مسؤول',
    manager: 'مدير',
    cashier: 'كاشير',
    stock_manager: 'مدير المخزون',
    viewer: 'مشاهد',
  }

  const displayName = user.displayName?.trim() || 'مستخدم'

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--surface)]/95 px-3 py-3 backdrop-blur-md sm:px-5 md:px-8 md:py-4">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="فتح القائمة"
            onClick={onMenu}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--surface-secondary)] active:bg-[var(--brand-soft)] lg:hidden"
          >
            <Menu size={21} />
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-[var(--foreground)] sm:text-lg md:text-xl">
              {meta.title}
            </h1>
            {meta.desc && (
              <p className="mt-1 hidden truncate text-xs text-[var(--muted)] sm:block">
                {meta.desc}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="hidden sm:block">
            <ThemeToggle />
          </div>

          <button
            type="button"
            disabled
            title="البحث غير متاح حاليًا"
            aria-label="البحث غير متاح حاليًا"
            className="hidden size-10 cursor-not-allowed items-center justify-center rounded-xl border border-[var(--line)] text-[var(--muted)] sm:flex"
          >
            <Search size={19} />
          </button>

          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--brand-soft)] text-sm font-bold text-[var(--brand)]">
              {displayName.charAt(0)}
            </div>
            <div className="hidden min-w-0 text-right md:block">
              <p className="max-w-36 truncate text-xs font-bold text-[var(--foreground)]">
                {displayName}
              </p>
              <p className="mt-1 text-[10px] text-[var(--muted)]">
                {roleLabels[user.role || ''] || 'مستخدم'}
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-[var(--line)]" />
          <div className="shrink-0">
            <LogoutButton compact />
          </div>
        </div>
      </div>

      <div className="mt-3 flex justify-end sm:hidden">
        <ThemeToggle />
      </div>
    </header>
  )
}

function Dashboard() {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-8 text-center shadow-[var(--shadow-card)]">
      <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <LayoutDashboard size={27} />
      </div>
      <h2 className="mt-4 text-xl font-extrabold text-[var(--foreground)]">
        لوحة التحكم جاهزة
      </h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-[var(--muted)]">
        ستظهر هنا إحصائيات متجرك وتقارير المبيعات والمخزون عند توفر بيانات فعلية.
        لن نعرض أرقامًا تجريبية على أنها بيانات حقيقية.
      </p>
    </div>
  )
}

function DataTable({
  headers,
  rows,
}: {
  headers: string[]
  rows: string[][]
}) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[650px] text-right text-sm">
        <thead>
          <tr className="border-b border-[var(--line)] text-xs text-[var(--muted)]">
            {headers.map((header) => (
              <th key={header} className="px-3 py-3 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={index}
              className="border-b border-[var(--line)] last:border-0 hover:bg-[var(--surface-secondary)]"
            >
              {row.map((value, columnIndex) => (
                <td key={columnIndex} className="px-3 py-4 font-semibold text-[var(--foreground)]">
                  {columnIndex === row.length - 1 ? (
                    <Badge
                      tone={
                        value === 'نفد' || value === 'مسترجعة'
                          ? 'red'
                          : value === 'منخفض'
                            ? 'orange'
                            : 'green'
                      }
                    >
                      {value}
                    </Badge>
                  ) : (
                    value
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function GenericPage({ type }: { type: string }) {
  const meta = pageMeta[type]
  const isProducts = type === 'products'
  const isInventory = type === 'inventory'
  const isSales = type === 'sales'
  const [query, setQuery] = useState('')
  const [showForm, setShowForm] = useState(false)

  let rows = isProducts
    ? products
    : isSales
      ? sales
      : managementRows[type] || managementRows.stores

  if (isInventory) {
    rows = products.map((product) => [
      product[0],
      product[1],
      product[2],
      product[4],
    ])
  }

  const visibleRows = rows.filter((row) =>
    row.join(' ').includes(query),
  )

  return (
    <>
      <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-[var(--muted)]">إدارة وتنظيم</p>
          <h2 className="mt-1 text-2xl font-extrabold text-[var(--foreground)]">
            {meta.title}
          </h2>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-bold text-white transition hover:bg-[var(--brand-hover)]"
        >
          <Plus size={18} />
          إضافة جديد
        </button>
      </div>

      <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-sm text-[var(--muted)] sm:w-72">
            <Search size={18} />
            <input
              aria-label={`ابحث في ${meta.title}`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`ابحث في ${meta.title}...`}
              className="w-full bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
            />
          </label>

          <button className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-semibold text-[var(--muted)]">
            <Filter size={16} />
            تصفية
            <span className="text-[var(--line)]">|</span>
            <Download size={16} />
          </button>
        </div>

        <DataTable
          headers={
            isProducts
              ? ['اسم المنتج', 'التصنيف', 'المخزون', 'السعر', 'الحالة']
              : isSales
                ? ['رقم الفاتورة', 'العميل', 'التاريخ', 'المبلغ', 'الحالة']
                : ['الاسم', 'التفاصيل', 'الحالة', 'آخر تحديث']
          }
          rows={visibleRows}
        />
      </section>

      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-[var(--foreground)]">
                  إضافة {meta.title}
                </h3>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  هذه البيانات تجريبية ومحفوظة محلياً فقط
                </p>
              </div>
              <button
                aria-label="إغلاق"
                onClick={() => setShowForm(false)}
                className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-secondary)]"
              >
                <X />
              </button>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm font-bold text-[var(--foreground)]">
                الاسم
                <input
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 outline-none focus:border-[var(--brand)]"
                  placeholder="أدخل الاسم"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm font-bold text-[var(--foreground)]">
                التفاصيل
                <input
                  className="rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-3 outline-none focus:border-[var(--brand)]"
                  placeholder="أدخل التفاصيل"
                />
              </label>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl border border-[var(--line)] py-3 text-sm font-bold text-[var(--muted)]"
              >
                إلغاء
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-xl bg-[var(--brand)] py-3 text-sm font-bold text-white"
              >
                حفظ البيانات
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function LegacyPosPage() {
  const [cart, setCart] = useState<string[]>([])

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm text-[var(--muted)]">الفرع الرئيسي</p>
          <h2 className="mt-1 text-2xl font-extrabold text-[var(--foreground)]">
            نقطة البيع
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-[var(--brand-soft)] px-3 py-2 text-xs font-bold text-[var(--brand)]">
          <ScanLine size={17} />
          ماسح الباركود جاهز
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <div className="flex gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-3 text-sm text-[var(--muted)]">
              <Search size={18} />
              <span>ابحث عن منتج أو امسح الباركود...</span>
            </div>
            <button className="rounded-xl bg-[var(--brand-soft)] px-4 text-[var(--brand)]">
              <ScanLine />
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product, index) => (
              <button
                onClick={() => setCart((current) => [...current, product[0]])}
                key={product[0]}
                className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-right transition hover:border-[var(--brand)] hover:bg-[var(--surface-secondary)]"
              >
                <div className="flex aspect-[1.5] items-center justify-center rounded-lg bg-[var(--surface-secondary)] text-3xl text-[var(--brand)]">
                  {['ق', 'ف', 'ح', 'ج'][index]}
                </div>
                <p className="mt-3 text-xs font-bold text-[var(--foreground)]">
                  {product[0]}
                </p>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-[var(--brand)]">{product[3]}</span>
                  <span className="text-[10px] text-[var(--muted)]">
                    متوفر {product[2]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-5">
          <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
            <h3 className="font-extrabold text-[var(--foreground)]">الفاتورة الحالية</h3>
            <span className="text-xs text-[var(--muted)]">{cart.length} منتجات</span>
          </div>

          <div className="flex min-h-48 flex-col gap-3 py-4">
            {cart.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center text-[var(--muted)]">
                <ShoppingCart className="mb-3" />
                <p className="text-sm">أضف المنتجات إلى الفاتورة</p>
                <p className="mt-1 text-xs">سيظهر ملخص الطلب هنا</p>
              </div>
            ) : (
              cart.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="flex items-center justify-between rounded-xl bg-[var(--surface-secondary)] px-3 py-3 text-sm"
                >
                  <span className="font-bold text-[var(--foreground)]">{item}</span>
                  <button
                    onClick={() =>
                      setCart((current) => current.filter((_, i) => i !== index))
                    }
                    className="text-xs font-bold text-[var(--danger)]"
                  >
                    حذف
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-[var(--line)] pt-4">
            <div className="flex justify-between text-sm text-[var(--muted)]">
              <span>المجموع الفرعي</span>
              <b>٠ ج.م</b>
            </div>
            <div className="mt-2 flex justify-between text-sm text-[var(--muted)]">
              <span>الضريبة (١٥٪)</span>
              <b>٠ ج.م</b>
            </div>
            <div className="mt-4 flex justify-between text-xl font-extrabold text-[var(--foreground)]">
              <span>الإجمالي</span>
              <span className="text-[var(--brand)]">٠ ج.م</span>
            </div>
            <button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] py-3 font-bold text-white">
              <CreditCard />
              إتمام الدفع
            </button>
          </div>
        </section>
      </div>
    </>
  )
}

export default function DokkanApp({
  type,
  user,
  content,
}: {
  type: string
  user: {
    displayName: string
    role: string | null
    storeName: string | null
  }
  content?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const meta = pageMeta[type] || pageMeta.dashboard

  // إبقاء تعريف عناصر التنقل القديم دون تغيير بقية بيانات التطبيق.
  const mobileNav = [nav[0], nav[1], nav[3], nav[6]]
  void mobileNav

  return (
    <div className="flex min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <DokkanSidebar user={user} />

      <div
        className={`${open ? 'block' : 'hidden'} fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] lg:hidden`}
        onClick={() => setOpen(false)}
      />

      {open && (
        <DokkanSidebar
          mobile
          onClose={() => setOpen(false)}
          user={user}
        />
      )}

      <div className="min-w-0 flex-1">
        <Header
          meta={meta}
          onMenu={() => setOpen(true)}
          user={user}
        />

        <main className="mx-auto max-w-[1600px] p-4 pb-24 md:p-8">
          {content ?? (
            type === 'dashboard' ? (
              <Dashboard />
            ) : type === 'pos' ? (
              <LegacyPosPage />
            ) : [
              'purchases',
              'customers',
              'suppliers',
              'sales',
              'employees',
              'stores',
              'reports',
              'transfers',
              'returns',
              'audit-log',
            ].includes(type) ? (
              <WorkflowPage type={type} />
            ) : (
              <ManagementPage type={type} />
            )
          )}
        </main>

        <MobileBottomNav />
      </div>
    </div>
  )
}
