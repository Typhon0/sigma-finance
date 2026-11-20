import { graphql } from "@/gql";

export const GET_DASHBOARD_CRITICAL = graphql(/* GraphQL */ `
  query GetDashboardCritical($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
      analytics {
        totalValue
        totalCost
        totalGainLoss
        totalGainLossPercent
        assetAllocation {
          assetType
          value
          percentage
          count
        }
        riskMetrics {
          volatility
          sharpeRatio
          maxDrawdown
          diversification
        }
        performanceHistory {
          date
          value
        }
        # FX provenance. The module must not guess whether a value was
        # converted - the server is the only party that knows.
        displayCurrency
        quoteCurrency
        isStale
        positionValuations {
          positionId
          assetId
          nativeValue
          displayValue
          costBasisNative
          costBasisDisplay
          costBasisCurrency
          costBasisConverted
          hasDisplayValue
          isExcluded
          exclusionReason
          fxRate
          fxAsOf
          isStale
          quoteCurrency
          displayCurrency
        }
      }
      assets {
        quantity
        averagePurchasePrice
        currentValue
        dayChange
        dayChangePercent
        quoteCurrency
        accountName
        accountID
        asset {
          id
          name
          symbol
          currentValue
          purchasePrice
          sector
          exchange
          dayChange
          dayChangePercent
          # Instrument reference metrics, on the concrete types: the Asset
          # interface does not carry them. Nullable - null means the provider
          # has not supplied the figure, which is not the same as zero.
          ... on Stock {
            peRatio
            dividendYield
          }
          ... on Fund {
            expenseRatio
            dividendYield
          }
          ... on BankAccount {
            accountType
            institution
            accountNumber
            currency
            interestRate
            balance
          }
          ... on RealEstate {
            propertyType
            category
            address
            city
            state
            country
            zipCode
            squareFeet
            landSurface
            yearBuilt
            bedrooms
            bathrooms
            rooms
            floor
            totalFloors
            garages
            parkingSpaces
            energyLabel
            condition
            agencyFees
            notaryFees
            renovationFees
            furnishingCosts
            rentalType
            rentalPeriod
            monthlyRent
            utilityCosts
            yearlyMiscCosts
            hasGarden
            hasBalcony
            hasLift
            hasPool
            hasSauna
            isFurnished
            isNewConstruction
            kitchenQuality
            kitchenCondition
            bathroomQuality
            bathroomCondition
            flooringQuality
            flooringCondition
            windowsQuality
            windowsCondition
            generalQuality
            generalCondition
            linkedLoanId
            ownershipPercentage
            ownershipStructure
            addressLabel
            cityCode
            banId
            latitude
            longitude
            hasOutdoor
            isGroundFloor
            valuationMode
            estimationMethod
            manualValue
            estimatedValue
            estimatedMin
            estimatedMax
            estimatedPricePerM2
            basePricePerM2
            valuationConfidence
            comparablesCount
            searchRadiusMeters
            lastEstimatedAt
            valuationHistory {
              date
              value
              mode
              estimatedMin
              estimatedMax
            }
            marketRentPerM2
            estimatedMonthlyRent
            estimatedGrossYield
            rentalR2Adjusted
          }
          ... on Loan {
            loanType
            loanAmount
            remainingBalance
            interestRate
            durationMonths
            monthlyPayment
            startDate
            endDate
            lender
            loanNumber
            currency
            downPayment
            status
            ownershipMode
            applicationFee
            brokerFee
            insuranceFee
            otherFees
            earlyRepaymentFee
            linkedAssetIDs
            ownershipPercentage
            steps {
              id
              date
              amount
              interestRate
            }
            coOwners {
              id
              type
              userId
              name
              percentage
            }
            companyOwners {
              id
              type
              companyId
              name
              registrationNumber
              legalForm
              percentage
            }
          }
          assetType {
            id
            name
          }
        }
      }
    }
    watchlists(filter: { userID: $userID }) {
      id
      name
      assets {
        id
        symbol
      }
    }
  }
`);

export const GET_DASHBOARD_SECONDARY = graphql(/* GraphQL */ `
  query GetDashboardSecondary($userID: ID!) {
    transactions(filter: { userID: $userID }, pagination: { limit: 10 }) {
      id
      accountId
      account {
        id
        name
        institution
      }
      asset {
        id
        symbol
        name
      }
      portfolio {
        id
      }
      amount
      notes
      quantity
      unitPriceAmount
      unitPriceCurrency
      executedAt
      feesAmount
      feesCurrency
      transactionType
    }
  }
`);

export const GET_RECENT_TRANSACTIONS_MINIMAL = graphql(/* GraphQL */ `
  query GetRecentTransactionsMinimal($userID: ID!, $limit: Int) {
    transactions(filter: { userID: $userID }, pagination: { limit: $limit }) {
      id
      accountId
      account {
        id
        name
        institution
      }
      asset {
        id
        symbol
        name
      }
      portfolio {
        id
      }
      amount
      notes
      quantity
      unitPriceAmount
      unitPriceCurrency
      executedAt
      transactionType
    }
  }
`);

export const GET_ASSET_PERFORMANCE_OPTIMIZED = graphql(/* GraphQL */ `
  query GetAssetPerformanceOptimized($userID: ID!, $limit: Int) {
    assets(filter: { userID: $userID }, pagination: { limit: $limit }) {
      id
      name
      currentValue
      purchasePrice
    }
  }
`);
