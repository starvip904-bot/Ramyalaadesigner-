export const APP_LOCALE = 'ar-EG'
export const APP_TIME_ZONE = 'Africa/Cairo'
export const APP_CURRENCY = 'EGP'
export const APP_CURRENCY_LABEL = 'ج.م'

export function formatCurrency(value: number) {
  return new Intl.NumberFormat(APP_LOCALE, { style: 'currency', currency: APP_CURRENCY, currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 }).format(value)
}

export function formatDate(value: Date | string | number) {
  return new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIME_ZONE, dateStyle: 'medium' }).format(new Date(value))
}
