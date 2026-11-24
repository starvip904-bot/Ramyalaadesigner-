
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  Package,
  ShoppingCart,
  ReceiptText,
  WalletCards,
  Users,
  Truck,
  Store,
  ClipboardList,
  Settings,
  SlidersHorizontal,
  Check,
  type LucideIcon,
} from 'lucide-react'

type DashboardData = {
  displayName: string | null
  role: string | null
  storeName: string | null
  salesTotal: number
  salesCount: number
  expensesTotal: number
  inventoryUnits: number
  lowStockCount: number
  salesByDay: Array<{ label: string; total: number }>
  topProducts: Array<{ name: string; quantity: number; total: number }>
}

type Shortcut = {
  id: string
  label: string
  href: string
  icon: LucideIcon
}

const shortcuts: Shortcut[] = [
  { id: 'pos', label: 'نقطة البيع', href: '/pos', icon: ShoppingCart },
  { id: 'products', label: 'المنتجات والمخزون', href: '/products', icon: Package },
  { id: 'sales', label: 'المبيعات والفواتير', href: '/sales', icon: ReceiptText },
  { id: 'inventory', label: 'الجرد', href: '/inventory-counts', icon: Boxes },
  { id: 'expenses', label: 'المصروفات', href: '/expenses', icon: WalletCards },
  { id: 'reports', label: 'التقارير', href: '/reports', icon: BarChart3 },
  { id: 'customers', label: 'العملاء', href: '/customers', icon: Users },
  { id: 'suppliers', label: 'الموردون', href: '/suppliers', icon: Truck },
  { id: 'stores', label: 'المتاجر والفروع', href: '/stores', icon: Store },
  { id: 'employees', label: 'الموظفون', href: '/employees', icon: Users },
  { id: 'audit', label: 'سجل العمليات', href: '/audit-log', icon: ClipboardList },
  { id: 'settings', label: 'الإعدادات', href: '/settings', icon: Settings },
]

const defaultShortcutIds = [
  'pos',
  'products',
  'sales',
  'inventory',
  'expenses',
  'reports',
]

const money = (value: number) =>
  `${value.toLocaleString('ar-EG', {
    maximumFractionDigits: 2,
  })} ج.م`

const roleLabel: Record<string, string> = {
  owner: 'مالك المتجر',
  admin: 'مدير المتجر',
  manager: 'مدير',
  cashier: 'كاشير',
  stock_manager: 'مدير المخزون',
  viewer: 'مشاهد',
}

function Stat({
  label,
  value,
  icon: Icon,
  empty,
}: {
  label: string
  value: string
  icon: LucideIcon
  empty?: boolean
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex size-11 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
        <Icon size={22} />
      </div>

      <p className="mt-4 text-sm text-[var(--muted)]">{label}</p>

      <p className="mt-1 break-words text-xl font-extrabold tracking-tight text-[var(--foreground)] sm:text-2xl">
        {value}
      </p>

      {empty && (
        <p className="mt-1 text-xs text-[var(--muted)]">
          لا توجد بيانات فعلية حتى الآن
        </p>
      )}
    </div>
  )
}

export default function DashboardPage({
  data,
}: {
  data: DashboardData
}) {
  const emptySales = data.salesCount === 0

  const [selectedShortcuts, setSelectedShortcuts] =
    useState<string[]>(defaultShortcutIds)

  const [showShortcutSettings, setShowShortcutSettings] =
    useState(false)

  const [preferencesReady, setPreferencesReady] = useState(false)

  const storageKey = [
    'dokkan-dashboard-shortcuts',
    data.storeName || 'store',
    data.displayName || 'user',
    data.role || 'member',
  ].join(':')

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)

      if (saved) {
        const parsed: unknown = JSON.parse(saved)

        if (Array.isArray(parsed)) {
          const validIds = parsed.filter(
            (id): id is string =>
              typeof id === 'string' &&
              shortcuts.some((shortcut) => shortcut.id === id)
          )

          setSelectedShortcuts(validIds)
        }
      }
    } catch {
      // استخدام الاختصارات الافتراضية إذا تعذر تحميل التفضيلات.
    }

    setPreferencesReady(true)
  }, [storageKey])

  useEffect(() => {
    if (!preferencesReady) return

    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify(selectedShortcuts)
      )
    } catch {
      // تظل الاختيارات الحالية ظاهرة حتى لو تعذر الحفظ.
    }
  }, [preferencesReady, selectedShortcuts, storageKey])

  const visibleShortcuts = shortcuts.filter((shortcut) =>
    selectedShortcuts.includes(shortcut.id)
  )

  const maxDay = Math.max(
    ...data.salesByDay.map((day) => day.total),
    1
  )

  function toggleShortcut(id: string) {
    setSelectedShortcuts((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    )
  }

  return (
    <div className="w-full min-w-0 space-y-5 sm:space-y-6">
      {/* عنوان لوحة التحكم */}
      <header className="min-w-0 space-y-2">
        <p className="text-sm text-[var(--muted)]">
          {data.displayName
            ? `مرحبًا، ${data.displayName}`
            : 'مرحبًا'}
        </p>

        <h2 className="break-words text-xl font-extrabold text-[var(--foreground)] sm:text-2xl">
          ملخص {data.storeName || 'المتجر'}
        </h2>

        <p className="text-xs leading-6 text-[var(--muted)] sm:text-sm">
          {data.role
            ? roleLabel[data.role] || data.role
            : 'مستخدم'}
          {' · '}
          الأرقام من بيانات المتجر الفعلية
        </p>
      </header>

      {/* الاختصارات السريعة */}
      <section className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold text-[var(--foreground)]">
              اختصارات سريعة
            </h3>
            <p className="mt-1 text-xs text-[var(--muted)]">
              اختر الأقسام التي تريد الوصول إليها بسرعة.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowShortcutSettings((value) => !value)}
            aria-expanded={showShortcutSettings}
            className="flex items-center gap-2 rounded-xl border border-[var(--line)] px-3 py-2 text-xs font-bold text-[var(--brand)] transition hover:bg-[var(--brand-soft)]"
          >
            <SlidersHorizontal size={16} />
            تخصيص الاختصارات
          </button>
        </div>

        {showShortcutSettings && (
          <div className="mt-4 rounded-xl border border-[var(--line)] bg-[var(--surface-secondary)] p-3">
            <p className="mb-3 text-xs font-bold text-[var(--foreground)]">
              حدد الاختصارات التي تريد ظهورها:
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {shortcuts.map((shortcut) => {
                const selected = selectedShortcuts.includes(shortcut.id)

                return (
                  <label
                    key={shortcut.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--line)] bg-[var(--card)] p-2 text-xs text-[var(--foreground)]"
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleShortcut(shortcut.id)}
                      className="size-4 accent-[var(--brand)]"
                    />
                    <span className="min-w-0 flex-1">
                      {shortcut.label}
                    </span>
                    {selected && (
                      <Check size={14} className="shrink-0 text-[var(--brand)]" />
                    )}
                  </label>
                )
              })}
            </div>
          </div>
        )}

        {visibleShortcuts.length > 0 ? (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {visibleShortcuts.map((shortcut) => {
              const Icon = shortcut.icon

              return (
                <Link
                  key={shortcut.id}
                  href={shortcut.href}
                  className="group flex min-h-24 min-w-0 flex-col justify-between rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)] sm:p-4"
                >
                  <span className="flex size-9 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)] transition group-hover:bg-[var(--brand)] group-hover:text-white">
                    <Icon size={19} />
                  </span>

                  <span className="mt-3 text-xs font-bold leading-5 text-[var(--foreground)]">
                    {shortcut.label}
                  </span>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-[var(--surface-secondary)] p-5 text-center text-sm text-[var(--muted)]">
            لم تختر أي اختصارات. استخدم زر التخصيص لإضافة الأقسام.
          </div>
        )}

        <p className="mt-3 text-[11px] text-[var(--muted)]">
          الاختصارات لا تمنح صلاحيات جديدة؛ كل قسم يظل خاضعًا لصلاحيات حسابك.
        </p>
      </section>

      {/* بطاقات الإحصائيات */}
      <section
        aria-label="إحصائيات المتجر"
        className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4"
      >
        <Stat
          label="إجمالي المبيعات"
          value={money(data.salesTotal)}
          icon={CircleDollarSign}
          empty={emptySales}
        />

        <Stat
          label="عدد الفواتير"
          value={data.salesCount.toLocaleString('ar-EG')}
          icon={ShoppingCart}
          empty={emptySales}
        />

        <Stat
          label="إجمالي المصروفات"
          value={money(data.expensesTotal)}
          icon={BarChart3}
          empty={data.expensesTotal === 0}
        />

        <Stat
          label="وحدات المخزون"
          value={data.inventoryUnits.toLocaleString('ar-EG')}
          icon={Boxes}
          empty={data.inventoryUnits === 0}
        />
      </section>

      {/* الرسم البياني والمنتجات الأكثر مبيعًا */}
      <section className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[1.45fr_1fr] xl:gap-6">
        {/* المبيعات خلال آخر 7 أيام */}
        <div className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
          <div>
            <h3 className="font-extrabold text-[var(--foreground)]">
              المبيعات خلال آخر 7 أيام
            </h3>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              من فواتير البيع المحفوظة فعليًا
            </p>
          </div>

          {emptySales ? (
            <div className="flex h-52 items-center justify-center text-center text-sm text-[var(--muted)]">
              لا توجد مبيعات حتى الآن
            </div>
          ) : (
            <div
              className="mt-6 flex h-52 min-w-0 items-end justify-between gap-2"
              role="img"
              aria-label="رسم بياني للمبيعات خلال آخر 7 أيام"
            >
              {data.salesByDay.map((day, index) => {
                const percentage =
                  day.total > 0
                    ? Math.max((day.total / maxDay) * 100, 5)
                    : 0

                return (
                  <div
                    key={`${day.label}-${index}`}
                    className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2"
                    title={`${day.label}: ${money(day.total)}`}
                  >
                    <div className="flex h-full w-full items-end justify-center">
                      <div
                        className="w-full max-w-10 rounded-t-lg bg-[var(--brand)] transition-all duration-300"
                        style={{
                          height: `${percentage}%`,
                          minHeight: day.total > 0 ? '6px' : '0',
                        }}
                      />
                    </div>

                    <span className="max-w-full truncate text-[10px] text-[var(--muted)] sm:text-xs">
                      {day.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* الأكثر مبيعًا */}
        <div className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
          <h3 className="font-extrabold text-[var(--foreground)]">
            الأكثر مبيعًا
          </h3>

          {data.topProducts.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-center text-sm text-[var(--muted)]">
              لا توجد مبيعات حتى الآن
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {data.topProducts.map((product, index) => (
                <div
                  key={`${product.name}-${index}`}
                  className="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--line)] pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-soft)] text-[var(--brand)]">
                      <Package size={18} />
                    </div>

                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold text-[var(--foreground)]">
                        {product.name}
                      </p>

                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {product.quantity.toLocaleString('ar-EG')} قطعة
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 text-xs font-extrabold text-[var(--foreground)] sm:text-sm">
                    {money(product.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* تنبيه المخزون */}
      <section className="min-w-0 rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-extrabold text-[var(--foreground)]">
              تنبيه المخزون
            </h3>

            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
              حسب أرصدة الفروع الحالية
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${
              data.lowStockCount
                ? 'bg-[var(--warning-soft)] text-[var(--warning)]'
                : 'bg-[var(--success-soft)] text-[var(--success)]'
            }`}
          >
            {data.lowStockCount.toLocaleString('ar-EG')} أصناف منخفضة
          </span>
        </div>

        {!data.lowStockCount && (
          <p className="mt-5 rounded-xl bg-[var(--surface-secondary)] p-4 text-sm text-[var(--muted)]">
            {data.inventoryUnits === 0
              ? 'لا توجد بيانات مخزون فعلية لعرض التنبيهات.'
              : 'لا توجد أصناف منخفضة المخزون.'}
          </p>
        )}
      </section>
    </div>
  )
}
