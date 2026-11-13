
export const PLAN_CODES = [
  'free',
  'basic',
  'professional',
  'enterprise',
] as const

export type PlanCode = (typeof PLAN_CODES)[number]

export type PlanLimit = number | 'unlimited' | 'pending'

export type PlanDefinition = {
  code: PlanCode
  name: string
  specificationStatus: 'approved' | 'pending'
  billing: 'lifetime' | 'monthly' | 'custom' | 'pending'
  priceEgp: number | null
  limits: {
    stores: PlanLimit
    branches: PlanLimit
    users: PlanLimit
    products: PlanLimit
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
    limits: {
      stores: 1,
      branches: 1,
      users: 2,
      products: 'pending',
    },
    features: [],
    featuresStatus: 'pending',
  },

  basic: {
    code: 'basic',
    name: 'Basic',
    specificationStatus: 'pending',
    billing: 'pending',
    priceEgp: null,
    limits: {
      stores: 'pending',
      branches: 'pending',
      users: 'pending',
      products: 'pending',
    },
    features: [],
    featuresStatus: 'pending',
  },

  professional: {
    code: 'professional',
    name: 'Professional',
    specificationStatus: 'pending',
    billing: 'pending',
    priceEgp: null,
    limits: {
      stores: 'pending',
      branches: 'pending',
      users: 'pending',
      products: 'pending',
    },
    features: [],
    featuresStatus: 'pending',
  },

  enterprise: {
    code: 'enterprise',
    name: 'Enterprise',
    specificationStatus: 'pending',
    billing: 'custom',
    priceEgp: null,
    limits: {
      stores: 'pending',
      branches: 'pending',
      users: 'pending',
      products: 'pending',
    },
    features: [],
    featuresStatus: 'pending',
  },
}

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
