
import 'server-only'

import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { requireRedaContext } from '@/lib/reda-scope'

const PIN_COOKIE_NAME = 'dokkan_section_pin_session'
const PIN_SESSION_SECONDS = 8 * 60 * 60

type StorePinContext = Awaited<
  ReturnType<typeof requireRedaContext>
>

function hashToken(token: string): string {
  return createHash('sha256')
    .update(token)
    .digest('hex')
}

function isValidPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin)
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: PIN_SESSION_SECONDS,
  }
}

/**
 * التحقق من PIN المتجر وإنشاء جلسة حماية لمدة 8 ساعات.
 * لا يتم تخزين PIN أو إرساله إلى المتصفح.
 */
export async function verifyStoreSectionPin(
  pin: string
): Promise<boolean> {
  if (!isValidPin(pin)) {
    return false
  }

  const context = await requireRedaContext()

  const token = randomBytes(32).toString('hex')
  const tokenHash = hashToken(token)

  const { data, error } = await context.supabase.rpc(
    'dokkan_verify_store_section_pin',
    {
      p_pin: pin,
      p_token_hash: tokenHash,
    }
  )

  if (error) {
    throw new Error('STORE_SECTION_PIN_VERIFICATION_FAILED')
  }

  if (data !== true) {
    return false
  }

  const cookieStore = await cookies()

  cookieStore.set(
    PIN_COOKIE_NAME,
    token,
    cookieOptions()
  )

  return true
}

/**
 * التحقق من صلاحية جلسة PIN قبل تنفيذ أي عملية محمية.
 *
 * تعيد بصمة SHA-256 فقط لاستخدامها داخل استدعاءات قاعدة البيانات
 * المحمية. لا تعيد رمز الجلسة الأصلي مطلقًا.
 */
export async function requireStoreSectionPin(
  context: StorePinContext
): Promise<string> {
  const cookieStore = await cookies()
  const token = cookieStore.get(PIN_COOKIE_NAME)?.value

  if (!token) {
    throw new Error('STORE_SECTION_PIN_REQUIRED')
  }

  const tokenHash = hashToken(token)

  const { data, error } = await context.supabase.rpc(
    'dokkan_validate_store_section_pin_session',
    {
      p_store_id: context.storeId,
      p_token_hash: tokenHash,
    }
  )

  if (error || data !== true) {
    cookieStore.delete(PIN_COOKIE_NAME)
    throw new Error('STORE_SECTION_PIN_REQUIRED')
  }

  return tokenHash
}

/**
 * تعيين أو تغيير PIN المتجر.
 * هذه الوظيفة مخصصة لمالك المتجر فقط.
 */
export async function setStoreSectionPin(
  pin: string
): Promise<boolean> {
  if (!isValidPin(pin)) {
    throw new Error('STORE_SECTION_PIN_INVALID')
  }

  const context = await requireRedaContext(['owner'])

  const { data, error } = await context.supabase.rpc(
    'dokkan_set_store_section_pin',
    {
      p_pin: pin,
    }
  )

  if (error) {
    throw new Error('STORE_SECTION_PIN_SAVE_FAILED')
  }

  if (data !== true) {
    return false
  }

  // تغيير PIN يبطل الجلسات السابقة.
  // نحذف أيضًا جلسة المتصفح الحالية لإعادة طلب PIN.
  const cookieStore = await cookies()
  cookieStore.delete(PIN_COOKIE_NAME)

  return true
}

/**
 * إلغاء جلسة PIN الحالية عند تسجيل الخروج.
 * حذف الكوكي يتم حتى إذا فشل إلغاء الجلسة في قاعدة البيانات.
 */
export async function clearStoreSectionPinSession(): Promise<void> {
  const cookieStore = await cookies()
  const token = cookieStore.get(PIN_COOKIE_NAME)?.value

  if (!token) {
    cookieStore.delete(PIN_COOKIE_NAME)
    return
  }

  try {
    const context = await requireRedaContext()

    await context.supabase.rpc(
      'dokkan_revoke_store_section_pin_session',
      {
        p_token_hash: hashToken(token),
      }
    )
  } catch {
    // لا نمنع تسجيل الخروج إذا تعذر إلغاء الجلسة في قاعدة البيانات.
  } finally {
    cookieStore.delete(PIN_COOKIE_NAME)
  }
}
