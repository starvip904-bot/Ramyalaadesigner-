'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LayoutDashboard, Store, Package, Boxes, ShoppingCart, ReceiptText, Truck, Users, WalletCards, BarChart3, UserCog, Bell, Search, Plus, Menu, X, ChevronLeft, ArrowUpLeft, ArrowDownLeft, MoreHorizontal, Filter, Download, CalendarDays, ScanLine, CreditCard, Banknote, CircleDollarSign, ArrowLeftRight, RotateCcw, ClipboardList, Sparkles } from 'lucide-react'
import ManagementPage from '@/components/management-page'
import WorkflowPage from '@/components/workflow-page'
import LogoutButton from '@/components/auth/logout-button'

const navGroups = [
  { title: 'الإدارة الأساسية', items: [
    { label: 'الرئيسية', href: '/dashboard', icon: LayoutDashboard, status: 'connected' },
    { label: 'المتاجر والفروع', href: '/stores', icon: Store, status: 'connected' },
    { label: 'الموظفون والصلاحيات', href: '/employees', icon: UserCog, status: 'development' },
  ]},
  { title: 'المنتجات والمخزون', items: [
    { label: 'المنتجات والتصنيفات', href: '/products', icon: Package, status: 'connected' },
    { label: 'المخزون والجرد', href: '/inventory', icon: Boxes, status: 'connected' },
    { label: 'التحويلات بين الفروع', href: '/transfers', icon: ArrowLeftRight, status: 'development' },
  ]},
  { title: 'المبيعات والعملاء', items: [
    { label: 'نقطة البيع POS', href: '/pos', icon: ShoppingCart, status: 'development' },
    { label: 'المبيعات والفواتير', href: '/sales', icon: ReceiptText, status: 'development' },
    { label: 'المرتجعات والاستبدال', href: '/returns', icon: RotateCcw, status: 'development' },
    { label: 'العملاء', href: '/customers', icon: Users, status: 'development' },
  ]},
  { title: 'المشتريات والمالية', items: [
    { label: 'الموردون', href: '/suppliers', icon: Truck, status: 'development' },
    { label: 'المشتريات ومدفوعات الموردين', href: '/purchases', icon: Truck, status: 'development' },
    { label: 'المصروفات', href: '/expenses', icon: WalletCards, status: 'connected' },
{ label: 'التقارير والأرباح', href: '/reports', icon: BarChart3, status: 'connected' },
    { label: 'التقارير والأرباح', href: '/reports', icon: BarChart3, status: 'development' },
  ]},
  { title: 'الاشتراك والإعدادات', items: [
    { label: 'اشتراكي وخطتي', href: '/subscription', icon: CreditCard, status: 'connected' },
    { label: 'الخطط والأسعار', href: '/pricing', icon: Sparkles, status: 'connected' },
    { label: 'سجل العمليات', href: '/audit-log', icon: ClipboardList, status: 'development' },
    { label: 'إعدادات المتجر والفواتير', href: '/settings', icon: Store, status: 'development' },
  ]},
]
const nav = navGroups.flatMap((group) => group.items)
const pageMeta: Record<string,{title:string; desc:string}> = { dashboard:{title:'نظرة عامة',desc:'تابع أداء متجرك اليوم'}, stores:{title:'المتاجر والفروع',desc:'إدارة متاجرك وفروعك من مكان واحد'}, products:{title:'المنتجات',desc:'إدارة المنتجات والأصناف والمتغيرات'}, inventory:{title:'المخزون',desc:'راقب مستويات المخزون وحركات الأصناف'}, pos:{title:'نقطة البيع',desc:'أنشئ فاتورة جديدة بسهولة وسرعة'}, sales:{title:'سجل المبيعات',desc:'راجع جميع عمليات البيع والفواتير'}, purchases:{title:'المشتريات والموردين',desc:'إدارة التوريد والفواتير والموردين'}, customers:{title:'العملاء',desc:'ملف شامل لعملائك ونشاطهم'}, suppliers:{title:'الموردون',desc:'إدارة الموردين وبيانات التوريد'}, expenses:{title:'المصروفات',desc:'تتبع مصروفات وتشغيل متجرك'}, reports:{title:'التقارير والأرباح',desc:'تحليلات وتقارير تساعدك على اتخاذ القرار'}, employees:{title:'الموظفون والصلاحيات',desc:'إدارة فريق العمل وصلاحيات الوصول'}, transfers:{title:'التحويلات بين الفروع',desc:'نقل المخزون بين فرع خلوصي وفرع شبرا'}, returns:{title:'المرتجعات والاستبدال',desc:'إدارة مرتجعات واستبدال المنتجات'}, 'audit-log':{title:'سجل العمليات',desc:'تتبع التغييرات والحركات على النظام'}, settings:{title:'إعدادات المتجر والفواتير',desc:'إعدادات المتجر والفواتير والهوية'} }
// Mock data only: replace this module with Supabase queries in the data layer when persistence is enabled.
const products=[['حذاء حريمي كلاسيك','أحذية حريمي','١٢٠','٢٤٥ ج.م','متوفر'],['حذاء أطفال رياضي','أحذية أطفال','٤٨','٣٩٠ ج.م','متوفر'],['شنطة حريمي جلد','شنط حريمي','١٢','٢٨٠ ج.م','منخفض'],['شنطة كروس صغيرة','شنط حريمي','٠','٤٥٠ ج.م','نفد']]
const managementRows: Record<string, string[][]> = {
 stores: [['رضا شوب - الإدارة المركزية','الفرع الرئيسي','نشط','اليوم'],['فرع خلوصي','شارع خلوصي','نشط','منذ ٣ أيام'],['فرع شبرا','شبرا','متوقف','منذ أسبوع']],
 purchases: [['شركة النور للتجارة','مواد تغليف','١٢٬٨٠٠ ج.م','نشطة'],['مؤسسة الرواد','ملابس جاهزة','٨٬٤٥٠ ج.م','نشطة'],['مورد الخليج','إكسسوارات','٤٬٢٠٠ ج.م','مراجعة']],
 customers: [['أحمد محمد','١٨ طلباً','٦٬٤٨٠ ج.م','نشط'],['سارة علي','١٢ طلباً','٤٬٩٢٠ ج.م','نشط'],['خالد عبدالله','٥ طلبات','١٬٨٥٠ ج.م','جديد']],
 expenses: [['إيجار الفرع','تشغيل','٨٬٥٠٠ ج.م','مدفوعة'],['رواتب الموظفين','موارد بشرية','٢٤٬٠٠٠ ج.م','مدفوعة'],['صيانة وتجهيزات','تشغيل','١٬٢٥٠ ج.م','مراجعة']],
 employees: [['محمد عبدالله','مدير النظام','كل الصلاحيات','نشط'],['نورة أحمد','مدير فرع','المبيعات والمخزون','نشط'],['عمر خالد','كاشير','نقطة البيع فقط','نشط']],
 reports: [['تقرير المبيعات اليومية','مبيعات','اليوم، ٠٩:٣٠ ص','جاهز'],['حركة المخزون','مخزون','أمس، ٠٦:٤٥ م','جاهز'],['أداء الفروع','تشغيل','١ ديسمبر ٢٠٢٤','قيد الإنشاء']],
}
const sales=[['#INV-1048','أحمد محمد','اليوم، ١٠:٢٤ ص','٤٨٠ ج.م','مكتملة'],['#INV-1047','سارة علي','اليوم، ٠٩:٥٨ ص','٢٨٠ ج.م','مكتملة'],['#INV-1046','عميل نقدي','أمس، ٠٨:٣٢ م','١٬١٥٠ ج.م','مكتملة'],['#INV-1045','خالد عبدالله','أمس، ٠٦:١٠ م','٣٩٠ ج.م','مسترجعة']]

function Badge({children, tone='green'}:{children:React.ReactNode;tone?:'green'|'orange'|'red'|'blue'}) { const c={green:'bg-[#e4f4ef] text-[#2563eb]',orange:'bg-[#fff2df] text-[#ae6a0b]',red:'bg-[#ffebeb] text-[#c43e3e]',blue:'bg-[#e8f0ff] text-[#456ac1]'}[tone]; return <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${c}`}>{children}</span> }
function StatCard({label,value,change,up,icon:Icon}:{label:string;value:string;change:string;up?:boolean;icon:any}) { return <div className="rounded-2xl border border-[#e2e8f0] bg-white p-5 shadow-[0_2px_12px_rgba(20,40,50,.03)]"><div className="flex items-start justify-between"><div className="flex size-11 items-center justify-center rounded-xl bg-[#eaf2ff] text-[#2563eb]"><Icon /></div><span className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ${up?'bg-[#e4f4ef] text-[#2563eb]':'bg-[#ffebeb] text-[#c43e3e]'}`}>{up?<ArrowUpLeft />:<ArrowDownLeft />}{change}</span></div><p className="mt-5 text-sm text-[#64748b]">{label}</p><p className="mt-1 text-2xl font-extrabold tracking-tight">{value}</p></div> }
function Header({meta,onMenu,user}:{meta:{title:string;desc:string};onMenu:()=>void;user:{displayName:string;role:string|null}}) { return <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#e2e8f0] bg-white/95 px-4 py-4 backdrop-blur md:px-8"><div className="flex items-center gap-3"><button aria-label="فتح القائمة" onClick={onMenu} className="rounded-lg p-2 text-[#64748b] hover:bg-[#f2f5f5] md:hidden"><Menu /></button><div className="md:hidden"><LogoutButton compact /></div><div><h1 className="text-lg font-extrabold md:text-xl">{meta.title}</h1><p className="hidden text-xs text-[#94a3b8] sm:block">{meta.desc}</p></div></div><div className="flex items-center gap-2 md:gap-4"><button className="hidden rounded-xl border border-[#e2e8f0] p-2.5 text-[#64748b] sm:block"><Search /></button><button className="relative rounded-xl border border-[#e2e8f0] p-2.5 text-[#64748b]"><Bell /><i className="absolute right-2 top-2 size-2 rounded-full bg-[#d69b42] ring-2 ring-white" /></button><div className="hidden h-8 w-px bg-[#e2e8f0] sm:block"/><div className="flex items-center gap-2"><div className="flex size-9 items-center justify-center rounded-full bg-[#dbeafe] text-sm font-bold text-[#2563eb]">{user.displayName.slice(0, 1)}</div><div className="hidden text-right md:block"><p className="text-xs font-bold">{user.displayName}</p><p className="text-[10px] text-[#94a3b8]">{user.role === 'owner' ? 'مالك المتجر' : user.role === 'manager' ? 'مدير' : user.role === 'cashier' ? 'كاشير' : user.role === 'stock_manager' ? 'مدير المخزون' : 'مستخدم'}</p></div><LogoutButton compact /></div></div></header> }
function Sidebar({mobile,onClose,user}:{mobile?:boolean;onClose?:()=>void;user:{storeName:string|null}}) { const pathname=usePathname(); return <aside className={`${mobile?'fixed inset-y-0 right-0 z-50 w-72 shadow-2xl':'hidden w-72 shrink-0 border-l border-[#e2e8f0] bg-white lg:block'} bg-white`}><div className="flex h-full flex-col"><div className="flex items-center justify-between border-b border-[#f0f1f3] px-6 py-5"><Link href="/dashboard" className="flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#2563eb] text-xl font-extrabold text-white">د</div><div><p className="text-xl font-extrabold tracking-tight text-[#2563eb]">دكان</p><p className="text-[10px] text-[#94a3b8]">إدارة متجرك بذكاء</p></div></Link>{mobile&&<button onClick={onClose} className="text-[#64748b]"><X /></button>}</div><div className="mx-4 mt-5 rounded-xl bg-[#f1f5f9] px-3 py-3"><p className="text-[10px] text-[#94a3b8]">المتجر الحالي</p><div className="mt-1 flex items-center justify-between"><span className="text-xs font-bold">{user.storeName || 'لم يتم تحديد متجر'}</span><ChevronLeft className="text-[#64748b]" /></div></div><nav aria-label="القائمة الرئيسية" className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 py-5">{navGroups.map((group) => <section key={group.title}><h2 className="mb-2 px-3 text-[10px] font-extrabold tracking-wide text-[#a0a8b2]">{group.title}</h2><div className="space-y-1">{group.items.map(({label,href,icon:Icon,status})=><Link key={href} onClick={onClose} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${pathname===href?'bg-[#eaf2ff] text-[#2563eb]':'text-[#64748b] hover:bg-[#eff6ff] hover:text-[#2563eb]'}`}><Icon size={18} /><span className="min-w-0 flex-1">{label}</span>{status === 'development' && <span className="rounded-full bg-[#fff2df] px-1.5 py-0.5 text-[9px] font-bold text-[#ae6a0b]">قريبًا</span>}</Link>)}</div></section>)}</nav><div className="border-t border-[#f0f1f3] p-4"><div className="rounded-xl bg-[#fff8ed] p-3"><p className="text-xs font-bold text-[#8d641f]">الخطة الاحترافية</p><p className="mt-1 text-[10px] text-[#aa8a55]">ينتهي الاشتراك في ١٥ ديسمبر</p><div className="mt-2 h-1.5 rounded-full bg-[#f2dfba]"><div className="h-full w-3/4 rounded-full bg-[#d69b42]" /></div></div><div className="mt-3"><LogoutButton /></div></div></div></aside> }
function Dashboard() { return <><div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><p className="text-sm text-[#64748b]">صباح الخير، محمد</p><h2 className="mt-1 text-2xl font-extrabold">إليك ملخص متجرك اليوم</h2></div><button className="flex items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-[#2563eb]/15"><Download /> تصدير التقرير</button></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="إجمالي المبيعات اليوم" value="١٢٬٤٨٠ ج.م" change="١٢.٥٪" up icon={CircleDollarSign}/><StatCard label="عدد الطلبات" value="١٢٨" change="٨.٢٪" up icon={ShoppingCart}/><StatCard label="متوسط قيمة الطلب" value="٩٧.٥ ج.م" change="٣.٤٪" up icon={BarChart3}/><StatCard label="المنتجات منخفضة المخزون" value="١٧" change="٤.٦٪" icon={Boxes}/></div><div className="mt-6 grid gap-6 xl:grid-cols-[1.45fr_1fr]"><section className="rounded-2xl border border-[#e2e8f0] bg-white p-5"><div className="flex items-center justify-between"><div><h3 className="font-extrabold">المبيعات خلال الأسبوع</h3><p className="mt-1 text-xs text-[#94a3b8]">مقارنة بآخر ٧ أيام</p></div><button className="flex items-center gap-2 rounded-lg border border-[#e2e8f0] px-3 py-2 text-xs text-[#64748b]"><CalendarDays /> هذا الأسبوع</button></div><div className="mt-7 flex h-52 items-end justify-between gap-2 px-2">{['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'].map((d,i)=><div key={d} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><div className={`w-full max-w-10 rounded-t-lg ${i===5?'bg-[#2563eb]':'bg-[#dbeafe]'}`} style={{height:`${[42,66,54,81,61,93,72][i]}%`}}/><span className="text-[10px] text-[#94a3b8]">{d}</span></div>)}</div></section><section className="rounded-2xl border border-[#e2e8f0] bg-white p-5"><div className="flex items-center justify-between"><h3 className="font-extrabold">أكثر المنتجات مبيعاً</h3><Link href="/products" className="text-xs font-bold text-[#2563eb]">عرض الكل</Link></div><div className="mt-5 flex flex-col gap-4">{[['قميص كتان صيفي','١٢٨ قطعة','bg-[#e1f1f0]'],['فستان سهرة أسود','٩٦ قطعة','bg-[#f4e8df]'],['حذاء رياضي أبيض','٧٤ قطعة','bg-[#e9eef6]'],['حقيبة جلدية كلاسيك','٥٨ قطعة','bg-[#f4edda]']].map(([n,s,c],i)=><div key={n} className="flex items-center gap-3"><div className={`flex size-10 items-center justify-center rounded-xl text-sm font-extrabold text-[#2563eb] ${c}`}>{i+1}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{n}</p><p className="text-[11px] text-[#94a3b8]">{s}</p></div><ChevronLeft className="text-[#b0b8c2]"/></div>)}</div></section></div><section className="mt-6 rounded-2xl border border-[#e2e8f0] bg-white p-5"><div className="flex items-center justify-between"><h3 className="font-extrabold">آخر المبيعات</h3><Link href="/sales" className="text-xs font-bold text-[#2563eb]">عرض سجل المبيعات</Link></div><DataTable headers={['رقم الفاتورة','العميل','التاريخ','المبلغ','الحالة']} rows={sales} /></section></> }
function DataTable({headers,rows}:{headers:string[];rows:string[][]}) { return <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[650px] text-right text-sm"><thead><tr className="border-b border-[#edf0f2] text-xs text-[#94a3b8]">{headers.map(h=><th key={h} className="px-3 py-3 font-semibold">{h}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i} className="border-b border-[#f3f4f5] last:border-0 hover:bg-[#fafcfc]">{row.map((v,j)=><td key={j} className="px-3 py-4 font-semibold">{j===row.length-1?<Badge tone={v==='نفد'||v==='مسترجعة'?'red':v==='منخفض'?'orange':'green'}>{v}</Badge>:v}</td>)}</tr>)}</tbody></table></div> }
function GenericPage({type}:{type:string}) { const meta=pageMeta[type]; const isProducts=type==='products'; const isInventory=type==='inventory'; const isSales=type==='sales'; const [query,setQuery]=useState(''); const [showForm,setShowForm]=useState(false); let rows=isProducts?products:isSales?sales:managementRows[type]||managementRows.stores; if(isInventory) rows=products.map(p=>[p[0],p[1],p[2],p[4]]); const visibleRows=rows.filter(row=>row.join(' ').includes(query)); return <><div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center"><div><p className="text-sm text-[#64748b]">إدارة وتنظيم</p><h2 className="mt-1 text-2xl font-extrabold">{meta.title}</h2></div><button onClick={()=>setShowForm(true)} className="flex items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-bold text-white"><Plus /> إضافة جديد</button></div><div className="mb-6 grid gap-4 sm:grid-cols-3"><StatCard label={isInventory?'إجمالي الأصناف':'إجمالي السجلات'} value={isProducts?'٢٤٨':'١٢٤'} change="١٢٪" up icon={isInventory?Boxes:Package}/><StatCard label={isInventory?'قيمة المخزون':'نشط حالياً'} value={isProducts?'٨٤٬٥٠٠':'١٨'} change="٥.٤٪" up icon={CircleDollarSign}/><StatCard label="يحتاج مراجعة" value="١٧" change="٢.١٪" icon={Bell}/></div><section className="rounded-2xl border border-[#e2e8f0] bg-white p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><label className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] px-3 py-2 text-sm text-[#94a3b8] sm:w-72"><Search /><input aria-label={`ابحث في ${meta.title}`} value={query} onChange={event=>setQuery(event.target.value)} placeholder={`ابحث في ${meta.title}...`} className="w-full bg-transparent text-sm text-[#17202b] outline-none placeholder:text-[#94a3b8]"/></label><button className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] px-3 py-2 text-xs font-semibold text-[#64748b]"><Filter /> تصفية <span className="text-[#c7cdd3]">|</span> <Download /></button></div><DataTable headers={isProducts?['اسم المنتج','التصنيف','المخزون','السعر','الحالة']:isSales?['رقم الفاتورة','العميل','التاريخ','المبلغ','الحالة']:['الاسم','التفاصيل','الحالة','آخر تحديث']} rows={visibleRows}/></section>{showForm&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-[#17202b]/30 p-4" role="dialog" aria-modal="true"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h3 className="text-lg font-extrabold">إضافة {meta.title}</h3><p className="mt-1 text-xs text-[#94a3b8]">هذه البيانات تجريبية ومحفوظة محلياً فقط</p></div><button aria-label="إغلاق" onClick={()=>setShowForm(false)} className="rounded-lg p-2 text-[#64748b] hover:bg-[#f2f5f5]"><X/></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="flex flex-col gap-2 text-sm font-bold">الاسم<input className="rounded-xl border border-[#e2e8f0] px-3 py-3 outline-none focus:border-[#2563eb]" placeholder="أدخل الاسم"/></label><label className="flex flex-col gap-2 text-sm font-bold">التفاصيل<input className="rounded-xl border border-[#e2e8f0] px-3 py-3 outline-none focus:border-[#2563eb]" placeholder="أدخل التفاصيل"/></label></div><div className="mt-6 flex gap-3"><button onClick={()=>setShowForm(false)} className="flex-1 rounded-xl border border-[#e2e8f0] py-3 text-sm font-bold text-[#64748b]">إلغاء</button><button onClick={()=>setShowForm(false)} className="flex-1 rounded-xl bg-[#2563eb] py-3 text-sm font-bold text-white">حفظ البيانات</button></div></div></div>}</> }
function LegacyPosPage(){const [cart,setCart]=useState<string[]>([]); return <><div className="mb-6 flex items-center justify-between"><div><p className="text-sm text-[#64748b]">الفرع الرئيسي</p><h2 className="mt-1 text-2xl font-extrabold">نقطة البيع</h2></div><div className="flex items-center gap-2 rounded-xl bg-[#eaf2ff] px-3 py-2 text-xs font-bold text-[#2563eb]"><ScanLine/> ماسح الباركود جاهز</div></div><div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]"><section className="rounded-2xl border border-[#e2e8f0] bg-white p-5"><div className="flex gap-3"><div className="flex flex-1 items-center gap-2 rounded-xl border border-[#e2e8f0] px-3 py-3 text-sm text-[#94a3b8]"><Search/><span>ابحث عن منتج أو امسح الباركود...</span></div><button className="rounded-xl bg-[#eaf2ff] px-4 text-[#2563eb]"><ScanLine/></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{products.map((p,i)=><button onClick={()=>setCart([...cart,p[0]])} key={p[0]} className="rounded-xl border border-[#edf0f2] p-3 text-right transition hover:border-[#93c5fd] hover:bg-[#f8fbff]"><div className="flex aspect-[1.5] items-center justify-center rounded-lg bg-[#f1f5f9] text-3xl">{['ق','ف','ح','ج'][i]}</div><p className="mt-3 text-xs font-bold">{p[0]}</p><div className="mt-1 flex items-center justify-between"><span className="text-xs text-[#2563eb]">{p[3]}</span><span className="text-[10px] text-[#94a3b8]">متوفر {p[2]}</span></div></button>)}</div></section><section className="rounded-2xl border border-[#e2e8f0] bg-white p-5"><div className="flex items-center justify-between border-b border-[#f0f1f3] pb-4"><h3 className="font-extrabold">الفاتورة الحالية</h3><span className="text-xs text-[#94a3b8]">{cart.length} منتجات</span></div><div className="flex min-h-48 flex-col gap-3 py-4">{cart.length===0?<div className="flex flex-1 flex-col items-center justify-center text-center text-[#94a3b8]"><ShoppingCart className="mb-3 text-[#94a3b8]"/><p className="text-sm">أضف المنتجات إلى الفاتورة</p><p className="mt-1 text-xs">سيظهر ملخص الطلب هنا</p></div>:cart.map((item,index)=><div key={`${item}-${index}`} className="flex items-center justify-between rounded-xl bg-[#f8fbff] px-3 py-3 text-sm"><span className="font-bold">{item}</span><button onClick={()=>setCart(cart.filter((_,i)=>i!==index))} className="text-xs font-bold text-[#c43e3e]">حذف</button></div>)}</div><div className="border-t border-[#f0f1f3] pt-4"><div className="flex justify-between text-sm text-[#64748b]"><span>المجموع الفرعي</span><b>٠ ج.م</b></div><div className="mt-2 flex justify-between text-sm text-[#64748b]"><span>الضريبة (١٥٪)</span><b>٠ ج.م</b></div><div className="mt-4 flex justify-between text-xl font-extrabold"><span>الإجمالي</span><span className="text-[#2563eb]">٠ ج.م</span></div><button className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2563eb] py-3 font-bold text-white"><CreditCard/> إتمام الدفع</button></div></section></div></> }
export default function DokkanApp({
  type,
  user,
  content,
}: {
  type: string
  user: {
    displayName: string
    role: string | null
    storeName: string | null
  }
  content?: React.ReactNode
}) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const meta = pageMeta[type] || pageMeta.dashboard
  const mobileNav = nav.slice(0, 4)

  return (
    <div className="flex min-h-screen bg-[#f7f8fa]">
      <Sidebar user={user} />

      <div
        className={`${
          open ? 'block' : 'hidden'
        } fixed inset-0 z-40 bg-black/20 lg:hidden`}
        onClick={() => setOpen(false)}
      />

      {open && (
        <Sidebar
          mobile
          onClose={() => setOpen(false)}
          user={user}
        />
      )}

      <div className="min-w-0 flex-1">
        <Header
          meta={meta}
          onMenu={() => setOpen(true)}
          user={user}
        />

        <main className="mx-auto max-w-[1600px] p-4 pb-24 md:p-8">
          {content ?? (
            type === 'dashboard' ? (
              <Dashboard />
            ) : type === 'pos' ? (
              <LegacyPosPage />
            ) : [
                'purchases',
                'customers',
                'suppliers',
                'sales',
                'employees',
                'stores',
                'reports',
                'transfers',
                'returns',
                'audit-log',
              ].includes(type) ? (
              <WorkflowPage type={type} />
            ) : (
              <ManagementPage type={type} />
            )
          )}
        </main>

        <nav
          aria-label="التنقل السريع"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-[#e2e8f0] bg-white/95 px-2 py-2 backdrop-blur lg:hidden"
        >
          {mobileNav.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1 text-[10px] font-bold ${
                pathname === href
                  ? 'bg-[#eaf2ff] text-[#2563eb]'
                  : 'text-[#94a3b8]'
              }`}
            >
              <Icon />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  )
}