import { createFileRoute } from '@tanstack/react-router'
import { RequireAuth } from '@/lib/auth-context'
import PortfolioDetailPage from '@/pages/portfolio-detail'

export const Route = createFileRoute('/portfolios/$portfolioId')({
  component: () => (
    <RequireAuth>
      <PortfolioDetailPage />
    </RequireAuth>
  ),
})