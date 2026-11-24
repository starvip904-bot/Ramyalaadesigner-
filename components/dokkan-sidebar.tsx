
'use client'

import { useState } from 'react'
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

type DokkanSidebarProps = {
  mobile?: boolean
  onClose?: () => void
  user: {
    storeName: string | null
  }
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

  function toggleGroup(title: string) {
    setCollapsedGroups((current) => ({
      ...current,
      [title]: !current[title],
    }))
  }

  return (
    <aside
      className={`${
        mobile
          ? 'fixed inset-y-0 right-0 z-50 w-[min(20rem,85vw)] shadow-2xl'
          : 'hidden w-72 shrink-0 border-l border-[var(--line)] lg:block'
      } bg-[var(--sidebar)] text-[var(--foreground)]`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-5 sm:px-6">
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

        <div className="mx-4 mt-5 rounded-2xl border border-[var(--line)] bg-[var(--surface-secondary)] px-3 py-3">
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

        <nav
          aria-label="القائمة الرئيسية"
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-5 sm:px-4"
        >
          {navGroups.map((group) => {
            const isCollapsed = Boolean(collapsedGroups[group.title])

            return (
              <section key={group.title}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  aria-expanded={!isCollapsed}
                  className="mb-2 flex w-full items-center justify-between rounded-lg px-3 py-2 text-right transition hover:bg-[var(--surface-secondary)]"
                >
                  <span className="text-xs font-extrabold tracking-wide text-[var(--muted)]">
                    {group.title}
                  </span>

                  {isCollapsed ? (
                    <ChevronLeft
                      size={16}
                      className="text-[var(--muted)]"
                    />
                  ) : (
                    <ChevronDown
                      size={16}
                      className="text-[var(--muted)]"
                    />
                  )}
                </button>

                {!isCollapsed && (
                  <div className="space-y-1">
                    {group.items.map(({ label, href, icon: Icon }) => {
                      const active =
                        pathname === href ||
                        pathname.startsWith(`${href}/`)

                      return (
                        <Link
                          key={href}
                          href={href}
                          onClick={onClose}
                          aria-current={active ? 'page' : undefined}
                          className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                            active
                              ? 'bg-[var(--brand-soft)] text-[var(--brand)]'
                              : 'text-[var(--muted-strong)] hover:bg-[var(--surface-secondary)] hover:text-[var(--brand)]'
                          }`}
                        >
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

        <div className="border-t border-[var(--line)] p-4">
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
