
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingCart,
  Smartphone,
  Store,
  Users,
  Wallet,
  Zap,
  TrendingUp,
  ChartNoAxesCombined,
  Menu,
} from "lucide-react";

const features = [
  {
    icon: Boxes,
    title: "إدارة المنتجات",
    description: "أضف منتجاتك ونظّم الأصناف والأسعار والباركود بسهولة.",
  },
  {
    icon: ShoppingCart,
    title: "نقطة البيع POS",
    description: "أنجز عمليات البيع وسجّل الفواتير والمدفوعات بسرعة.",
  },
  {
    icon: Package,
    title: "إدارة المخزون",
    description: "تابع أرصدة المنتجات وحركات المخزون والتحويلات.",
  },
  {
    icon: Building2,
    title: "إدارة الفروع",
    description: "تابع كل فرع ونظّم العمليات والصلاحيات حسب موقعه.",
  },
  {
    icon: Users,
    title: "العملاء والموردون",
    description: "احتفظ ببيانات التعاملات وتابع حسابات العملاء والموردين.",
  },
  {
    icon: BarChart3,
    title: "التقارير والتحليلات",
    description: "افهم أداء تجارتك من خلال تقارير واضحة ومنظمة.",
  },
  {
    icon: ShieldCheck,
    title: "الموظفون والصلاحيات",
    description: "حدّد أدوار الموظفين ونظّم صلاحيات الوصول.",
  },
  {
    icon: Receipt,
    title: "المشتريات والمصروفات",
    description: "تابع المشتريات والمصروفات وحركة الحسابات المالية.",
  },
];

const steps = [
  {
    number: "01",
    icon: Users,
    title: "أنشئ حسابك",
    description: "سجّل بياناتك وابدأ رحلتك مع دكان.",
  },
  {
    number: "02",
    icon: Store,
    title: "أنشئ متجرك",
    description: "أضف اسم متجرك وبياناته الأساسية.",
  },
  {
    number: "03",
    icon: Zap,
    title: "ابدأ إدارة تجارتك",
    description: "أضف المنتجات وتابع المبيعات والمخزون من مكان واحد.",
  },
];

const faqs = [
  {
    question: "هل يمكنني استخدام دكان مجانًا؟",
    answer:
      "نعم، تتوفر خطة مجانية بمتجر واحد وفرع نشط واحد ومستخدم دخول واحد، وحتى 50 منتجًا نشطًا ومساحة تخزين 1GB. نقطة البيع POS متاحة كتجربة لمدة 7 أيام.",
  },
  {
    question: "هل يناسب دكان أنواع التجارة المختلفة؟",
    answer:
      "نعم، دكان نظام عام لإدارة الأنشطة التجارية المختلفة، وليس مخصصًا لنوع واحد من المنتجات أو المتاجر.",
  },
  {
    question: "هل يمكنني إدارة أكثر من فرع؟",
    answer:
      "يمكنك مراجعة الخطط والاشتراكات لمعرفة حدود الفروع المتاحة والإضافات المناسبة لنشاطك.",
  },
  {
    question: "هل يعمل دكان على الهاتف؟",
    answer:
      "نعم، يمكنك استخدام دكان من الهاتف والتابلت والكمبيوتر، مع واجهة تتكيف مع حجم الشاشة.",
  },
  {
    question: "كيف يتم تفعيل الاشتراكات المدفوعة؟",
    answer:
      "يتم إرسال طلب الاشتراك وإثبات الدفع، ثم تراجع الإدارة الطلب وتعتمده قبل تفعيل الخطة المدفوعة.",
  },
];

function Brand({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="inline-flex items-center gap-3">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand)] text-2xl font-extrabold text-white shadow-lg shadow-[var(--brand)]/20">
        د
      </span>
      <span className="flex flex-col leading-tight">
        <span
          className={`text-2xl font-extrabold ${
            light ? "text-white" : "text-[var(--foreground)]"
          }`}
        >
          دكان
        </span>
        <span
          className={`mt-1 text-[9px] font-extrabold tracking-[0.3em] ${
            light ? "text-white/55" : "text-[var(--muted)]"
          }`}
        >
          DOKKAN
        </span>
      </span>
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-flex rounded-full border border-[var(--brand)]/20 bg-[var(--brand-soft)] px-4 py-2 text-sm font-extrabold text-[var(--brand)]">
        {eyebrow}
      </span>
      <h2 className="mt-5 text-3xl font-extrabold leading-relaxed text-[var(--foreground)] sm:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-base leading-8 text-[var(--muted)]">
        {description}
      </p>
    </div>
  );
}

function DashboardPreview() {
  const cards = [
    { label: "المبيعات", icon: Wallet, color: "text-[var(--brand)]" },
    { label: "الفواتير", icon: ClipboardList, color: "text-[var(--info)]" },
    { label: "المنتجات", icon: Boxes, color: "text-[var(--success)]" },
    { label: "المخزون", icon: Package, color: "text-[var(--warning)]" },
  ];

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-8 rounded-full bg-[var(--brand)]/10 blur-3xl" />

      <div className="relative rounded-[2rem] border border-[var(--line)] bg-[var(--surface)] p-4 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-5">
          <div>
            <p className="text-xs font-bold tracking-widest text-[var(--muted)]">
              DOKKAN DASHBOARD
            </p>
            <h3 className="mt-2 text-xl font-extrabold text-[var(--foreground)]">
              لوحة تحكم متجرك
            </h3>
          </div>
          <span className="rounded-2xl bg-[var(--brand-soft)] p-3 text-[var(--brand)]">
            <Store size={25} />
          </span>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          {cards.map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-[var(--line)] bg-[var(--card-muted)] p-4"
            >
              <span className={`inline-flex rounded-xl bg-[var(--surface)] p-2 ${card.color}`}>
                <card.icon size={21} />
              </span>
              <p className="mt-3 text-sm font-extrabold text-[var(--foreground)]">
                {card.label}
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                إدارة ومتابعة
              </p>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-[var(--foreground)]">
                متابعة نشاط تجارتك
              </p>
              <p className="mt-1 text-xs text-[var(--muted)]">
                نظرة منظمة على أقسام متجرك
              </p>
            </div>
            <span className="rounded-xl bg-[var(--success-soft)] p-2 text-[var(--success)]">
              <TrendingUp size={21} />
            </span>
          </div>

          <div className="mt-5 flex h-20 items-end gap-2">
            {[35, 55, 42, 72, 58, 88, 68, 96, 74, 85, 63, 100].map(
              (height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t-md bg-[var(--brand)]/70"
                  style={{ height: `${height}%` }}
                />
              )
            )}
          </div>
          <p className="mt-3 text-center text-[10px] text-[var(--muted)]">
            رسم توضيحي لشكل لوحة التحكم وليس بيانات مبيعات فعلية
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-[var(--brand-soft)] p-4">
          <span className="rounded-xl bg-[var(--surface)] p-2 text-[var(--brand)]">
            <ShieldCheck size={21} />
          </span>
          <div>
            <p className="text-sm font-extrabold text-[var(--foreground)]">
              تجارتك منظمة في مكان واحد
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              إدارة أسهل ومتابعة أوضح
            </p>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-3 hidden items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-xl sm:flex">
        <span className="rounded-xl bg-[var(--success-soft)] p-2 text-[var(--success)]">
          <ChartNoAxesCombined size={22} />
        </span>
        <div>
          <p className="text-xs font-extrabold text-[var(--foreground)]">
            رؤية أوضح لتجارتك
          </p>
          <p className="mt-1 text-[10px] text-[var(--muted)]">
            كل الأدوات في منصة واحدة
          </p>
        </div>
      </div>
    </div>
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

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-xl px-4 py-2.5 text-sm font-extrabold text-[var(--foreground)] transition hover:bg-[var(--card-muted)] sm:block"
            >
              تسجيل الدخول
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand)] px-4 py-3 text-sm font-extrabold text-white shadow-lg shadow-[var(--brand)]/15 transition hover:bg-[var(--brand-hover)]"
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

        <div className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:px-8">
          <div className="relative z-10">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--brand)]/20 bg-[var(--surface)] px-4 py-2 text-sm font-extrabold text-[var(--brand)] shadow-sm">
              <Zap size={16} />
              منصة واحدة لإدارة تجارتك
            </div>

            <h1 className="text-4xl font-extrabold leading-[1.5] tracking-tight text-[var(--foreground)] sm:text-5xl lg:text-6xl">
              كل تجارتك في مكان واحد مع{" "}
              <span className="text-[var(--brand)]">دكان</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-9 text-[var(--muted)] sm:text-lg">
              نظّم متجرك ومبيعاتك ومنتجاتك ومخزونك وفروعك من خلال نظام عربي
              متكامل يساعدك على متابعة أعمالك واتخاذ قراراتك بسهولة، مهما كان
              نوع نشاطك التجاري.
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
                اكتشف مميزات دكان
              </a>
            </div>

            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm font-bold text-[var(--muted)]">
              <span className="flex items-center gap-2">
                <Check size={17} className="text-[var(--success)]" />
                خطة مجانية
              </span>
              <span className="flex items-center gap-2">
                <Check size={17} className="text-[var(--success)]" />
                يعمل على كل أجهزتك
              </span>
              <span className="flex items-center gap-2">
                <Check size={17} className="text-[var(--success)]" />
                أنشطة تجارية متنوعة
              </span>
            </div>
          </div>

          <DashboardPreview />
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-[var(--line)] bg-[var(--surface)] px-4 py-7">
        <div className="mx-auto grid max-w-6xl gap-5 text-center sm:grid-cols-3">
          <div className="flex items-center justify-center gap-3">
            <span className="rounded-xl bg-[var(--brand-soft)] p-2 text-[var(--brand)]">
              <Store size={20} />
            </span>
            <span className="text-sm font-extrabold text-[var(--foreground)]">
              إدارة المتجر والفروع
            </span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="rounded-xl bg-[var(--brand-soft)] p-2 text-[var(--brand)]">
              <CreditCard size={20} />
            </span>
            <span className="text-sm font-extrabold text-[var(--foreground)]">
              المبيعات والفواتير
            </span>
          </div>
          <div className="flex items-center justify-center gap-3">
            <span className="rounded-xl bg-[var(--brand-soft)] p-2 text-[var(--brand)]">
              <ShieldCheck size={20} />
            </span>
            <span className="text-sm font-extrabold text-[var(--foreground)]">
              تنظيم الصلاحيات
            </span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <SectionHeading
            eyebrow="كل ما تحتاجه تجارتك"
            title="أدوات متكاملة لإدارة أعمالك"
            description="من البيع والمخزون إلى الفروع والموظفين والتقارير، اجمع عمليات تجارتك الأساسية في منصة واحدة."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-6 shadow-[var(--shadow-card)] transition duration-300 hover:-translate-y-1 hover:border-[var(--brand)]/40"
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
          <SectionHeading
            eyebrow="ابدأ بسهولة"
            title="ثلاث خطوات لتنظيم تجارتك"
            description="رحلتك مع دكان تبدأ بخطوات بسيطة، وبعدها تقدر تدير عملياتك من مكان واحد."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.number}
                className="relative rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-card)]"
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
      <section id="pricing" className="scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="الخطط والاشتراكات"
            title="ابدأ بما يناسب تجارتك"
            description="ابدأ بالخطة المجانية، واستكشف الخطط المدفوعة والإضافات من صفحة الأسعار الرسمية."
          />

          <div className="mt-12 grid gap-6 md:grid-cols-2">
            <div className="rounded-3xl border border-[var(--brand)]/30 bg-[var(--brand-soft)] p-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-[var(--surface)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand)]">
                <Check size={14} />
                بداية مجانية
              </span>
              <h3 className="mt-5 text-3xl font-extrabold text-[var(--foreground)]">
                Free
              </h3>
              <p className="mt-3 text-sm leading-8 text-[var(--muted)]">
                ابدأ بإدارة متجرك من خلال خطة مجانية بحدود واضحة تساعدك على
                تنظيم أعمالك وتجربة النظام.
              </p>
              <ul className="mt-5 space-y-3 text-sm font-bold text-[var(--foreground)]">
                <li className="flex items-center gap-2">
                  <Check size={17} className="text-[var(--success)]" />
                  متجر واحد وفرع نشط واحد
                </li>
                <li className="flex items-center gap-2">
                  <Check size={17} className="text-[var(--success)]" />
                  حتى 50 منتجًا نشطًا
                </li>
                <li className="flex items-center gap-2">
                  <Check size={17} className="text-[var(--success)]" />
                  مساحة تخزين 1GB
                </li>
              </ul>
              <Link
                href="/sign-up"
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand)] px-5 py-4 font-extrabold text-white transition hover:bg-[var(--brand-hover)]"
              >
                أنشئ حسابك مجانًا
                <ArrowLeft size={17} />
              </Link>
            </div>

            <div className="rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-8 shadow-[var(--shadow-card)]">
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--card-muted)] px-3 py-1.5 text-xs font-extrabold text-[var(--muted)]">
                <Zap size={14} />
                خيارات متعددة
              </span>
              <h3 className="mt-5 text-3xl font-extrabold text-[var(--foreground)]">
                الخطط المدفوعة
              </h3>
              <p className="mt-3 text-sm leading-8 text-[var(--muted)]">
                اختر الخطة المناسبة لحجم نشاطك، واطّلع على حدود المنتجات
                والفروع والمستخدمين ومساحة التخزين والإضافات.
              </p>
              <div className="mt-6 rounded-2xl bg-[var(--card-muted)] p-5">
                <div className="flex items-center gap-3">
                  <span className="rounded-xl bg-[var(--brand-soft)] p-2 text-[var(--brand)]">
                    <Boxes size={21} />
                  </span>
                  <span className="text-sm font-bold text-[var(--foreground)]">
                    تفاصيل الخطط والأسعار ودورات الاشتراك
                  </span>
                </div>
              </div>
              <Link
                href="/pricing"
                className="mt-8 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-[var(--card-muted)] px-5 py-4 font-extrabold text-[var(--foreground)] transition hover:border-[var(--brand)] hover:text-[var(--brand)]"
              >
                عرض الخطط والأسعار
                <ArrowLeft size={17} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-[#142B45] px-6 py-16 text-center text-white sm:px-12">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full border-[45px] border-white/5" />
          <div className="pointer-events-none absolute -bottom-36 -right-20 h-80 w-80 rounded-full bg-[#159B9B]/25 blur-2xl" />

          <div className="relative z-10">
            <span className="inline-flex rounded-2xl bg-white/10 p-3 text-[#39C6B5]">
              <Zap size={26} />
            </span>
            <h2 className="mt-5 text-3xl font-extrabold sm:text-4xl">
              جاهز تبدأ تنظيم تجارتك؟
            </h2>
            <p className="mx-auto mt-4 max-w-2xl leading-8 text-white/75">
              ابدأ مع دكان ونظّم متجرك ومبيعاتك ومخزونك، وتابع أعمالك من مكان
              واحد.
            </p>
            <Link
              href="/sign-up"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-[#159B9B] px-7 py-4 font-extrabold text-white transition hover:bg-[#117F80]"
            >
              ابدأ مجانًا الآن
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
          <SectionHeading
            eyebrow="معلومات تهمك"
            title="الأسئلة الشائعة"
            description="إجابات مختصرة عن استخدام دكان والخطط والاشتراكات."
          />

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
      <footer className="bg-[#142B45] px-4 py-12 text-white sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 md:grid-cols-2">
          <div>
            <Brand light />
            <p className="mt-5 max-w-md text-sm leading-8 text-white/65">
              دكان منصة عربية لإدارة المتاجر والمبيعات والمخزون والفروع
              والموظفين، تساعدك على تنظيم تجارتك ومتابعتها من مكان واحد.
            </p>
          </div>

          <div className="flex flex-wrap content-start gap-x-7 gap-y-4 text-sm font-bold text-white/70 md:justify-end">
            <a href="#features" className="transition hover:text-white">
              المميزات
            </a>
            <a href="#how" className="transition hover:text-white">
              كيف يعمل
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
