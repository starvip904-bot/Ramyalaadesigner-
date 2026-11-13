
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
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
  CreditCard,
  ArrowLeftRight,
  RotateCcw,
  ClipboardList,
  Sparkles,
  ChevronLeft,
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
      { label: 'المنتجات والتصنيفات', href: '/products', icon: Package },
      { label: 'المخزون والجرد', href: '/inventory', icon: Boxes },
      {
        label: 'التحويلات بين الفروع',
        href: '/transfers',
        icon: ArrowLeftRight,
        comingSoon: true,
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
        comingSoon: true,
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

  return (
    <aside
      className={`${
        mobile
          ? 'fixed inset-y-0 right-0 z-50 w-[min(20rem,85vw)] shadow-2xl'
          : 'hidden w-72 shrink-0 border-l border-[#e2e8f0] lg:block'
      } bg-white`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-[#f0f1f3] px-5 py-5 sm:px-6">
          <Link
            href="/dashboard"
            onClick={onClose}
            className="flex min-w-0 items-center gap-3"
          >
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[#2563eb] text-xl font-extrabold text-white">
              د
            </div>

            <div className="min-w-0">
              <p className="text-xl font-extrabold tracking-tight text-[#2563eb]">
                دكان
              </p>
              <p className="text-xs text-[#94a3b8]">
                إدارة متجرك بذكاء
              </p>
            </div>
          </Link>

          {mobile && (
            <button
              type="button"
              onClick={onClose}
              aria-label="إغلاق القائمة"
              className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f1f5f9]"
            >
              <X size={21} />
            </button>
          )}
        </div>

        <div className="mx-4 mt-5 rounded-xl bg-[#f1f5f9] px-3 py-3">
          <p className="text-xs text-[#94a3b8]">المتجر الحالي</p>

          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm font-bold text-[#1e293b]">
              {user.storeName || 'لم يتم تحديد متجر'}
            </span>
            <ChevronLeft size={18} className="shrink-0 text-[#64748b]" />
          </div>
        </div>

        <nav
          aria-label="القائمة الرئيسية"
          className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-5 sm:px-4"
        >
          {navGroups.map((group) => (
            <section key={group.title}>
              <h2 className="mb-3 px-3 text-xs font-extrabold tracking-wide text-[#94a3b8]">
                {group.title}
              </h2>

              <div className="space-y-1">
                {group.items.map(
                  ({ label, href, icon: Icon, comingSoon }) => {
                    const active =
                      pathname === href || pathname.startsWith(`${href}/`)

                    return (
                      <Link
                        key={href}
                        href={href}
                        onClick={onClose}
                        className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                          active
                            ? 'bg-[#eaf2ff] text-[#2563eb]'
                            : 'text-[#475569] hover:bg-[#eff6ff] hover:text-[#2563eb]'
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

                        {comingSoon && (
                          <span className="shrink-0 rounded-full bg-[#fff2df] px-2 py-1 text-[10px] font-bold text-[#ae6a0b]">
                            قريبًا
                          </span>
                        )}
                      </Link>
                    )
                  }
                )}
              </div>
            </section>
          ))}
        </nav>

        <div className="border-t border-[#f0f1f3] p-4">
          <Link
            href="/subscription"
            onClick={onClose}
            className="block rounded-xl border border-[#e2e8f0] bg-[#f8fafc] p-3 transition hover:bg-[#eff6ff]"
          >
            <div className="flex items-center gap-2 text-[#2563eb]">
              <CreditCard size={18} />
              <p className="text-sm font-bold">
                إدارة الاشتراك والخطة
              </p>
            </div>

            <p className="mt-2 text-xs text-[#64748b]">
              عرض تفاصيل خطتك واشتراكك
            </p>
          </Link>

          <div className="mt-3">
            <p className="px-1 text-center text-xs text-[#94a3b8]">
              دكان — إدارة متجرك بذكاء
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
