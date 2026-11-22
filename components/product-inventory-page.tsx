
'use client'

import { useMemo, useState, useTransition } from 'react'
import { Edit3, Package, Plus, Search, Trash2 } from 'lucide-react'
import {
  createProductWithVariantsAction,
  recordInventoryMovementAction,
  updateProductAction,
  updateProductVariantAction,
  type ProductVariantInput,
} from '@/app/actions/products'

type Variant = {
  id: string
  sku: string
  barcode: string | null
  size: string | null
  color: string | null
  price: number
  cost: number
}

type Product = {
  id: string
  store_id: string
  name: string
  category: string | null
  brand: string | null
  status: 'active' | 'inactive'
  dokkan_product_variants: Variant[]
}

type Branch = {
  id: string
  store_id: string
  name: string
  address: string | null
  status: 'active' | 'inactive'
}

type Movement = {
  branch_id: string
  product_variant_id: string
  movement_type: string
  quantity: number
}

type Props = {
  mode: 'products' | 'inventory'
  initialData: {
    products: Product[]
    branches: Branch[]
    movements: Movement[]
  }
  storeIds: string[]
}

type VariantDraft = ProductVariantInput & { id?: string }

const categories = [
  'أحذية حريمي',
  'أحذية أطفال',
  'شنط حريمي',
]

const movementTypes = [
  { value: 'opening', label: 'رصيد افتتاحي' },
  {
    value: 'adjustment',
    label: 'تسوية جرد (الموجب زيادة والسالب عجز)',
  },
]

const balance = (
  movements: Movement[],
  branchId: string,
  variantId: string
) =>
  movements
    .filter(
      (item) =>
        item.branch_id === branchId &&
        item.product_variant_id === variantId
    )
    .reduce(
      (total, item) =>
        [
          'opening',
          'purchase',
          'return',
          'adjustment',
          'transfer_in',
        ].includes(item.movement_type)
          ? total + item.quantity
          : total - item.quantity,
      0
    )

const emptyVariant = (): VariantDraft => ({
  sku: '',
  barcode: '',
  size: '',
  color: '',
  price: 0,
  cost: 0,
})

/* ================================
   EAN-13 BARCODE GENERATOR FOR PRINT
================================ */

const EAN_L = [
  '0001101', '0011001', '0010011', '0111101', '0100011',
  '0110001', '0101111', '0111011', '0110111', '0001011',
]

const EAN_G = [
  '0100111', '0110011', '0011011', '0100001', '0011101',
  '0111001', '0000101', '0010001', '0001001', '0010111',
]

const EAN_R = [
  '1110010', '1100110', '1101100', '1000010', '1011100',
  '1001110', '1010000', '1000100', '1001000', '1110100',
]

const EAN_PARITY = [
  'LLLLLL',
  'LLGLGG',
  'LLGGLG',
  'LLGGGL',
  'LGLLGG',
  'LGGLLG',
  'LGGGLL',
  'LGLGLG',
  'LGLGGL',
  'LGGLGL',
]

function createBarcodeSvg(value: string) {
  if (!/^\d{13}$/.test(value)) {
    throw new Error('رقم الباركود غير صالح.')
  }

  const digits = value.split('').map(Number)
  const parity = EAN_PARITY[digits[0]]

  let bits = '101'

  for (let i = 1; i <= 6; i++) {
    bits +=
      parity[i - 1] === 'L'
        ? EAN_L[digits[i]]
        : EAN_G[digits[i]]
  }

  bits += '01010'

  for (let i = 7; i <= 12; i++) {
    bits += EAN_R[digits[i]]
  }

  bits += '101'

  const quiet = 11

  const bars = bits
    .split('')
    .map((bit, index) => {
      if (bit !== '1') return ''

      const guard =
        index < 3 ||
        (index >= 45 && index < 50) ||
        index >= 92

      return `<rect x="${quiet + index}" y="0" width="1" height="${guard ? 48 : 42}" />`
    })
    .join('')

  return `
    <svg xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 117 60"
      width="100%"
      height="100%"
      role="img"
      aria-label="Barcode ${value}">
      <rect width="117" height="60" fill="white"/>
      <g fill="black">${bars}</g>
      <text
        x="58.5"
        y="58"
        text-anchor="middle"
        font-family="Arial, sans-serif"
        font-size="8"
      >${value}</text>
    </svg>
  `
}

function escapePrintText(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[char] || char)
}

function printVariantBarcode(
  productName: string,
  variant: Variant
) {
  if (!variant.barcode || !/^\d{13}$/.test(variant.barcode)) {
    alert('لا يوجد باركود صالح لهذا المتغير.')
    return
  }

  const popup = window.open(
    '',
    '_blank',
    'width=600,height=500'
  )

  if (!popup) {
    alert(
      'اسمح بفتح النوافذ المنبثقة حتى تتمكن من طباعة الباركود.'
    )
    return
  }

  const svg = createBarcodeSvg(variant.barcode)

  const details = [
    variant.size ? `المقاس: ${variant.size}` : '',
    variant.color ? `اللون: ${variant.color}` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  popup.document.write(`
    <!doctype html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="utf-8"/>
        <title>طباعة باركود</title>

        <style>
          @page {
            size: 50mm 30mm;
            margin: 1mm;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 1mm;
            font-family: Arial, sans-serif;
            color: #000;
            text-align: center;
          }

          .label {
            width: 48mm;
            height: 28mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            overflow: hidden;
          }

          .name {
            font-size: 10pt;
            font-weight: bold;
            margin-bottom: 1mm;
            max-width: 100%;
          }

          .details {
            font-size: 7pt;
            margin-bottom: 1mm;
          }

          .barcode {
            width: 46mm;
            height: 19mm;
          }

          @media screen {
            body {
              padding: 15px;
            }

            .label {
              border: 1px dashed #999;
              margin: 0 auto;
            }
          }
        </style>
      </head>

      <body>
        <div class="label">
          <div class="name">
            ${escapePrintText(productName)}
          </div>

          <div class="details">
            ${escapePrintText(details)}
          </div>

          <div class="barcode">
            ${svg}
          </div>
        </div>
      </body>
    </html>
  `)

  popup.document.close()
  popup.focus()
  popup.print()
}

/* ================================
   INPUT FIELD
================================ */

function Field({
  label,
  ...props
}: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-2 text-sm font-semibold text-[#465260]">
      <span>{label}</span>

      <input
        {...props}
        className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5 outline-none focus:border-[#2563eb]"
      />
    </label>
  )
}

/* ================================
   MAIN COMPONENT
================================ */

export default function ProductInventoryPage({
  mode,
  initialData,
  storeIds,
}: Props) {
  const [data] = useState(initialData)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, startTransition] = useTransition()

  const [form, setForm] = useState({
    storeId:
      storeIds[0] ||
      initialData.products[0]?.store_id ||
      initialData.branches[0]?.store_id ||
      '',
    name: '',
    category: categories[0],
    brand: '',
  })

  const [variants, setVariants] = useState<VariantDraft[]>([
    emptyVariant(),
  ])

  const [movement, setMovement] = useState<{
    branchId: string
    variantId: string
    type: 'opening' | 'adjustment'
    quantity: string
  } | null>(null)

  const products = useMemo(
    () =>
      data.products.filter((item) =>
        `${item.name} ${item.category || ''} ${
          item.brand || ''
        } ${item.dokkan_product_variants
          .map(
            (v) =>
              `${v.sku} ${v.barcode || ''} ${v.size || ''} ${
                v.color || ''
              }`
          )
          .join(' ')}`
          .toLowerCase()
          .includes(query.toLowerCase())
      ),
    [data.products, query]
  )

  const reload = () => window.location.reload()

  const openCreate = () => {
    setEditing(null)

    setForm({
      storeId: storeIds[0] || '',
      name: '',
      category: categories[0],
      brand: '',
    })

    setVariants([emptyVariant()])
    setError('')
    setNotice('')
    setModal(true)
  }

  const openEdit = (product: Product) => {
    setEditing(product)

    setForm({
      storeId: product.store_id,
      name: product.name,
      category: product.category || categories[0],
      brand: product.brand || '',
    })

    setVariants(
      product.dokkan_product_variants.map((variant) => ({
        ...variant,
        barcode: variant.barcode || '',
        size: variant.size || '',
        color: variant.color || '',
      }))
    )

    setError('')
    setNotice('')
    setModal(true)
  }

  const updateVariant = (
    index: number,
    patch: Partial<VariantDraft>
  ) =>
    setVariants((items) =>
      items.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, ...patch }
          : item
      )
    )

  const saveProduct = (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setNotice('')

    startTransition(async () => {
      try {
        if (editing) {
          await updateProductAction({
            id: editing.id,
            name: form.name,
            category: form.category,
            brand: form.brand,
            status: editing.status,
          })

          for (const variant of variants) {
            if (!variant.id) {
              throw new Error(
                'لا يمكن إضافة متغير جديد أثناء تعديل المنتج من هذه الشاشة'
              )
            }

            await updateProductVariantAction({
              id: variant.id,
              sku: variant.sku,
              barcode: variant.barcode,
              size: variant.size,
              color: variant.color,
              price: Number(variant.price),
              cost: Number(variant.cost),
            })
          }
        } else {
          if (!form.storeId) {
            throw new Error('لا يوجد متجر متاح')
          }

          await createProductWithVariantsAction({
            ...form,
            variants: variants.map((variant) => ({
              sku: variant.sku,
              barcode: variant.barcode,
              size: variant.size,
              color: variant.color,
              price: Number(variant.price),
              cost: Number(variant.cost),
            })),
          })
        }

        setNotice('تم حفظ المنتج والمتغيرات بنجاح.')
        setModal(false)
        reload()
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : 'تعذر حفظ المنتج. تحقق من الصلاحيات والبيانات.'
        )
      }
    })
  }

  const saveMovement = () => {
    if (!movement) return

    setError('')
    setNotice('')

    startTransition(async () => {
      try {
        const product = data.products.find((item) =>
          item.dokkan_product_variants.some(
            (variant) => variant.id === movement.variantId
          )
        )

        const quantity = Number(movement.quantity)

        if (
          !product ||
          !movement.branchId ||
          !Number.isFinite(quantity) ||
          quantity === 0 ||
          (movement.type === 'opening' && quantity < 0)
        ) {
          throw new Error('أدخل فرعًا وكمية صحيحة.')
        }

        await recordInventoryMovementAction({
          storeId: product.store_id,
          branchId: movement.branchId,
          variantId: movement.variantId,
          type: movement.type,
          quantity,
        })

        setNotice('تم تسجيل حركة المخزون بنجاح.')
        setMovement(null)
        reload()
      } catch (reason) {
        setError(
          reason instanceof Error &&
            reason.message === 'Insufficient stock'
            ? 'لا يمكن أن يصبح رصيد المخزون بالسالب.'
            : reason instanceof Error
              ? reason.message
              : 'تعذر تسجيل حركة المخزون.'
        )
      }
    })
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-sm text-[#64748b]">
            Supabase · بيانات حقيقية
          </p>

          <h2 className="mt-1 text-2xl font-extrabold">
            {mode === 'products'
              ? 'المنتجات والمتغيرات'
              : 'المخزون والحركات'}
          </h2>

          <p className="mt-1 text-sm text-[#94a3b8]">
            {mode === 'products'
              ? 'المنتجات، التصنيفات، المقاسات، الألوان والباركود'
              : 'الأرصدة حسب الفرع مع سجل الحركات والتنبيهات'}
          </p>
        </div>

        {mode === 'products' && (
          <button
            onClick={openCreate}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#2563eb] px-4 py-3 text-sm font-bold text-white"
            disabled={busy}
          >
            <Plus /> إضافة منتج
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-[#ffebeb] p-3 text-sm font-bold text-[#c43e3e]"
        >
          {error}
        </p>
      )}

      {notice && (
        <p
          role="status"
          className="rounded-xl bg-[#e4f4ef] p-3 text-sm font-bold text-[#2563eb]"
        >
          {notice}
        </p>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-3 py-2">
        <Search className="text-[#94a3b8]" />

        <input
          aria-label="البحث بالاسم أو الباركود"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="ابحث بالاسم أو SKU أو الباركود"
          className="w-full bg-transparent p-2 outline-none"
        />
      </div>

      {mode === 'products' ? (
        <div className="grid gap-4">
          {products.map((product) => (
            <article
              key={product.id}
              className="rounded-2xl border border-[#e2e8f0] bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-extrabold">
                    {product.name}
                  </h3>

                  <p className="mt-1 text-sm text-[#64748b]">
                    {product.category || 'بدون تصنيف'} ·{' '}
                    {product.brand || 'بدون علامة'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      product.status === 'active'
                        ? 'bg-[#e4f4ef] text-[#2563eb]'
                        : 'bg-[#ffebeb] text-[#c43e3e]'
                    }`}
                  >
                    {product.status === 'active'
                      ? 'نشط'
                      : 'مؤرشف'}
                  </span>

                  <button
                    aria-label={`تعديل ${product.name}`}
                    onClick={() => openEdit(product)}
                    className="rounded-lg p-2 text-[#2563eb] hover:bg-[#eaf2ff]"
                  >
                    <Edit3 size={17} />
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {product.dokkan_product_variants.map((variant) => (
                  <div
                    key={variant.id}
                    className="rounded-xl bg-[#f7f9fa] p-3 text-sm"
                  >
                    <div className="flex justify-between font-bold">
                      <span>{variant.sku}</span>

                      <span>
                        {variant.price.toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-[#64748b]">
                      {variant.size || 'مقاس عام'} ·{' '}
                      {variant.color || 'لون عام'} ·{' '}
                      {variant.barcode || 'بدون باركود'}
                    </p>

                    {variant.barcode && (
                      <button
                        type="button"
                        onClick={() =>
                          printVariantBarcode(product.name, variant)
                        }
                        className="mt-3 rounded-lg bg-[#eaf2ff] px-3 py-2 text-xs font-bold text-[#2563eb]"
                      >
                        طباعة الباركود
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="grid gap-4">
          {products.flatMap((product) =>
            product.dokkan_product_variants.map((variant) => (
              <article
                key={variant.id}
                className="rounded-2xl border border-[#e2e8f0] bg-white p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Package
                        size={18}
                        className="text-[#2563eb]"
                      />

                      <h3 className="font-extrabold">
                        {product.name} · {variant.sku}
                      </h3>
                    </div>

                    <p className="mt-1 text-sm text-[#64748b]">
                      {variant.size || 'مقاس عام'} ·{' '}
                      {variant.color || 'لون عام'}
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      setMovement({
                        branchId: data.branches[0]?.id || '',
                        variantId: variant.id,
                        type: 'opening',
                        quantity: '',
                      })
                    }
                    className="rounded-xl bg-[#2563eb] px-3 py-2 text-xs font-bold text-white"
                  >
                    تسجيل حركة
                  </button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {data.branches
                    .filter(
                      (branch) => branch.store_id === product.store_id
                    )
                    .map((branch) => {
                      const quantity = balance(
                        data.movements,
                        branch.id,
                        variant.id
                      )

                      return (
                        <div
                          key={branch.id}
                          className={`rounded-xl p-4 ${
                            quantity <= 0
                              ? 'bg-[#fff4e6]'
                              : quantity < 5
                                ? 'bg-[#fff9e8]'
                                : 'bg-[#f1faf7]'
                          }`}
                        >
                          <div className="flex justify-between text-sm font-bold">
                            <span>{branch.name}</span>

                            <span>
                              {quantity.toLocaleString('ar-EG')} قطعة
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-[#64748b]">
                            {quantity <= 0
                              ? 'نفد المخزون'
                              : quantity < 5
                                ? 'مخزون منخفض'
                                : 'متوفر'}
                          </p>
                        </div>
                      )
                    })}
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={saveProduct}
            className="max-h-[90vh] w-full max-w-3xl space-y-5 overflow-y-auto rounded-2xl bg-white p-6"
          >
            <div>
              <h3 className="text-xl font-extrabold">
                {editing
                  ? 'تعديل المنتج والمتغيرات'
                  : 'إضافة منتج ومتغيراته'}
              </h3>

              <p className="mt-1 text-sm text-[#64748b]">
                يمكنك إضافة أكثر من مقاس أو لون للمنتج الواحد.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <Field
                label="اسم المنتج"
                required
                value={form.name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    name: event.target.value,
                  })
                }
              />

              <Field
                label="التصنيف"
                required
                value={form.category}
                onChange={(event) =>
                  setForm({
                    ...form,
                    category: event.target.value,
                  })
                }
              />

              <Field
                label="العلامة التجارية"
                value={form.brand}
                onChange={(event) =>
                  setForm({
                    ...form,
                    brand: event.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="font-extrabold">المتغيرات</h4>

                  <p className="mt-1 text-xs text-[#64748b]">
                    كل متغير يمثل مقاسًا أو لونًا أو تركيبة مختلفة.
                  </p>
                </div>

                {!editing && (
                  <button
                    type="button"
                    onClick={() =>
                      setVariants((items) => [
                        ...items,
                        emptyVariant(),
                      ])
                    }
                    className="flex items-center gap-1 rounded-lg bg-[#eaf2ff] px-3 py-2 text-xs font-bold text-[#2563eb]"
                  >
                    <Plus size={15} /> إضافة متغير
                  </button>
                )}
              </div>

              {variants.map((variant, index) => (
                <div
                  key={variant.id || index}
                  className="grid gap-3 rounded-xl border border-[#e2e8f0] p-4 md:grid-cols-3"
                >
                  <Field
                    label="SKU (اختياري)"
                    value={variant.sku}
                    placeholder="يُنشأ تلقائيًا عند تركه فارغًا"
                    onChange={(event) =>
                      updateVariant(index, {
                        sku: event.target.value,
                      })
                    }
                  />

                  <Field
                    label="الباركود"
                    value={variant.barcode || ''}
                    onChange={(event) =>
                      updateVariant(index, {
                        barcode: event.target.value,
                      })
                    }
                  />

                  <Field
                    label="المقاس"
                    value={variant.size || ''}
                    onChange={(event) =>
                      updateVariant(index, {
                        size: event.target.value,
                      })
                    }
                  />

                  <Field
                    label="اللون"
                    value={variant.color || ''}
                    onChange={(event) =>
                      updateVariant(index, {
                        color: event.target.value,
                      })
                    }
                  />

                  <Field
                    label="سعر البيع بالجنيه"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.price}
                    onChange={(event) =>
                      updateVariant(index, {
                        price: Number(event.target.value),
                      })
                    }
                  />

                  <Field
                    label="التكلفة بالجنيه"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={variant.cost}
                    onChange={(event) =>
                      updateVariant(index, {
                        cost: Number(event.target.value),
                      })
                    }
                  />

                  {!editing && variants.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setVariants((items) =>
                          items.filter(
                            (_, itemIndex) => itemIndex !== index
                          )
                        )
                      }
                      className="flex items-center gap-2 text-sm font-bold text-[#c43e3e]"
                    >
                      <Trash2 size={16} /> حذف المتغير
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setModal(false)}
                className="rounded-xl border border-[#e2e8f0] px-4 py-2.5 font-bold"
              >
                إلغاء
              </button>

              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-[#2563eb] px-5 py-2.5 font-bold text-white disabled:opacity-50"
              >
                {busy ? 'جارٍ الحفظ...' : 'حفظ'}
              </button>
            </div>
          </form>
        </div>
      )}

      {movement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6">
            <h3 className="text-xl font-extrabold">
              تسجيل حركة مخزون
            </h3>

            <label className="flex flex-col gap-2 text-sm font-semibold text-[#465260]">
              <span>الفرع</span>

              <select
                value={movement.branchId}
                onChange={(event) =>
                  setMovement({
                    ...movement,
                    branchId: event.target.value,
                  })
                }
                className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5"
              >
                {data.branches
                  .filter((branch) =>
                    data.products.some(
                      (product) =>
                        product.store_id === branch.store_id &&
                        product.dokkan_product_variants.some(
                          (item) => item.id === movement.variantId
                        )
                    )
                  )
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-semibold text-[#465260]">
              <span>نوع الحركة</span>

              <select
                value={movement.type}
                onChange={(event) =>
                  setMovement({
                    ...movement,
                    type: event.target.value as typeof movement.type,
                  })
                }
                className="rounded-xl border border-[#e2e8f0] bg-white px-3 py-2.5"
              >
                {movementTypes.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <Field
              label={
                movement.type === 'adjustment'
                  ? 'كمية التسوية (موجب للزيادة وسالب للعجز)'
                  : 'كمية الرصيد الافتتاحي'
              }
              type="number"
              min={movement.type === 'opening' ? '0.01' : undefined}
              step="0.01"
              value={movement.quantity}
              onChange={(event) =>
                setMovement({
                  ...movement,
                  quantity: event.target.value,
                })
              }
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setMovement(null)}
                className="rounded-xl border border-[#e2e8f0] px-4 py-2.5 font-bold"
              >
                إلغاء
              </button>

              <button
                disabled={busy}
                onClick={saveMovement}
                className="rounded-xl bg-[#2563eb] px-5 py-2.5 font-bold text-white"
              >
                {busy ? 'جارٍ التسجيل...' : 'تسجيل الحركة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
