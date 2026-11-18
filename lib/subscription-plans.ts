
export const PLAN_CODES = [
  'free',
  'basic',
  'professional',
  'enterprise',
] as const

export type PlanCode = (typeof PLAN_CODES)[number]

export type PlanLimit =
  | number
  | 'unlimited'
  | 'custom'
  | 'pending'

export type PlanDefinition = {
  code: PlanCode
  name: string
  specificationStatus: 'approved' | 'pending'
  billing: 'lifetime' | 'monthly' | 'custom'
  priceEgp: number | null
  monthlyPriceEgp: number | null
  annualPriceEgp: number | null
  limits: {
    stores: PlanLimit
    branches: PlanLimit
    users: PlanLimit
    products: PlanLimit
    storageGb: PlanLimit
  }
  features: readonly string[]
  featuresStatus: 'approved' | 'pending'
}

export const PLAN_DEFINITIONS: Record<PlanCode, PlanDefinition> = {
  free: {
    code: 'free',
    name: 'Free',
    specificationStatus: 'approved',
    billing: 'lifetime',
    priceEgp: 0,
    monthlyPriceEgp: 0,
    annualPriceEgp: 0,
    limits: {
      stores: 1,
      branches: 1,
      users: 1,
      products: 50,
      storageGb: 1,
    },
    features: [
      'متجر واحد',
      'فرع نشط واحد',
      'مستخدم دخول واحد',
      '50 منتجًا نشطًا',
      'مساحة تخزين 1GB',
      'إدارة أساسية للمنتجات والمخزون',
      'تسجيل المبيعات الأساسي',
      'تقارير أساسية',
    ],
    featuresStatus: 'approved',
  },

  basic: {
    code: 'basic',
    name: 'Basic',
    specificationStatus: 'approved',
    billing: 'monthly',
    priceEgp: 299,
    monthlyPriceEgp: 299,
    annualPriceEgp: 2990,
    limits: {
      stores: 1,
      branches: 3,
      users: 5,
      products: 500,
      storageGb: 5,
    },
    features: [
      'متجر واحد',
      'حتى 3 فروع نشطة',
      'حتى 5 مستخدمين',
      'حتى 500 منتج نشط',
      'مساحة تخزين 5GB',
      'إدارة متقدمة للمنتجات والمخزون',
      'نقاط البيع POS',
      'إدارة الورديات',
      'تقارير المبيعات المتقدمة',
      'إدارة متقدمة للعملاء والموردين',
    ],
    featuresStatus: 'approved',
  },

  professional: {
    code: 'professional',
    name: 'Professional',
    specificationStatus: 'approved',
    billing: 'monthly',
    priceEgp: 699,
    monthlyPriceEgp: 699,
    annualPriceEgp: 6990,
    limits: {
      stores: 1,
      branches: 10,
      users: 20,
      products: 5000,
      storageGb: 20,
    },
    features: [
      'متجر واحد',
      'حتى 10 فروع نشطة',
      'حتى 20 مستخدمًا',
      'حتى 5,000 منتج نشط',
      'مساحة تخزين 20GB',
      'جميع مميزات Basic',
      'الإدارة المالية المتقدمة',
      'الصلاحيات التفصيلية',
      'سجل التدقيق',
      'تقارير الفروع',
      'التحويلات بين الفروع',
    ],
    featuresStatus: 'approved',
  },

  enterprise: {
    code: 'enterprise',
    name: 'Enterprise',
    specificationStatus: 'approved',
    billing: 'custom',
    priceEgp: null,
    monthlyPriceEgp: null,
    annualPriceEgp: null,
    limits: {
      stores: 'custom',
      branches: 'custom',
      users: 'custom',
      products: 'custom',
      storageGb: 'custom',
    },
    features: [
      'إدارة عدة متاجر من لوحة واحدة',
      'فروع ومستخدمون حسب الاتفاق',
      'صلاحيات مخصصة',
      'تقارير موحدة ومخصصة',
      'إدارة مركزية للمخزون والتحويلات',
      'إعدادات ومميزات خاصة',
      'دعم أولوية',
    ],
    featuresStatus: 'approved',
  },
}

export const SUBSCRIPTION_ADDONS = {
  extraBranch: {
    code: 'extra_branch',
    name: 'فرع إضافي',
    priceEgp: 99,
    billing: 'monthly',
  },
  extraUser: {
    code: 'extra_user',
    name: 'مستخدم إضافي',
    priceEgp: 49,
    billing: 'monthly',
  },
  extraStorage: {
    code: 'extra_storage_10gb',
    name: 'مساحة تخزين إضافية 10GB',
    priceEgp: 29,
    billing: 'monthly',
  },
} as const

export const SUBSCRIPTION_BILLING = {
  currency: 'EGP',
  currencyLabel: 'جنيه',
  cycles: {
    monthly: 'شهري',
    annual: 'سنوي',
    lifetime: 'مدى الحياة',
  },
  annualDiscountPercent: 16.67,
} as const

export function isPlanCode(value: string): value is PlanCode {
  return PLAN_CODES.includes(value as PlanCode)
}

export function getPlanDefinition(
  code: string
): PlanDefinition | null {
  if (!isPlanCode(code)) {
    return null
  }

  return PLAN_DEFINITIONS[code]
}

export function isPermanentFreePlan(
  planCode: string | null,
  subscriptionStatus: string | null,
  subscriptionEndsAt: string | null
): boolean {
  return (
    planCode === 'free' &&
    subscriptionStatus === 'active' &&
    subscriptionEndsAt === null
  )
}
