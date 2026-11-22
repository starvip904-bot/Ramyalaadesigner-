
import DokkanApp from '@/components/dokkan-app'
import ReturnsManagementPage from '@/components/returns-management-page'
import { requireRedaContext } from '@/lib/reda-scope'
import { getReturnsPageData } from '@/lib/returns-repository'

export default async function ReturnsPage() {
  const [reda, data] = await Promise.all([
    requireRedaContext(),
    getReturnsPageData(),
  ])

  const user = {
    displayName:
      reda.membership.display_name ||
      reda.user.user_metadata?.display_name ||
      reda.user.email ||
      'مستخدم',
    role: reda.membership.role || null,
    storeName: reda.storeName,
  }

  return (
    <DokkanApp
      type="returns"
      user={user}
      content={
        <ReturnsManagementPage
          sales={data.sales}
          returns={data.returns}
        />
      }
    />
  )
}
