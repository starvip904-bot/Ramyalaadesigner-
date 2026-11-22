
import {
  BarChart3,
  Boxes,
  CircleDollarSign,
  Package,
  ShoppingCart,
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

const money = (value: number) =>
  `${value.toLocaleString('ar-EG', {
    maximumFractionDigits: 2,
  })} ج.م`

const roleLabel: Record<string, string> = {
  owner: 'مالك المتجر',
  manager: 'مدير',
  cashier: 'كاشير',
  stock_manager: 'مدير المخزون',
}

function Stat({
  label,
  value,
  icon: Icon,
  empty,
}: {
  label: string
  value: string
  icon: typeof CircleDollarSign
  empty?: boolean
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-5">
      <div className="flex size-11 items-center justify-center rounded-xl bg-[#eaf2ff] text-[#2563eb]">
        <Icon size={22} />
      </div>

      <p className="mt-4 text-sm text-[#64748b]">{label}</p>

      <p className="mt-1 break-words text-xl font-extrabold tracking-tight text-[#0f172a] sm:text-2xl">
        {value}
      </p>

      {empty && (
        <p className="mt-1 text-xs text-[#94a3b8]">
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

  const maxDay = Math.max(
    ...data.salesByDay.map((day) => day.total),
    1
  )

  return (
    <div className="w-full min-w-0 space-y-5 sm:space-y-6">
      {/* عنوان لوحة التحكم */}
      <header className="min-w-0 space-y-2">
        <p className="text-sm text-[#64748b]">
          {data.displayName
            ? `مرحبًا، ${data.displayName}`
            : 'مرحبًا'}
        </p>

        <h2 className="break-words text-xl font-extrabold text-[#0f172a] sm:text-2xl">
          ملخص {data.storeName || 'المتجر'}
        </h2>

        <p className="text-xs leading-6 text-[#94a3b8] sm:text-sm">
          {data.role
            ? roleLabel[data.role] || data.role
            : 'لم يتم حفظ اسم الدور بعد'}
          {' · '}
          الأرقام من Supabase فقط
        </p>
      </header>

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
        <div className="min-w-0 rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-5">
          <div>
            <h3 className="font-extrabold text-[#0f172a]">
              المبيعات خلال آخر 7 أيام
            </h3>

            <p className="mt-1 text-xs leading-5 text-[#94a3b8]">
              من فواتير البيع المحفوظة فعليًا
            </p>
          </div>

          {emptySales ? (
            <div className="flex h-52 items-center justify-center text-center text-sm text-[#94a3b8]">
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
                        className="w-full max-w-10 rounded-t-lg bg-[#2563eb] transition-all duration-300"
                        style={{
                          height: `${percentage}%`,
                          minHeight: day.total > 0 ? '6px' : '0',
                        }}
                      />
                    </div>

                    <span className="max-w-full truncate text-[10px] text-[#94a3b8] sm:text-xs">
                      {day.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* الأكثر مبيعًا */}
        <div className="min-w-0 rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-5">
          <h3 className="font-extrabold text-[#0f172a]">
            الأكثر مبيعًا
          </h3>

          {data.topProducts.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-center text-sm text-[#94a3b8]">
              لا توجد مبيعات حتى الآن
            </div>
          ) : (
            <div className="mt-5 space-y-4">
              {data.topProducts.map((product, index) => (
                <div
                  key={`${product.name}-${index}`}
                  className="flex min-w-0 items-center justify-between gap-3 border-b border-[#f1f5f9] pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#2563eb]">
                      <Package size={18} />
                    </div>

                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold text-[#0f172a]">
                        {product.name}
                      </p>

                      <p className="mt-1 text-xs text-[#94a3b8]">
                        {product.quantity.toLocaleString('ar-EG')} قطعة
                      </p>
                    </div>
                  </div>

                  <span className="shrink-0 text-xs font-extrabold text-[#0f172a] sm:text-sm">
                    {money(product.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* تنبيه المخزون */}
      <section className="min-w-0 rounded-2xl border border-[#e2e8f0] bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-extrabold text-[#0f172a]">
              تنبيه المخزون
            </h3>

            <p className="mt-1 text-xs leading-5 text-[#94a3b8]">
              حسب أرصدة الفروع الحالية
            </p>
          </div>

          <span
            className={`shrink-0 rounded-full px-3 py-2 text-xs font-bold ${
              data.lowStockCount
                ? 'bg-[#fff2df] text-[#ae6a0b]'
                : 'bg-[#e4f4ef] text-[#2563eb]'
            }`}
          >
            {data.lowStockCount.toLocaleString('ar-EG')} أصناف
          </span>
        </div>

        {!data.lowStockCount && (
          <p className="mt-5 rounded-xl bg-[#f8fafc] p-4 text-sm text-[#94a3b8]">
            لا توجد أصناف منخفضة المخزون.
          </p>
        )}
      </section>
    </div>
  )
}
