
function Header({
  meta,
  onMenu,
  user,
}: {
  meta: { title: string; desc: string };
  onMenu: () => void;
  user: { displayName: string; role: string | null };
}) {
  const roleLabels: Record<string, string> = {
    owner: 'مالك المتجر',
    admin: 'مسؤول',
    manager: 'مدير',
    cashier: 'كاشير',
    stock_manager: 'مدير المخزون',
    viewer: 'مشاهد',
  };

  const displayName = user.displayName?.trim() || 'مستخدم';
  const firstLetter = displayName.charAt(0);

  return (
    <header className="sticky top-0 z-30 border-b border-[#e2e8f0] bg-white/95 px-3 py-3 backdrop-blur-md sm:px-5 md:px-8 md:py-4">
      <div className="flex min-h-10 items-center justify-between gap-3">
        {/* عنوان الصفحة والقائمة */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="فتح القائمة"
            onClick={onMenu}
            className="flex size-10 shrink-0 items-center justify-center rounded-xl text-[#475569] transition hover:bg-[#f1f5f9] active:bg-[#e2e8f0] md:hidden"
          >
            <Menu size={21} />
          </button>

          <div className="min-w-0">
            <h1 className="truncate text-base font-extrabold text-[#0f172a] sm:text-lg md:text-xl">
              {meta.title}
            </h1>

            {meta.desc && (
              <p className="mt-1 hidden truncate text-xs text-[#94a3b8] sm:block">
                {meta.desc}
              </p>
            )}
          </div>
        </div>

        {/* أدوات المستخدم */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* البحث غير مفعّل حاليًا */}
          <button
            type="button"
            disabled
            title="البحث غير متاح حاليًا"
            aria-label="البحث غير متاح حاليًا"
            className="hidden size-10 cursor-not-allowed items-center justify-center rounded-xl border border-[#e2e8f0] text-[#cbd5e1] sm:flex"
          >
            <Search size={19} />
          </button>

          {/* بيانات المستخدم */}
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#dbeafe] text-sm font-bold text-[#2563eb] ring-2 ring-[#eff6ff]">
              {firstLetter}
            </div>

            <div className="hidden min-w-0 text-right md:block">
              <p className="max-w-36 truncate text-xs font-bold text-[#1e293b]">
                {displayName}
              </p>
              <p className="mt-1 text-[10px] text-[#94a3b8]">
                {roleLabels[user.role || ''] || 'مستخدم'}
              </p>
            </div>
          </div>

          <div className="h-8 w-px bg-[#e2e8f0]" />

          <div className="shrink-0">
            <LogoutButton compact />
          </div>
        </div>
      </div>
    </header>
  );
}
