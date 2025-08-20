import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '@/lib/auth-context'
import PortfoliosPage from '@/pages/portfolios'

export const Route = createFileRoute('/portfolios')({
  component: () => (
    <RequireAuth>
      <PortfoliosPage />
    </RequireAuth>
  ),
})