
import { PlanGrid, SubscriptionHero } from '@/components/subscription-plans'

export const metadata = {
  title: 'الخطط والأسعار | DOKKAN',
  description:
    'قارن خطط اشتراك DOKKAN وأسعارها ومميزاتها واختر الأنسب لمتجرك.',
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
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50"
          >
            العودة للوحة التحكم
          </a>
        </header>

        <SubscriptionHero
          eyebrow="DOKKAN SUBSCRIPTIONS"
          title="الخطة المناسبة لنمو متجرك تبدأ من هنا"
          description="ابدأ بالخطة المجانية مدى الحياة، أو اختر إحدى الخطط المدفوعة للحصول على إمكانيات وحدود أكبر. قارن الأسعار والمميزات واختر دورة الاشتراك المناسبة لنشاطك."
        />

        <section id="plans" className="flex flex-col gap-5">
          <div>
            <h2 className="text-2xl font-extrabold">
              خطط الاشتراك والأسعار
            </h2>

            <p className="mt-2 text-sm leading-7 text-slate-500">
              جميع الأسعار بالجنيه المصري. يمكنك الاختيار بين الاشتراك
              الشهري والسنوي، مع توفير عند اختيار الاشتراك السنوي.
            </p>
          </div>

          <PlanGrid currentPlan="" />
        </section>

        <section className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
          <h2 className="text-lg font-extrabold text-blue-950">
            طريقة الاشتراك والتفعيل
          </h2>

          <p className="mt-2 text-sm leading-7 text-blue-900">
            نظام الاشتراكات في Dokkan يعتمد حاليًا على مراجعة الإدارة
            لإثبات الدفع قبل تفعيل أي خطة مدفوعة.
          </p>

          <ol className="mt-4 flex flex-col gap-3 text-sm leading-7 text-blue-950">
            <li>
              <strong>1.</strong> اختر الخطة ودورة الاشتراك المناسبة.
            </li>

            <li>
              <strong>2.</strong> انتقل إلى صفحة الاشتراك وقدم طلبك.
            </li>

            <li>
              <strong>3.</strong> أرفق إثبات الدفع والمبلغ المدفوع.
            </li>

            <li>
              <strong>4.</strong> تراجع الإدارة الطلب وتتحقق من الدفع.
            </li>

            <li>
              <strong>5.</strong> بعد الموافقة يتم تفعيل الاشتراك وتسجيل العملية.
            </li>
          </ol>

          <p className="mt-4 rounded-xl bg-white/70 p-4 text-xs leading-6 text-blue-900">
            إرسال طلب الاشتراك لا يعني تفعيله تلقائيًا.
            لن يتم تفعيل أي خطة مدفوعة قبل مراجعة الإدارة والموافقة عليها.
          </p>

          <a
            href="/subscription"
            className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
          >
            الانتقال إلى صفحة اشتراكي
          </a>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-extrabold text-slate-900">
            معلومات مهمة عن الخطة المجانية
          </h2>

          <ul className="mt-4 flex flex-col gap-3 text-sm leading-7 text-slate-600">
            <li>
              • الخطة المجانية متاحة مدى الحياة دون رسوم اشتراك.
            </li>

            <li>
              • تشمل متجرًا واحدًا وفرعًا واحدًا ومستخدم دخول واحدًا.
            </li>

            <li>
              • تسمح بإضافة حتى 50 منتجًا نشطًا.
            </li>

            <li>
              • مساحة التخزين الأساسية 1GB.
            </li>

            <li>
              • لا تشمل المميزات الإدارية المتقدمة.
            </li>

            <li>
              • تجربة نقاط البيع والمميزات الاحترافية متاحة لمدة 7 أيام
              وفق شروط التجربة.
            </li>
          </ul>
        </section>

        <footer className="border-t border-slate-200 pt-6 text-center">
          <p className="text-xs leading-6 text-slate-400">
            DOKKAN - إدارة متجرك بذكاء.
            جميع الأسعار بالجنيه المصري، وتخضع طلبات الاشتراك
            المدفوعة لمراجعة الإدارة قبل التفعيل.
          </p>
        </footer>

      </div>
    </main>
  )
}
