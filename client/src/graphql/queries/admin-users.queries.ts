import { gql } from "@apollo/client";

export const ADMIN_USERS_QUERY = gql`
  query AdminUsers($filter: AdminUserFilter, $pagination: PaginationInput, $orderBy: UserOrder) {
    adminUsers(filter: $filter, pagination: $pagination, orderBy: $orderBy) {
      totalCount
      users {
        id
        username
        email
        role
        emailVerified
        lastLoginAt
        failedLoginCount
        lockedUntil
        isLocked
        displayCurrency
        taxJurisdiction
        createdAt
        updatedAt
        portfolios {
          id
          name
        }
        watchlists {
          id
          name
        }
      }
    }
  }
`;

export const ADMIN_USER_STATS_QUERY = gql`
  query AdminUserStats {
    adminUserStats {
      totalUsers
      activeUsers
      lockedUsers
      adminUsers
      unverifiedUsers
    }
  }
`;

