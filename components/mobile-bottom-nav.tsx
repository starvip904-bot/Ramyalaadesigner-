
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ReceiptText,
  Store,
  UserCog,
  ClipboardList,
  ArrowLeftRight,
  RotateCcw,
  Users,
  Truck,
  WalletCards,
  BarChart3,
  CreditCard,
  Sparkles,
  Settings,
  MoreHorizontal,
  X,
  ChevronLeft,
} from 'lucide-react'

const ORDER_STORAGE_KEY = 'dokkan-sidebar-group-order'

const primaryItems = [
  { label: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard },
  { label: 'المخزون', href: '/inventory', icon: Package },
  { label: 'نقطة البيع', href: '/pos', icon: ShoppingCart },
  { label: 'المبيعات', href: '/sales', icon: ReceiptText },
]

const menuGroups = [
  {
    title: 'الإدارة الأساسية',
    items: [
      { label: 'المتاجر والفروع', href: '/stores', icon: Store },
      { label: 'الموظفون والصلاحيات', href: '/employees', icon: UserCog },
    ],
  },
  {
    title: 'المنتجات والمخزون',
    items: [
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
      { label: 'المرتجعات والاستبدال', href: '/returns', icon: RotateCcw },
      { label: 'العملاء', href: '/customers', icon: Users },
    ],
  },
  {
    title: 'المشتريات والمالية',
    items: [
      { label: 'الموردون', href: '/suppliers', icon: Truck },
      {
        label: 'المشتريات ومدفوعات الموردين',
        href: '/purchases',
        icon: Truck,
      },
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
      {
        label: 'إعدادات المتجر والفواتير',
        href: '/settings',
        icon: Settings,
      },
    ],
  },
]

type MenuGroup = (typeof menuGroups)[number]

function getSavedGroupOrder(): MenuGroup[] {
  try {
    const saved = localStorage.getItem(ORDER_STORAGE_KEY)

    if (!saved) return menuGroups

    const titles = JSON.parse(saved)

    if (!Array.isArray(titles)) return menuGroups

    const ordered = titles
      .filter((title): title is string => typeof title === 'string')
      .map((title) => menuGroups.find((group) => group.title === title))
      .filter((group): group is MenuGroup => Boolean(group))

    const missing = menuGroups.filter(
      (group) => !ordered.some((item) => item.title === group.title)
    )

    return [...ordered, ...missing]
  } catch {
    return menuGroups
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

export default function MobileBottomNav() {
  const pathname = usePathname()

  const [showMore, setShowMore] = useState(false)
  const [orderedGroups, setOrderedGroups] = useState<MenuGroup[]>(menuGroups)

  useEffect(() => {
    setOrderedGroups(getSavedGroupOrder())
  }, [])

  // إغلاق قائمة المزيد تلقائيًا عند الانتقال إلى صفحة أخرى.
  useEffect(() => {
    setShowMore(false)
  }, [pathname])

  // إتاحة إغلاق القائمة بزر Escape.
  useEffect(() => {
    if (!showMore) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowMore(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showMore])

  const moreActive = orderedGroups.some((group) =>
    group.items.some((item) => isActivePath(pathname, item.href))
  )

  return (
    <>
      {showMore && (
        <>
          <button
            type="button"
            aria-label="إغلاق قائمة المزيد"
            onClick={() => setShowMore(false)}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
          />

          <section
            id="dokkan-mobile-more-menu"
            aria-label="باقي أقسام دكان"
            aria-modal="true"
            className="fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 max-h-[70dvh] overflow-y-auto rounded-t-3xl border border-[var(--line)] bg-[var(--surface)] px-4 pb-5 pt-4 shadow-2xl lg:hidden"
          >
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[var(--line)]" />

            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-[var(--foreground)]">
                  المزيد من الأقسام
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  كل أدوات إدارة متجرك في مكان واحد
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowMore(false)}
                aria-label="إغلاق"
                className="flex size-9 items-center justify-center rounded-xl border border-[var(--line)] text-[var(--muted)] transition hover:bg-[var(--surface-secondary)]"
              >
                <X size={19} />
              </button>
            </div>

            <div className="space-y-5">
              {orderedGroups.map((group) => (
                <section key={group.title}>
                  <h3 className="mb-2 px-1 text-xs font-extrabold text-[var(--muted)]">
                    {group.title}
                  </h3>

                  <div className="grid grid-cols-2 gap-2">
                    {group.items.map(({ label, href, icon: Icon }) => {
                      const active = isActivePath(pathname, href)

                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={() => setShowMore(false)}
                          aria-current={active ? 'page' : undefined}
                          className={`flex min-h-16 min-w-0 items-center gap-2 rounded-xl border p-3 transition ${
                            active
                              ? 'border-[var(--brand)] bg-[var(--brand-soft)] text-[var(--brand)]'
                              : 'border-[var(--line)] bg-[var(--card)] text-[var(--foreground)] hover:border-[var(--brand)]'
                          }`}
                        >
                          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-soft)] text-[var(--brand)]">
                            <Icon size={18} />
                          </span>

                          <span className="min-w-0 flex-1">
                            <span className="block text-xs font-bold leading-5">
                              {label}
                            </span>
                          </span>

                          <ChevronLeft
                            size={15}
                            className="shrink-0 text-[var(--muted)]"
                          />
                        </Link>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
          </section>
        </>
      )}

      <nav
        aria-label="التنقل الرئيسي للموبايل"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[var(--surface)]/95 px-1 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-6px_24px_rgba(20,43,69,0.06)] backdrop-blur-xl lg:hidden"
      >
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-1">
          {primaryItems.map(({ label, href, icon: Icon }) => {
            const active = isActivePath(pathname, href)

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition ${
                  active
                    ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                    : 'text-[var(--muted)] hover:bg-[var(--surface-secondary)]'
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                <span className="max-w-full truncate text-[10px] font-bold">
                  {label}
                </span>
              </Link>
            )
          })}

          <button
            type="button"
            onClick={() => setShowMore((value) => !value)}
            aria-expanded={showMore}
            aria-controls="dokkan-mobile-more-menu"
            className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 transition ${
              showMore || moreActive
                ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                : 'text-[var(--muted)] hover:bg-[var(--surface-secondary)]'
            }`}
          >
            {showMore ? <X size={20} /> : <MoreHorizontal size={20} />}
            <span className="text-[10px] font-bold">
              المزيد
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
