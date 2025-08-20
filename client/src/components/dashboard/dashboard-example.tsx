// Example component demonstrating Apollo Client and GraphQL infrastructure usage
import { useDashboardData } from '@/hooks/use-dashboard-data'

interface DashboardExampleProps {
  userID: string
}

export const DashboardExample = ({ userID }: DashboardExampleProps) => {
  const { data, loading, error, refetch } = useDashboardData(userID)

  if (loading) {
    return <div>Loading dashboard data...</div>
  }

  if (error) {
    return (
      <div>
        <p>Error loading dashboard: {error.message}</p>
        <button onClick={() => refetch()}>Retry</button>
      </div>
    )
  }

  return (
    <div>
      <h2>Dashboard Data</h2>
      <p>Portfolios: {data?.portfolios?.length || 0}</p>
      <p>Recent Transactions: {data?.transactions?.length || 0}</p>
      
      {/* Example of using the data */}
      {data?.portfolios?.map((portfolio) => (
        <div key={portfolio.id}>
          <h3>{portfolio.name}</h3>
          <p>Assets: {portfolio.assets?.length || 0}</p>
        </div>
      ))}
    </div>
  )
}

export default DashboardExample