
import {
  Activity,
  Building2,
  CalendarDays,
  CreditCard,
  Download,
  ShieldCheck,
  Store,
  Users,
  Wallet,
} from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import PlatformPlanSettingsEditor from '@/components/platform-plan-settings-editor'
import PlatformOwnerGrantButton from '@/components/platform-owner-grant-button'
import {
  PLAN_DEFINITIONS,
  PLAN_CODES,
  type PlanCode,
} from '@/lib/subscription-plans'
import { requirePlatformOwner } from '@/lib/tenant-context'

type PlatformStore = {
  id: string
  name: string
  subscription_status: string | null
  plan_code: string | null
  member_count: number
  created_at: string
}

function formatNumber(value: unknown) {
  const number = Number(value)

  return Number.isFinite(number)
    ? number.toLocaleString('ar-EG')
    : '—'
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'غير متاح'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return 'غير متاح'

  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function getPlanName(code: string | null) {
  if (!code) return 'غير محددة'

  const normalizedCode = code.toLowerCase()

  if (PLAN_CODES.includes(normalizedCode as PlanCode)) {
    return PLAN_DEFINITIONS[normalizedCode as PlanCode].name
  }

  return 'خطة قديمة تحتاج إلى مراجعة'
}

function getStatusLabel(status: string | null) {
  switch (status) {
    case 'active':
      return 'نشط'
    case 'pending':
      return 'قيد المراجعة'
    case 'expired':
      return 'منتهي'
    case 'cancelled':
      return 'ملغي'
    case 'paused':
      return 'متوقف مؤقتًا'
    case 'suspended':
      return 'موقوف'
    default:
      return status || 'بدون اشتراك'
  }
}

function getStatusStyle(status: string | null) {
  switch (status) {
    case 'active':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
    case 'pending':
      return 'bg-amber-50 text-amber-700 ring-amber-200'
    case 'expired':
    case 'cancelled':
    case 'paused':
    case 'suspended':
      return 'bg-rose-50 text-rose-700 ring-rose-200'
    default:
      return 'bg-slate-100 text-slate-600 ring-slate-200'
  }
}

export default async function PlatformPage() {
  const { supabase, user } = await requirePlatformOwner().catch(() =>
    redirect('/dashboard')
  )

  const [overviewResult, storesResult] = await Promise.all([
    supabase.rpc('dokkan_platform_overview'),
    supabase.rpc('dokkan_platform_stores'),
  ])

  const overviewError = overviewResult.error
  const storesError = storesResult.error

  const overview = (overviewResult.data ?? {}) as Record<
    string,
    unknown
  >

  const platformStores = (storesResult.data ?? []) as PlatformStore[]

  const statCards = [
    {
      label: 'إجمالي المتاجر',
      value: formatNumber(overview.stores),
      icon: Building2,
      description: 'عدد المتاجر المسجلة بالمنصة',
      iconStyle: 'bg-blue-50 text-blue-700',
    },
    {
      label: 'المستخدمون',
      value: formatNumber(overview.users),
      icon: Users,
      description: 'حسابات المستخدمين',
      iconStyle: 'bg-violet-50 text-violet-700',
    },
    {
      label: 'العضويات',
      value: formatNumber(overview.memberships),
      icon: Store,
      description: 'عضويات المتاجر المسجلة',
      iconStyle: 'bg-cyan-50 text-cyan-700',
    },
    {
      label: 'الاشتراكات النشطة',
      value: formatNumber(overview.active_subscriptions),
      icon: Activity,
      description: 'حسب حالة الاشتراك المسجلة',
      iconStyle: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: 'الإيرادات الفعلية',
      value: 'غير متاحة',
      icon: Wallet,
      description: 'لم يتم ربط تقارير الإيرادات الفعلية بعد',
      iconStyle: 'bg-amber-50 text-amber-700',
    },
  ]

  return (
    <main
      className="min-h-screen bg-[#f5f7fb] p-4 text-slate-950 md:p-8"
      dir="rtl"
    >
      <div className="mx-auto flex max-w-[1500px] flex-col gap-7">

        <header className="overflow-hidden rounded-[1.75rem] bg-slate-950 p-6 text-white shadow-lg md:p-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-blue-300">
                <ShieldCheck size={19} />
                DOKKAN PLATFORM
              </div>

              <h1 className="mt-4 text-2xl font-extrabold md:text-3xl">
                لوحة مدير المنصة
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-300">
                متابعة المتاجر والمستخدمين والاشتراكات وإعدادات الخطط
                من مكان واحد. هذه اللوحة مخصصة لمالك منصة دكان.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-300 md:self-center">
              <ShieldCheck size={16} />
              صلاحية مدير المنصة مفعّلة
            </div>
          </div>
        </header>

        {/* تفعيل حساب مدير المنصة الجديد */}
        {user.id === 'e6e59e14-a3f0-4ec2-80aa-94035993461d' &&
          user.email?.toLowerCase() === 'kamelalaa480@gmail.com' && (
            <section className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
              <h2 className="font-extrabold text-slate-900">
                إدارة حساب مدير المنصة
              </h2>

              <p className="my-3 text-sm leading-6 text-slate-600">
                تفعيل حساب مدير المنصة الجديد:
                maxbin060@gmail.com
              </p>

              <PlatformOwnerGrantButton />
            </section>
          )}

        {/* ملخص المنصة */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-extrabold">
              ملخص المنصة
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              نظرة عامة على بيانات المنصة الحالية.
            </p>
          </div>

          {overviewError && (
            <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800">
              تعذر تحميل بعض إحصائيات المنصة. يمكنك مراجعة قائمة المتاجر
              أدناه، وقد تظهر بعض الأرقام كغير متاحة.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {statCards.map((stat) => {
              const Icon = stat.icon

              return (
                <article
                  key={stat.label}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-bold text-slate-600">
                      {stat.label}
                    </p>

                    <span
                      className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${stat.iconStyle}`}
                    >
                      <Icon size={20} />
                    </span>
                  </div>

                  <p className="mt-5 text-2xl font-extrabold tracking-tight">
                    {stat.value}
                  </p>

                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {stat.description}
                  </p>
                </article>
              )
            })}
          </div>
        </section>

        {/* إعدادات الخطط والأسعار */}
        <PlatformPlanSettingsEditor />

        {/* المتاجر والاشتراكات */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col justify-between gap-4 border-b border-slate-100 p-5 md:flex-row md:items-center md:p-6">
            <div>
              <h2 className="text-xl font-extrabold">
                المتاجر والاشتراكات
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                متابعة بيانات المتاجر وحالة اشتراكاتها.
              </p>
            </div>

            <button
              type="button"
              disabled
              title="التصدير غير متاح في هذه المرحلة"
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-400"
            >
              <Download size={17} />
              التصدير قريبًا
            </button>
          </div>

          {storesError ? (
            <div className="p-8 text-center">
              <p className="font-bold text-rose-700">
                تعذر تحميل قائمة المتاجر.
              </p>

              <p className="mt-2 text-sm text-slate-500">
                يرجى مراجعة اتصال قاعدة البيانات وصلاحيات الوصول.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3 text-xs font-bold text-slate-500">
                <Store size={15} />
                عدد المتاجر المعروضة: {formatNumber(platformStores.length)}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-right text-sm">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-4 font-bold">اسم المتجر</th>
                      <th className="p-4 font-bold">حالة الاشتراك</th>
                      <th className="p-4 font-bold">الخطة</th>
                      <th className="p-4 font-bold">الأعضاء</th>
                      <th className="p-4 font-bold">تاريخ الإنشاء</th>
                      <th className="p-4 font-bold">التفاصيل</th>
                    </tr>
                  </thead>

                  <tbody>
                    {platformStores.map((store) => (
                      <tr
                        key={store.id}
                        className="border-t border-slate-100 transition hover:bg-slate-50"
                      >
                        <td className="p-4 font-extrabold text-slate-800">
                          {store.name || 'متجر بدون اسم'}
                        </td>

                        <td className="p-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-inset ${getStatusStyle(
                              store.subscription_status
                            )}`}
                          >
                            {getStatusLabel(store.subscription_status)}
                          </span>
                        </td>

                        <td className="p-4 font-bold text-blue-700">
                          {getPlanName(store.plan_code)}
                        </td>

                        <td className="p-4 font-semibold">
                          {formatNumber(store.member_count)}
                        </td>

                        <td className="p-4 text-slate-500">
                          <span className="inline-flex items-center gap-2">
                            <CalendarDays size={15} />
                            {formatDate(store.created_at)}
                          </span>
                        </td>

                        <td className="p-4">
                          <Link
                            href={`/platform/stores/${store.id}`}
                            className="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
                          >
                            عرض التفاصيل
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {platformStores.length === 0 && (
                  <div className="p-10 text-center">
                    <Building2
                      size={32}
                      className="mx-auto text-slate-300"
                    />

                    <p className="mt-3 font-bold text-slate-600">
                      لا توجد متاجر مسجلة للعرض.
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        {/* أدوات إدارة المنصة */}
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-extrabold">
              أدوات إدارة المنصة
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              أقسام إدارة المنصة.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Store size={20} />
              </span>

              <h3 className="mt-4 font-extrabold">
                إدارة المتاجر
              </h3>

              <p className="mt-2 text-xs leading-6 text-slate-500">
                عرض تفاصيل كل متجر ومتابعة حالته.
              </p>

              <span className="mt-4 inline-block rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">
                قيد التطوير
              </span>
            </article>

            <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Users size={20} />
              </span>

              <h3 className="mt-4 font-extrabold">
                إدارة المشتركين
              </h3>

              <p className="mt-2 text-xs leading-6 text-slate-500">
                متابعة حسابات وعضويات المستخدمين.
              </p>

              <span className="mt-4 inline-block rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">
                قيد التطوير
              </span>
            </article>

            <Link
              href="/platform/subscription-requests"
              className="rounded-2xl border border-blue-200 bg-white p-5 transition hover:border-blue-400 hover:bg-blue-50"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <CreditCard size={20} />
              </span>

              <h3 className="mt-4 font-extrabold">
                طلبات الاشتراك وإثباتات الدفع
              </h3>

              <p className="mt-2 text-xs leading-6 text-slate-500">
                مراجعة صور التحويلات واعتماد الاشتراكات أو رفضها.
              </p>

              <span className="mt-4 inline-block rounded-full bg-blue-50 px-3 py-1.5 text-[10px] font-bold text-blue-700">
                فتح إدارة الطلبات
              </span>
            </Link>

            <article className="rounded-2xl border border-dashed border-slate-300 bg-white p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <Wallet size={20} />
              </span>

              <h3 className="mt-4 font-extrabold">
                التقارير المالية
              </h3>

              <p className="mt-2 text-xs leading-6 text-slate-500">
                متابعة المدفوعات والإيرادات بعد تفعيلها.
              </p>

              <span className="mt-4 inline-block rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold text-amber-700">
                قيد التطوير
              </span>
            </article>
          </div>
        </section>

        <footer className="rounded-xl border border-slate-200 bg-white p-4 text-center text-xs leading-6 text-slate-500">
          لوحة مدير منصة DOKKAN — تعديل الخطط والأسعار متاح من إعدادات
          الخطط، بينما بعض وظائف إدارة المتاجر والتقارير المالية
          ما زالت قيد التطوير.
        </footer>

      </div>
    </main>
  )
}
