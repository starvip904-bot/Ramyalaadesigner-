
'use server'

import { revalidatePath } from 'next/cache'
import { requirePlatformOwner } from '@/lib/tenant-context'
import { requireRedaContext } from '@/lib/reda-scope'

type JsonObject = Record<string, unknown>

const PLAN_CODES = [
  'free',
  'basic',
  'professional',
  'enterprise',
] as const

const ADDON_CODES = [
  'extra_branch',
  'extra_user',
  'extra_storage_10gb',
] as const

const LIMIT_CODES = [
  'stores',
  'branches',
  'users',
  'products',
  'storageGb',
] as const

function isObject(value: unknown): value is JsonObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  )
}

function isNonEmptyString(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0
  )
}

function isValidPrice(value: unknown, allowNull = false) {
  if (allowNull && value === null) {
    return true
  }

  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0
  )
}

function validateSettings(settings: unknown): string | null {
  if (!isObject(settings)) {
    return 'بيانات إعدادات الخطط غير صحيحة.'
  }

  if (!isObject(settings.plans)) {
    return 'تعريفات الخطط غير موجودة.'
  }

  if (!isObject(settings.addons)) {
    return 'تعريفات الإضافات غير موجودة.'
  }

  for (const code of PLAN_CODES) {
    const plan = settings.plans[code]

    if (!isObject(plan)) {
      return `بيانات خطة ${code} غير مكتملة.`
    }

    if (plan.code !== code) {
      return `رمز خطة ${code} غير صحيح.`
    }

    if (!isNonEmptyString(plan.name)) {
      return `اكتب اسمًا صحيحًا لخطة ${code}.`
    }

    if (!isNonEmptyString(plan.billing)) {
      return `دورة فوترة خطة ${code} غير صحيحة.`
    }

    if (!isObject(plan.limits)) {
      return `حدود خطة ${code} غير موجودة.`
    }

    if (!Array.isArray(plan.features)) {
      return `مميزات خطة ${code} غير صحيحة.`
    }

    if (
      !plan.features.every(
        (feature) =>
          typeof feature === 'string' &&
          feature.trim().length > 0 &&
          feature.length <= 250
      )
    ) {
      return `راجع قائمة مميزات خطة ${code}.`
    }

    for (const limitCode of LIMIT_CODES) {
      const limit = plan.limits[limitCode]

      if (typeof limit === 'number') {
        if (!Number.isFinite(limit) || limit < 0) {
          return `قيمة الحد ${limitCode} في خطة ${code} غير صحيحة.`
        }
      } else if (
        typeof limit === 'string' &&
        ['unlimited', 'custom', 'pending'].includes(limit)
      ) {
        // قيمة نصية مسموح بها.
      } else {
        return `قيمة الحد ${limitCode} في خطة ${code} غير صحيحة.`
      }
    }

    if (
      !isValidPrice(plan.monthlyPriceEgp, true) ||
      !isValidPrice(plan.annualPriceEgp, true)
    ) {
      return `أسعار خطة ${code} غير صحيحة.`
    }

    if (
      code === 'free' &&
      (
        plan.billing !== 'lifetime' ||
        plan.monthlyPriceEgp !== 0 ||
        plan.annualPriceEgp !== 0
      )
    ) {
      return 'لا يمكن تحويل خطة Free إلى خطة مدفوعة أو تغيير طبيعتها الدائمة.'
    }

    if (
      code === 'enterprise' &&
      (
        plan.billing !== 'custom' ||
        plan.monthlyPriceEgp !== null ||
        plan.annualPriceEgp !== null
      )
    ) {
      return 'خطة Enterprise تظل حسب الاتفاق دون سعر ثابت.'
    }

    if (
      (code === 'basic' || code === 'professional') &&
      (
        !isValidPrice(plan.monthlyPriceEgp) ||
        !isValidPrice(plan.annualPriceEgp)
      )
    ) {
      return `يجب إدخال السعر الشهري والسنوي لخطة ${code}.`
    }
  }

  for (const code of ADDON_CODES) {
    const addon = settings.addons[code]

    if (!isObject(addon)) {
      return `بيانات الإضافة ${code} غير موجودة.`
    }

    if (addon.code !== code) {
      return `رمز الإضافة ${code} غير صحيح.`
    }

    if (!isNonEmptyString(addon.name)) {
      return `اسم الإضافة ${code} غير صحيح.`
    }

    if (!isValidPrice(addon.priceEgp)) {
      return `سعر الإضافة ${code} غير صحيح.`
    }
  }

  if (
    typeof settings.annualDiscountPercent !== 'number' ||
    !Number.isFinite(settings.annualDiscountPercent) ||
    settings.annualDiscountPercent < 0 ||
    settings.annualDiscountPercent > 100
  ) {
    return 'نسبة الخصم السنوي يجب أن تكون بين صفر و100.'
  }

  return null
}

/**
 * قراءة إعدادات الخطط الحالية.
 * لا تسمح القراءة إلا لمالك المنصة.
 */
export async function getPlatformPlanSettingsAction() {
  const { supabase } = await requirePlatformOwner()

  const { data, error } = await supabase.rpc(
    'dokkan_get_platform_plan_settings'
  )

  if (error) {
    console.error('[platform-plan-settings-read]', {
      code: error.code,
    })

    throw new Error(
      'تعذر تحميل إعدادات الخطط من قاعدة البيانات.'
    )
  }

  if (!isObject(data) || !isObject(data.settings)) {
    throw new Error(
      'بيانات إعدادات الخطط غير موجودة أو غير مكتملة.'
    )
  }

  const validationError = validateSettings(data.settings)

  if (validationError) {
    throw new Error(validationError)
  }

  return {
    settings: data.settings,
    version:
      typeof data.version === 'number'
        ? data.version
        : null,
    updatedAt:
      typeof data.updatedAt === 'string'
        ? data.updatedAt
        : null,
  }
}

/**
 * قراءة كتالوج الخطط العام للتاجر.
 * هذه الدالة لا تستخدم صلاحيات مدير المنصة
 * ولا تكشف بيانات سجل التدقيق.
 */
export async function getPublicSubscriptionPlanCatalogAction() {
  const { supabase } = await requireRedaContext()

  const { data, error } = await supabase.rpc(
    'dokkan_get_public_subscription_plan_catalog'
  )

  if (error) {
    console.error('[public-subscription-plan-catalog]', {
      code: error.code,
    })

    throw new Error(
      'تعذر تحميل الخطط والأسعار الحالية.'
    )
  }

  if (
    !isObject(data) ||
    !isObject(data.plans) ||
    !isObject(data.addons)
  ) {
    throw new Error(
      'بيانات الخطط والأسعار غير مكتملة.'
    )
  }

  return {
    currency:
      typeof data.currency === 'string'
        ? data.currency
        : 'EGP',

    currencyLabel:
      typeof data.currencyLabel === 'string'
        ? data.currencyLabel
        : 'جنيه',

    billingCycles: isObject(data.billingCycles)
      ? data.billingCycles
      : {},

    annualDiscountPercent:
      typeof data.annualDiscountPercent === 'number'
        ? data.annualDiscountPercent
        : 0,

    plans: data.plans,
    addons: data.addons,
  }
}

/**
 * حفظ إعدادات الخطط والإضافات من لوحة مدير المنصة.
 * جميع عمليات الكتابة تتم عبر RPC محمية داخل Supabase.
 */
export async function updatePlatformPlanSettingsAction(input: {
  settings: unknown
  reason: string
}) {
  const { supabase } = await requirePlatformOwner()

  const validationError = validateSettings(input?.settings)

  if (validationError) {
    throw new Error(validationError)
  }

  const reason = input.reason?.trim() || null

  if (reason && reason.length > 500) {
    throw new Error('سبب التعديل يجب ألا يتجاوز 500 حرف.')
  }

  const { data, error } = await supabase.rpc(
    'dokkan_update_platform_plan_settings',
    {
      p_settings: input.settings as never,
      p_reason: reason,
    }
  )

  if (error) {
    console.error('[platform-plan-settings-update]', {
      code: error.code,
    })

    if (
      error.message?.toLowerCase().includes('not authorized')
    ) {
      throw new Error('ليس لديك صلاحية تعديل إعدادات المنصة.')
    }

    throw new Error(
      'تعذر حفظ إعدادات الخطط. راجع البيانات وحاول مرة أخرى.'
    )
  }

  const result = data as {
    success?: boolean
    version?: number
    updatedAt?: string
  } | null

  if (!result?.success) {
    throw new Error('لم يتم تأكيد حفظ إعدادات الخطط.')
  }

  revalidatePath('/platform')

  return {
    ok: true as const,
    version: result.version ?? null,
    updatedAt: result.updatedAt ?? null,
    message: 'تم حفظ إعدادات الخطط وتسجيل العملية الإدارية.',
  }
}
