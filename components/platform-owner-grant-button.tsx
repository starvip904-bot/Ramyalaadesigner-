
'use client'

import { grantNewPlatformOwner } from '@/app/platform/actions'

export default function PlatformOwnerGrantButton() {
  return (
    <form action={grantNewPlatformOwner}>
      <button
        type="submit"
        onClick={(event) => {
          const confirmed = window.confirm(
            'هل أنت متأكد من منح حساب maxbin060@gmail.com صلاحية مدير المنصة؟'
          )

          if (!confirmed) {
            event.preventDefault()
          }
        }}
        className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-blue-700"
      >
        تفعيل حساب مدير المنصة الجديد
      </button>
    </form>
  )
}
