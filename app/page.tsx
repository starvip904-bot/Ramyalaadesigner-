
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
    icon: Boxes,
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
      "نعم، تتوفر خطة Free بمتجر واحد وفرع نشط واحد ومستخدم دخول واحد، وحتى 50 منتجًا نشطًا ومساحة تخزين 1GB. نقطة البيع POS متاحة كتجربة لمدة 7 أيام.",
  },
  {
    question: "هل يمكنني الترقية إلى خطة مدفوعة؟",
    answer:
      "يمكنك الاطلاع على الخطط والأسعار المتاحة من صفحة الخطط والاشتراكات. تفعيل الاشتراكات المدفوعة يتم بعد مراجعة الإدارة واعتماد الطلب.",
  },
  {
    question: "هل يعمل Dokkan على الموبايل؟",
    answer:
      "نعم، يمكنك استخدام Dokkan من متصفح الموبايل والتابلت والكمبيوتر، مع واجهة تتكيف مع حجم الشاشة.",
  },
  {
    question: "هل يمكنني إدارة أكثر من فرع؟",
    answer:
      "تسمح الخطة المجانية بفرع نشط واحد، ويمكنك مراجعة حدود الفروع في الخطط الأخرى من صفحة الخطط والاشتراكات.",
  },
  {
    question: "هل بيانات متجري منفصلة عن المتاجر الأخرى؟",
    answer:
      "تم تصميم النظام لعزل بيانات المتاجر وتحديد الوصول إليها وفق حسابات المستخدمين وصلاحياتهم.",
  },
];

const dashboardItems = [
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
];

const steps = [
  {
    number: "01",
    icon: Users,
    title: "أنشئ حسابك",
    description: "سجّل حسابك وفعّل بريدك الإلكتروني.",
  },
  {
    number: "02",
    icon: Store,
    title: "جهّز متجرك",
    description: "أدخل اسم المتجر والبيانات الأساسية.",
  },
  {
    number: "03",
    icon: Smartphone,
    title: "ابدأ الإدارة",
    description: "تابع منتجاتك ومخزونك وعملياتك من أجهزتك.",
  },
];

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-3">
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--brand)] text-xl font-extrabold text-white shadow-lg shadow-[var(--brand)]/20">
        د
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className={`text-xl font-extrabold ${
            light ? "text-white" : "text-[var(--foreground)]"
          }`}
        >
          دكان
        </span>
        <span
          className={`mt-1 text-[9px] font-extrabold tracking-[0.28em] ${
            light ? "text-white/55" : "text-[var(--muted)]"
          }`}
        >
          DOKKAN
        </span>
      </span>
    </Link>
  );
}

export default function HomePage() {
  return (
    <main
      dir="rtl"
      className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]"
    >
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[var(--line)] bg-[var(--surface)]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Brand />

          <nav className="hidden items-center gap-7 text-sm font-bold text-[var(--muted)] lg:flex">
            <a href="#features" className="transition hover:text-[var(--brand)]">
              المميزات
            </a>
            <a href="#how" className="transition hover:text-[var(--brand)]">
              كيف يعمل
            </a>
            <a href="#pricing" className="transition hover:text-[var(--brand)]">
              الخطط
            </a>
            <a href="#faq" className="transition hover:text-[var(--brand)]">
              الأسئلة الشائعة
            </a>
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2.5 text-sm font-extrabold text-[var(--foreground)] transition hover:bg-[var(--card-muted)] sm:block"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-[var(--brand)]/15 transition hover:bg-[var(--brand-hover)]"
            >
              ابدأ مجانًا
              <ArrowLeft size={16} />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate">
        <div className="absolute inset-0 -z-10 bg-gradient-to-bl from-[var(--brand-soft)] via-[var(--background)] to-[var(--surface)]" />
        <div className="pointer-events-none absolute -left-32 top-10 -z-10 h-80 w-80 rounded-full bg-[var(--brand)]/10 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-0 -z-10 h-80 w-80 rounded-full bg-[var(--brand)]/10 blur-3xl" />

        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:px-8">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--brand)]/20 bg-[var(--surface)] px-4 py-2 text-sm font-extrabold text-[var(--brand)] shadow-sm">
              <Zap size={16} />
              إدارة تجارتك أصبحت أسهل
            </div>

            <h1 className="text-4xl font-extrabold leading-[1.45] tracking-tight text-[var(--foreground)] sm:text-5xl lg:text-6xl">
              كل تجارتك في مكان واحد مع{" "}
              <span className="text-[var(--brand)]">دكان</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-9 text-[var(--muted)] sm:text-lg">
              نظام عربي لإدارة المتاجر والمبيعات والمخزون والعملاء والفروع.
              نظّم عملياتك وتابع نشاط تجارتك من أي مكان، سواء كان نشاطك متجرًا
              صغيرًا أو تجارة متعددة الفروع.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-up"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand)] px-7 py-4 font-extrabold text-white shadow-xl shadow-[var(--brand)]/20 transition hover:-translate-y-1 hover:bg-[var(--brand-hover)]"
              >
                ابدأ مجانًا الآن
                <ArrowLeft size={19} />
              </Link>
              <a
                href="#features"
                className="inline-flex items-center justify-center rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-7 py-4 font-bold text-[var(--foreground)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
              >
                اكتشف المميزات
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-[var(--muted)]">
              <span className="flex items-center gap-2">
                <Check size={17} className="text-[var(--success)]" />
                خطة مجانية
              </span>
              <span className="flex items-center gap-2">
                <Check size={17} className="text-[var(--success)]" />
                يعمل على الموبايل
              </span>
              <span className="flex items-center gap-2">
                <Check size={17} className="text-[var(--success)]" />
                إدارة منظمة
              </span>
            </div>
          </div>

          {/* Dashboard preview */}
          <div className="relative mx-auto w-full max-w-xl">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-[var(--brand)]/15 blur-3xl" />

            <div className="relative rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] sm:p-7">
              <div className="flex items-center justify-between border-b border-[var(--line)] pb-5">
                <div>
                  <p className="text-xs font-bold text-[var(--muted)]">
                    DOKKAN
                  </p>
                  <h3 className="mt-1 text-xl font-extrabold text-[var(--foreground)]">
                    إدارة متجرك بذكاء
                  </h3>
                </div>
                <span className="rounded-2xl bg-[var(--brand-soft)] p-3 text-[var(--brand)]">
                  <Store size={25} />
                </span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                {dashboardItems.map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-[var(--line)] bg-[var(--card-muted)] p-4 transition hover:border-[var(--brand)]/40"
                  >
                    <span className="mb-3 inline-flex rounded-xl bg-[var(--brand-soft)] p-2 text-[var(--brand)]">
                      <item.icon size={20} />
                    </span>
                    <p className="font-extrabold text-[var(--foreground)]">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs leading-6 text-[var(--muted)]">
                      {item.description}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[var(--brand)]/15 bg-[var(--brand-soft)] p-4">
                <span className="rounded-xl bg-[var(--surface)] p-2 text-[var(--brand)]">
                  <ShieldCheck size={21} />
                </span>
                <div>
                  <p className="text-sm font-extrabold text-[var(--foreground)]">
                    بيانات متجرك في مكان واحد
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    متابعة أسهل وتنظيم أفضل لعملياتك
                  </p>
                </div>
              </div>

              <p className="mt-3 text-center text-xs text-[var(--muted)]">
                توضيح بصري لأقسام النظام، وليس بيانات متجر فعلية
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section
        id="features"
        className="scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-extrabold text-[var(--brand)]">
              كل ما تحتاجه تجارتك
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-[var(--foreground)] sm:text-4xl">
              أدوات لإدارة شغلك بسهولة
            </h2>
            <p className="mt-4 leading-8 text-[var(--muted)]">
              اجمع عمليات متجرك الأساسية في منصة واحدة بدلًا من استخدام أنظمة
              متفرقة.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition hover:-translate-y-1 hover:border-[var(--brand)]/40"
              >
                <span className="inline-flex rounded-2xl bg-[var(--brand-soft)] p-3 text-[var(--brand)] transition group-hover:bg-[var(--brand)] group-hover:text-white">
                  <feature.icon size={24} />
                </span>
                <h3 className="mt-5 text-lg font-extrabold text-[var(--foreground)]">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section
        id="how"
        className="scroll-mt-24 border-y border-[var(--line)] bg-[var(--surface-secondary)] px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <span className="text-sm font-extrabold text-[var(--brand)]">
              ابدأ في دقائق
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-[var(--foreground)] sm:text-4xl">
              ثلاث خطوات لتنظيم تجارتك
            </h2>
            <p className="mt-4 leading-8 text-[var(--muted)]">
              أنشئ حسابك، جهّز متجرك، وابدأ إدارة عملياتك.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.number}
                className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-7 text-center shadow-[var(--shadow-card)]"
              >
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <step.icon size={29} />
                </span>
                <p className="mt-5 text-sm font-extrabold text-[var(--brand)]">
                  الخطوة {step.number}
                </p>
                <h3 className="mt-2 text-xl font-extrabold text-[var(--foreground)]">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-5xl">
          <div className="rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-7 shadow-[var(--shadow-card)] sm:p-12">
            <div className="mx-auto max-w-2xl text-center">
              <span className="text-sm font-extrabold text-[var(--brand)]">
                خطط Dokkan
              </span>
              <h2 className="mt-3 text-3xl font-extrabold text-[var(--foreground)] sm:text-4xl">
                الخطة المناسبة لاحتياجات تجارتك
              </h2>
              <p className="mt-4 leading-8 text-[var(--muted)]">
                ابدأ بالخطة المجانية، واستكشف الخطط الأخرى وأسعارها وحدودها
                وتفاصيل الاشتراك من صفحة الخطط الرسمية.
              </p>
            </div>

            <div className="mt-9 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--brand)]/30 bg-[var(--brand-soft)] p-6">
                <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-3 py-1 text-xs font-extrabold text-[var(--brand)]">
                  <Check size={14} />
                  ابدأ الآن
                </span>
                <h3 className="mt-4 text-2xl font-extrabold text-[var(--foreground)]">
                  Free
                </h3>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  خطة مجانية بحدود واضحة تساعدك على بدء إدارة متجرك.
                </p>
                <Link
                  href="/sign-up"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 font-extrabold text-white transition hover:bg-[var(--brand-hover)]"
                >
                  أنشئ حسابك مجانًا
                  <ArrowLeft size={17} />
                </Link>
              </div>

              <div className="rounded-2xl border border-[var(--line)] bg-[var(--card-muted)] p-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1 text-xs font-extrabold text-[var(--muted)]">
                  <LockKeyhole size={14} />
                  تفاصيل الخطط
                </span>
                <h3 className="mt-4 text-2xl font-extrabold text-[var(--foreground)]">
                  كل الخطط والإضافات
                </h3>
                <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
                  اعرف الأسعار ودورات الاشتراك والحدود والإضافات المتاحة من
                  الكتالوج الرسمي.
                </p>
                <Link
                  href="/pricing"
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 font-extrabold text-[var(--foreground)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
                >
                  عرض الخطط والأسعار
                  <ArrowLeft size={17} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Call to action */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[var(--navy)] px-6 py-14 text-center text-white sm:px-12">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full border-[45px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-36 -right-20 h-80 w-80 rounded-full bg-[var(--brand)]/20 blur-2xl" />

          <div className="relative z-10">
            <span className="inline-flex rounded-2xl bg-white/10 p-3 text-[var(--brand)]">
              <Zap size={25} />
            </span>
            <h2 className="mt-5 text-3xl font-extrabold sm:text-4xl">
              جاهز تبدأ تنظيم تجارتك؟
            </h2>
            <p className="mx-auto mt-4 max-w-2xl leading-8 text-white/70">
              ابدأ بخطة Dokkan المجانية، ونظّم متجرك وعملياتك خطوة بخطوة.
            </p>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-7 py-4 font-extrabold text-white transition hover:bg-[var(--brand-hover)]"
            >
              أنشئ حسابك مجانًا
              <ArrowLeft size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section
        id="faq"
        className="scroll-mt-24 border-t border-[var(--line)] bg-[var(--surface-secondary)] px-4 py-20 sm:px-6 lg:px-8"
      >
        <div className="mx-auto max-w-3xl">
          <div className="text-center">
            <span className="text-sm font-extrabold text-[var(--brand)]">
              هل لديك سؤال؟
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-[var(--foreground)]">
              الأسئلة الشائعة
            </h2>
          </div>

          <div className="mt-10 space-y-3">
            {faqs.map((faq) => (
              <details
                key={faq.question}
                className="group rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-extrabold text-[var(--foreground)]">
                  {faq.question}
                  <ChevronDown
                    size={19}
                    className="shrink-0 text-[var(--brand)] transition group-open:rotate-180"
                  />
                </summary>
                <p className="mt-4 border-t border-[var(--line)] pt-4 text-sm leading-8 text-[var(--muted)]">
                  {faq.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[var(--navy)] px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2">
          <div>
            <Brand light />
            <p className="mt-5 max-w-md text-sm leading-8 text-white/65">
              منصة عربية لإدارة المتاجر والفروع والمبيعات والمخزون، تساعدك على
              تنظيم تجارتك ومتابعتها من مكان واحد.
            </p>
          </div>

          <div className="flex flex-wrap content-start gap-x-7 gap-y-4 text-sm font-bold text-white/70 md:justify-end">
            <a href="#features" className="transition hover:text-white">
              المميزات
            </a>
            <a href="#pricing" className="transition hover:text-white">
              الخطط
            </a>
            <a href="#faq" className="transition hover:text-white">
              الأسئلة الشائعة
            </a>
            <Link href="/pricing" className="transition hover:text-white">
              الأسعار
            </Link>
            <Link href="/login" className="transition hover:text-white">
              تسجيل الدخول
            </Link>
            <Link href="/sign-up" className="transition hover:text-white">
              إنشاء حساب
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-7xl border-t border-white/10 pt-6 text-center text-xs text-white/45">
          © {new Date().getFullYear()} DOKKAN. جميع الحقوق محفوظة.
        </div>
      </footer>
    </main>
  );
}
