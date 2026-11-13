
import { PlanGrid, SubscriptionHero } from '@/components/subscription-plans'

export const metadata = {
  title: 'الخطط والاشتراكات | DOKKAN',
  description: 'تعرف على خطط اشتراك DOKKAN.',
}

export default function PricingPage() {
  return (
    <main
      className="min-h-screen bg-[#f7f9fc] px-4 py-6 text-slate-950 md:px-8 md:py-10"
      dir="rtl"
    >
      <div className="mx-auto flex max-w-[1500px] flex-col gap-8">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-sm font-extrabold tracking-wide text-blue-700">
              DOKKAN
            </p>
            <p className="mt-1 text-xs text-slate-500">
              حلول ذكية لإدارة متجرك
            </p>
          </div>

          <a
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-blue-200 hover:bg-blue-50"
          >
            العودة للوحة التحكم
          </a>
        </header>

        <SubscriptionHero
          eyebrow="خطط اشتراك DOKKAN"
          title="ابدأ مجانًا وطوّر متجرك وقتما تحتاج"
          description="ابدأ بالخطة المجانية الدائمة دون رسوم اشتراك. وعندما تحتاج إلى إمكانيات إضافية، ستتمكن من الترقية إلى إحدى الخطط المدفوعة بعد إتاحتها رسميًا."
        />

        <section>
          <div className="mb-5">
            <h2 className="text-xl font-extrabold">
              خطط DOKKAN
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              الخطة المجانية متاحة. أما الخطط المدفوعة فما زالت
              قيد التجهيز، وسيتم الإعلان عن أسعارها وحدودها
              ومميزاتها بعد اعتمادها.
            </p>
          </div>

          <PlanGrid currentPlan="" />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-extrabold text-slate-900">
            كيف تعمل الاشتراكات؟
          </h2>

          <ul className="mt-3 flex flex-col gap-3 text-sm leading-7 text-slate-600">
            <li>
              • كل متجر جديد يبدأ بالخطة المجانية عند إنشاء المتجر.
            </li>
            <li>
              • الخطة المجانية دائمة ولا تحتاج إلى تجديد أو دفع.
            </li>
            <li>
              • الترقية إلى خطة مدفوعة ستكون اختيارية.
            </li>
            <li>
              • لن يتم تفعيل أي اشتراك مدفوع إلا بعد تأكيد الدفع
              والتحقق منه بشكل آمن.
            </li>
          </ul>
        </section>

        <p className="text-center text-xs text-slate-400">
          تفاصيل الخطط المدفوعة ووسائل الدفع سيتم الإعلان عنها
          عند اكتمال التجهيز.
        </p>
      </div>
    </main>
  )
}
