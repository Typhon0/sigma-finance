import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '@/lib/auth-context'
import PortfolioCreatePage from '@/pages/portfolio-create'

export const Route = createFileRoute('/portfolios/create')({
  component: () => (
    <RequireAuth>
      <PortfolioCreatePage />
    </RequireAuth>
  ),
})