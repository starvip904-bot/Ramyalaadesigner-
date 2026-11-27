
'use server'

import {
  verifyStoreSectionPin,
  setStoreSectionPin,
} from '@/lib/store-section-pin'

export async function verifyStoreSectionPinAction(
  pin: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const success = await verifyStoreSectionPin(pin)

    if (!success) {
      return {
        success: false,
        message: 'رمز PIN غير صحيح أو غير صالح.',
      }
    }

    return { success: true }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'STORE_SECTION_PIN_VERIFICATION_FAILED'
    ) {
      return {
        success: false,
        message: 'تعذر التحقق من الرمز حاليًا. حاول مرة أخرى.',
      }
    }

    return {
      success: false,
      message: 'حدث خطأ أثناء التحقق من الرمز.',
    }
  }
}

export async function setStoreSectionPinAction(
  pin: string
): Promise<{ success: boolean; message: string }> {
  try {
    const success = await setStoreSectionPin(pin)

    if (!success) {
      return {
        success: false,
        message: 'تعذر حفظ رمز PIN.',
      }
    }

    return {
      success: true,
      message: 'تم حفظ رمز PIN بنجاح. ستحتاج إلى إدخاله مرة أخرى.',
    }
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === 'STORE_SECTION_PIN_INVALID'
    ) {
      return {
        success: false,
        message: 'يجب أن يتكون PIN من 4 إلى 8 أرقام.',
      }
    }

    if (
      error instanceof Error &&
      error.message === 'STORE_ROLE_DENIED'
    ) {
      return {
        success: false,
        message: 'تغيير PIN متاح لمالك المتجر فقط.',
      }
    }

    return {
      success: false,
      message: 'حدث خطأ أثناء حفظ PIN. حاول مرة أخرى.',
    }
  }
}
