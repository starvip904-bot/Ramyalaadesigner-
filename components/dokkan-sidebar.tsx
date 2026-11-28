
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Store,
  Package,
  ShoppingCart,
  ReceiptText,
  Truck,
  Users,
  WalletCards,
  BarChart3,
  UserCog,
  CreditCard,
  ArrowLeftRight,
  RotateCcw,
  ClipboardList,
  Sparkles,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react'

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
      { label: 'المنتجات والمخزون', href: '/inventory', icon: Package },
      { label: 'الجرد', href: '/inventory-counts', icon: ClipboardList },
      {
        label: 'التحويلات بين الفروع',
        href: '/transfers',
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    title: 'المبيعات والعملاء',
    items: [
      { label: 'نقطة البيع POS', href: '/pos', icon: ShoppingCart },
      { label: 'المبيعات والفواتير', href: '/sales', icon: ReceiptText },
      {
        label: 'المرتجعات والاستبدال',
        href: '/returns',
        icon: RotateCcw,
      },
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

const ORDER_STORAGE_KEY = 'dokkan-sidebar-group-order'

type NavGroup = (typeof navGroups)[number]

type DokkanSidebarProps = {
  mobile?: boolean
  onClose?: () => void
  user: {
    storeName: string | null
  }
}

function getSavedGroupOrder(): NavGroup[] {
  try {
    const saved = localStorage.getItem(ORDER_STORAGE_KEY)

    if (!saved) return navGroups

    const titles = JSON.parse(saved)

    if (!Array.isArray(titles)) return navGroups

    const ordered = titles
      .filter((title): title is string => typeof title === 'string')
      .map((title) => navGroups.find((group) => group.title === title))
      .filter((group): group is NavGroup => Boolean(group))

    const missing = navGroups.filter(
      (group) => !ordered.some((item) => item.title === group.title)
    )

    return [...ordered, ...missing]
  } catch {
    return navGroups
  }
}

function isActivePath(pathname: string, href: string) {
  if (href === '/inventory') {
    return (
      pathname === '/inventory' ||
      pathname === '/products' ||
      pathname.startsWith('/inventory/') ||
      pathname.startsWith('/products/')
    )
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function DokkanSidebar({
  mobile = false,
  onClose,
  user,
}: DokkanSidebarProps) {
  const pathname = usePathname()

  const [collapsedGroups, setCollapsedGroups] = useState<
    Record<string, boolean>
  >({})

  const [orderedGroups, setOrderedGroups] = useState<NavGroup[]>(navGroups)

  useEffect(() => {
    setOrderedGroups(getSavedGroupOrder())
  }, [])

  function toggleGroup(title: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [title]: !current[title],
    }))
  }

  function moveGroup(index: number, direction: -1 | 1) {
    const targetIndex = index + direction

    if (targetIndex < 0 || targetIndex >= orderedGroups.length) return

    const next = [...orderedGroups]
    const currentGroup = next[index]

    next[index] = next[targetIndex]
    next[targetIndex] = currentGroup

    setOrderedGroups(next)

    try {
      localStorage.setItem(
        ORDER_STORAGE_KEY,
        JSON.stringify(next.map((group) => group.title))
      )
    } catch {
      // يظل الترتيب فعالًا في الصفحة الحالية إذا تعذر حفظه.
    }
  }

  return (
    <aside
      className={`${
        mobile
          ? 'fixed inset-y-0 right-0 z-50 w-[min(20rem,85vw)] shadow-2xl'
          : 'sticky top-0 hidden h-screen w-72 shrink-0 border-l border-[var(--line)] lg:block'
      } bg-[var(--sidebar)] text-[var(--foreground)]`}
    >
      <div className="flex h-full min-h-0 flex-col">
        {/* Brand */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-5 py-5 sm:px-6">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--navy)] text-xl font-extrabold text-white shadow-sm">
              د
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xl font-extrabold tracking-tight text-[var(--navy)]">
                  دكان
                </span>
                <span className="text-sm font-bold text-[var(--brand)]">
                  Dokkan
                </span>
              </div>
              <p className="text-xs text-[var(--muted)]">
                إدارة متجرك بذكاء
              </p>
            </div>
          </Link>

          {mobile && (
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق القائمة"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[var(--muted)] transition hover:bg-[var(--surface-secondary)]"
            >
              <X size={21} />
            </button>
          )}
        </div>

        {/* Current store */}
        <div className="mx-4 mt-5 shrink-0 rounded-2xl border border-[var(--line)] bg-[var(--surface-secondary)] px-3 py-3">
          <p className="text-xs text-[var(--muted)]">
            المتجر الحالي
          </p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-bold text-[var(--foreground)]">
              {user.storeName || 'لم يتم تحديد متجر'}
            </span>
            <ChevronLeft
              size={18}
              className="shrink-0 text-[var(--muted)]"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav
          aria-label="القائمة الرئيسية"
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-5 sm:px-4"
        >
          {orderedGroups.map((group, index) => {
            const isCollapsed = Boolean(collapsedGroups[group.title])

            return (
              <section key={group.title}>
                <div className="mb-2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.title)}
                    aria-expanded={!isCollapsed}
                    className="flex min-h-10 min-w-0 flex-1 items-center justify-between rounded-lg px-3 py-2 text-right transition hover:bg-[var(--surface-secondary)]"
                  >
                    <span className="truncate text-xs font-extrabold tracking-wide text-[var(--muted)]">
                      {group.title}
                    </span>

                    {isCollapsed ? (
                      <ChevronLeft
                        size={16}
                        className="shrink-0 text-[var(--muted)]"
                      />
                    ) : (
                      <ChevronDown
                        size={16}
                        className="shrink-0 text-[var(--muted)]"
                      />
                    )}
                  </button>

                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveGroup(index, -1)}
                      disabled={index === 0}
                      aria-label={`نقل ${group.title} لأعلى`}
                      title="تحريك لأعلى"
                      className="flex size-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-25"
                    >
                      <ChevronUp size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => moveGroup(index, 1)}
                      disabled={index === orderedGroups.length - 1}
                      aria-label={`نقل ${group.title} لأسفل`}
                      title="تحريك لأسفل"
                      className="flex size-8 items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--brand-soft)] hover:text-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-25"
                    >
                      <ChevronDown size={16} />
                    </button>
                  </div>
                </div>

                {!isCollapsed && (
                  <div className="space-y-1">
                    {group.items.map(({ label, href, icon: Icon }) => {
                      const active = isActivePath(pathname, href)

                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={onClose}
                          aria-current={active ? 'page' : undefined}
                          className={`relative flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                            active
                              ? 'bg-[var(--brand-soft)] text-[var(--brand)] shadow-sm'
                              : 'text-[var(--muted-strong)] hover:bg-[var(--surface-secondary)] hover:text-[var(--brand)]'
                          }`}
                        >
                          {active && (
                            <span
                              aria-hidden="true"
                              className="absolute right-0 top-2 bottom-2 w-1 rounded-l-full bg-[var(--brand)]"
                            />
                          )}

                          <Icon
                            size={20}
                            strokeWidth={active ? 2.4 : 2}
                            className="shrink-0"
                          />

                          <span className="min-w-0 flex-1 leading-6">
                            {label}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </nav>

        {/* Subscription shortcut */}
        <div className="shrink-0 border-t border-[var(--line)] p-4">
          <Link
            href="/subscription"
            onClick={onClose}
            className="block rounded-2xl border border-[var(--line)] bg-[var(--surface-secondary)] p-3 transition hover:border-[var(--brand)] hover:bg-[var(--brand-soft)]"
          >
            <div className="flex items-center gap-2 text-[var(--brand)]">
              <CreditCard size={18} />
              <p className="text-sm font-bold">
                إدارة الاشتراك والخطة
              </p>
            </div>

            <p className="mt-2 text-xs text-[var(--muted)]">
              عرض تفاصيل خطتك واشتراكك
            </p>
          </Link>

          <div className="mt-3">
            <p className="px-1 text-center text-xs text-[var(--muted)]">
              دكان | Dokkan
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
