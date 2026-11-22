
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  LockKeyhole,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Store,
  Users,
  Wallet,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: LayoutDashboardIcon,
    title: "لوحة تحكم موحدة",
    description: "تابع نشاط متجرك ومبيعاتك ومخزونك من مكان واحد.",
  },
  {
    icon: Package,
    title: "إدارة المنتجات والمخزون",
    description: "نظّم المنتجات والأسعار والأرصدة وحركات المخزون.",
  },
  {
    icon: ShoppingCart,
    title: "نقطة البيع POS",
    description: "سجّل عمليات البيع وتابع الفواتير والمدفوعات.",
  },
  {
    icon: Building2,
    title: "إدارة الفروع",
    description: "تابع فروع متجرك ونظّم العمليات حسب كل فرع.",
  },
  {
    icon: Users,
    title: "العملاء والموردون",
    description: "احتفظ ببيانات العملاء والموردين وتابع تعاملاتك.",
  },
  {
    icon: BarChart3,
    title: "التقارير والتحليلات",
    description: "تابع أداء تجارتك من خلال بيانات وتقارير منظمة.",
  },
  {
    icon: ShieldCheck,
    title: "الموظفون والصلاحيات",
    description: "نظّم حسابات المستخدمين وصلاحيات الوصول.",
  },
  {
    icon: Receipt,
    title: "المشتريات والمصروفات",
    description: "تابع المشتريات والمصروفات والعمليات المالية.",
  },
];

const faqs = [
  {
    question: "هل أستطيع استخدام Dokkan مجانًا؟",
    answer:
      "نعم، تتوفر خطة Free مجانية مدى الحياة، وتشمل متجرًا واحدًا وفرعًا واحدًا وحسابي دخول كحد أقصى.",
  },
  {
    question: "هل يمكنني الترقية إلى خطة مدفوعة؟",
    answer:
      "نعم، الخطط المدفوعة Basic وProfessional وEnterprise قيد التجهيز حاليًا، وسيتم الإعلان عن تفاصيلها عند اعتمادها.",
  },
  {
    question: "هل يعمل Dokkan على الموبايل؟",
    answer:
      "نعم، يمكنك استخدام Dokkan من متصفح الموبايل والتابلت والكمبيوتر.",
  },
  {
    question: "هل يمكنني إدارة أكثر من فرع؟",
    answer:
      "تسمح خطة Free بفرع نشط واحد. حدود الخطط المدفوعة سيتم الإعلان عنها لاحقًا.",
  },
  {
    question: "هل بيانات متجري منفصلة عن المتاجر الأخرى؟",
    answer:
      "تم تصميم النظام لعزل بيانات المتاجر وتحديد الوصول إليها وفق حسابات المستخدمين وصلاحياتهم.",
  },
];

function LayoutDashboardIcon(props: React.ComponentProps<"svg">) {
  return <Boxes {...props} />;
}

export default function HomePage() {
  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-hidden bg-white text-slate-800"
    >
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white">
              <Store size={23} />
            </span>
            <span className="text-2xl font-extrabold tracking-tight text-slate-900">
              DOKKAN
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 lg:flex">
            <a href="#features" className="transition hover:text-blue-600">
              المميزات
            </a>
            <a href="#how" className="transition hover:text-blue-600">
              كيف يعمل
            </a>
            <a href="#pricing" className="transition hover:text-blue-600">
              الخطط
            </a>
            <a href="#faq" className="transition hover:text-blue-600">
              الأسئلة الشائعة
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 sm:block"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/sign-up"
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
            >
              ابدأ مجانًا
            </Link>
          </div>
        </div>
      </header>

      <section className="relative bg-gradient-to-bl from-blue-50 via-white to-indigo-50">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:px-8">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-bold text-blue-700 shadow-sm">
              <Zap size={16} />
              إدارة تجارتك أصبحت أسهل
            </div>

            <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              كل تجارتك في مكان واحد مع{" "}
              <span className="text-blue-600">Dokkan</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-9 text-slate-600 sm:text-lg">
              نظام عربي لإدارة المتاجر والمبيعات والمخزون والعملاء والفروع.
              نظّم عملياتك وتابع نشاط تجارتك من أي مكان.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-600 px-7 py-4 font-extrabold text-white shadow-xl shadow-blue-600/20 transition hover:-translate-y-1 hover:bg-blue-700"
              >
                ابدأ مجانًا الآن
                <ArrowLeft size={19} />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-7 py-4 font-bold text-slate-700 transition hover:border-blue-300 hover:text-blue-700"
              >
                اكتشف المميزات
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold text-slate-500">
              <span className="flex items-center gap-2">
                <Check size={17} className="text-emerald-600" />
                مجانية مدى الحياة
              </span>
              <span className="flex items-center gap-2">
                <Check size={17} className="text-emerald-600" />
                يعمل على الموبايل
              </span>
              <span className="flex items-center gap-2">
                <Check size={17} className="text-emerald-600" />
                إدارة منظمة
              </span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-blue-200/40 blur-3xl" />
            <div className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl shadow-blue-900/10 sm:p-7">
              <div className="flex items-center justify-between border-b border-slate-100 pb-5">
                <div>
                  <p className="text-xs font-semibold text-slate-400">
                    Dokkan
                  </p>
                  <h3 className="mt-1 text-xl font-extrabold text-slate-900">
                    إدارة متجرك بذكاء
                  </h3>
                </div>
                <span className="rounded-xl bg-blue-50 p-3 text-blue-600">
                  <Store size={24} />
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {[
                  {
                    label: "المبيعات",
                    icon: Wallet,
                    description: "تابع إجمالي مبيعاتك",
                  },
                  {
                    label: "الفواتير",
                    icon: ClipboardList,
                    description: "راجع عمليات البيع",
                  },
                  {
                    label: "المنتجات",
                    icon: Boxes,
                    description: "نظّم أصناف متجرك",
                  },
                  {
                    label: "المخزون",
                    icon: Package,
                    description: "تابع أرصدة الأصناف",
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4"
                  >
                    <span className="mb-3 inline-flex rounded-xl bg-blue-50 p-2 text-blue-600">
                      <item.icon size={20} />
                    </span>
                    <p className="font-extrabold text-slate-900">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-slate-500">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-blue-50 p-4">
                <span className="rounded-xl bg-white p-2 text-blue-600">
                  <ShieldCheck size={21} />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-slate-800">
                    بيانات متجرك في مكان واحد
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    متابعة أسهل وتنظيم أفضل لعملياتك
                  </p>
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-slate-400">
                توضيح بصري لأقسام النظام، وليس بيانات متجر فعلية
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-extrabold text-blue-600">
              كل ما تحتاجه تجارتك
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              أدوات لإدارة شغلك بسهولة
            </h2>
            <p className="mt-4 leading-8 text-slate-500">
              اجمع عمليات متجرك الأساسية في منصة واحدة بدلًا من استخدام أنظمة
              متفرقة.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl hover:shadow-blue-900/5"
              >
                <span className="inline-flex rounded-2xl bg-blue-50 p-3 text-blue-600 transition group-hover:bg-blue-600 group-hover:text-white">
                  <feature.icon size={24} />
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-slate-500">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="how"
        className="scroll-mt-24 bg-slate-50 px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-extrabold text-blue-600">
              ابدأ في دقائق
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              ثلاث خطوات لتنظيم تجارتك
            </h2>
            <p className="mt-4 leading-8 text-slate-500">
              أنشئ حسابك، جهّز متجرك، وابدأ إدارة عملياتك.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                number: "01",
                icon: Users,
                title: "أنشئ حسابك",
                desc: "سجّل حسابك وفعّل بريدك الإلكتروني.",
              },
              {
                number: "02",
                icon: Store,
                title: "جهّز متجرك",
                desc: "أدخل اسم المتجر والبيانات الأساسية.",
              },
              {
                number: "03",
                icon: Smartphone,
                title: "ابدأ الإدارة",
                desc: "تابع منتجاتك ومخزونك وعملياتك من أجهزتك.",
              },
            ].map((step) => (
              <div
                key={step.number}
                className="rounded-3xl border border-slate-200 bg-white p-7 text-center"
              >
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <step.icon size={29} />
                </span>
                <p className="mt-5 text-sm font-extrabold text-blue-600">
                  الخطوة {step.number}
                </p>
                <h3 className="mt-2 text-xl font-extrabold text-slate-900">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-slate-500">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        id="pricing"
        className="scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-extrabold text-blue-600">
              خطط Dokkan
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">
              ابدأ مجانًا وتوسّع وقت ما تحتاج
            </h2>
            <p className="mt-4 leading-8 text-slate-500">
              ابدأ بالخطة المجانية الدائمة، والخطط المدفوعة قيد التجهيز.
            </p>
          </div>

          <div className="mx-auto mt-12 grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative flex flex-col rounded-3xl border-2 border-blue-600 bg-blue-50/40 p-6 shadow-xl shadow-blue-900/5">
              <span className="absolute -top-3 right-6 rounded-full bg-blue-600 px-4 py-1 text-xs font-extrabold text-white">
                ابدأ الآن
              </span>
              <h3 className="text-xl font-extrabold text-slate-900">Free</h3>
              <p className="mt-2 text-sm text-slate-500">
                خطتك المجانية مدى الحياة
              </p>
              <p className="mt-6 text-3xl font-extrabold text-slate-900">
                مجانًا
              </p>
              <p className="mt-1 text-xs font-semibold text-emerald-700">
                بدون مدة انتهاء
              </p>
              <Link
                href="/sign-up"
                className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-extrabold text-white transition hover:bg-blue-700"
              >
                ابدأ مجانًا <ArrowLeft size={17} />
              </Link>
              <div className="my-6 border-t border-blue-100" />
              <p className="mb-4 text-sm font-extrabold text-slate-800">
                حدود الخطة
              </p>
              <ul className="space-y-3 text-sm leading-6 text-slate-600">
                {["متجر واحد", "فرع نشط واحد", "حسابا دخول كحد أقصى"].map(
                  (item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check
                        size={17}
                        className="mt-1 shrink-0 text-emerald-600"
                      />
                      {item}
                    </li>
                  )
                )}
              </ul>
            </div>

            {[
              {
                name: "Basic",
                description: "للأعمال التي تحتاج إلى إمكانيات إضافية.",
              },
              {
                name: "Professional",
                description: "للمتاجر التي تتوسع في عملياتها.",
              },
              {
                name: "Enterprise",
                description: "للأنشطة والمؤسسات الكبيرة.",
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className="flex flex-col rounded-3xl border border-slate-200 bg-white p-6"
              >
                <h3 className="text-xl font-extrabold text-slate-900">
                  {plan.name}
                </h3>
                <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">
                  {plan.description}
                </p>
                <p className="mt-6 text-2xl font-extrabold text-slate-700">
                  قريبًا
                </p>
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  التفاصيل قيد التجهيز
                </p>
                <div className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">
                  <LockKeyhole size={16} />
                  غير متاحة حاليًا
                </div>
                <div className="my-6 border-t border-slate-100" />
                <p className="text-sm leading-7 text-slate-500">
                  سيتم الإعلان عن الأسعار والحدود والمميزات بعد اعتمادها.
                </p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs leading-6 text-slate-400">
            لا يتم تفعيل أي خطة مدفوعة قبل الإعلان عن تفاصيلها وإتاحة الاشتراك
            رسميًا.
          </p>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-l from-blue-700 to-indigo-700 px-6 py-14 text-center text-white sm:px-12">
          <span className="inline-flex rounded-full bg-white/15 p-3">
            <Zap size={25} />
          </span>
          <h2 className="mt-5 text-3xl font-extrabold sm:text-4xl">
            جاهز تبدأ تنظيم تجارتك؟
          </h2>
          <p className="mx-auto mt-4 max-w-2xl leading-8 text-blue-100">
            ابدأ بخطة Dokkan المجانية، ونظّم متجرك وعملياتك خطوة بخطوة.
          </p>
          <Link
            href="/sign-up"
            className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-7 py-4 font-extrabold text-blue-700 transition hover:bg-blue-50"
          >
            أنشئ حسابك مجانًا <ArrowLeft size={18} />
          </Link>
        </div>
      </section>

      <section
        id="faq"
        className="scroll-mt-24 bg-slate-50 px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <span className="text-sm font-extrabold text-blue-600">
              هل لديك سؤال؟
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900">
              الأسئلة الشائعة
            </h2>
          </div>
          <div className="mt-10 space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-slate-200 bg-white p-5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-extrabold text-slate-800">
                  {faq.question}
                  <ChevronDown
                    size={19}
                    className="shrink-0 text-blue-600 transition group-open:rotate-180"
                  />
                </summary>
                <p className="mt-4 border-t border-slate-100 pt-4 text-sm leading-8 text-slate-500">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <footer className="bg-slate-950 px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2">
          <div>
            <Link href="/" className="inline-flex items-center gap-2">
              <span className="rounded-xl bg-blue-600 p-2">
                <Store size={21} />
              </span>
              <span className="text-2xl font-extrabold">DOKKAN</span>
            </Link>
            <p className="mt-4 max-w-md text-sm leading-8 text-slate-400">
              منصة عربية لإدارة المتاجر والفروع والمبيعات والمخزون، تساعدك على
              تنظيم تجارتك ومتابعتها من مكان واحد.
            </p>
          </div>
          <div className="flex flex-wrap content-start gap-x-7 gap-y-4 text-sm font-semibold text-slate-300 md:justify-end">
            <a href="#features" className="hover:text-white">
              المميزات
            </a>
            <a href="#pricing" className="hover:text-white">
              الخطط
            </a>
            <a href="#faq" className="hover:text-white">
              الأسئلة الشائعة
            </a>
            <Link href="/login" className="hover:text-white">
              تسجيل الدخول
            </Link>
            <Link href="/sign-up" className="hover:text-white">
              إنشاء حساب
            </Link>
          </div>
        </div>
        <div className="mx-auto mt-10 max-w-7xl border-t border-slate-800 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} DOKKAN. جميع الحقوق محفوظة.
        </div>
      </footer>
    </main>
  );
}
