import { gql } from "@apollo/client";

export const CREATE_STOCK_ASSET = gql`
  mutation CreateStockAsset($input: CreateStockInput!) {
    createStockAsset(input: $input) {
      id
      name
      symbol
      ticker
      quantity
      currentValue
      purchasePrice
      sector
      exchange
      dayChange
      dayChangePercent
      assetType {
        id
        name
      }
    }
  }
`;

export const CREATE_BANK_ACCOUNT_ASSET = gql`
  mutation CreateBankAccountAsset($input: CreateBankAccountInput!) {
    createBankAccountAsset(input: $input) {
      id
      name
      symbol
      accountType
      institution
      accountNumber
      currency
      interestRate
      balance
      currentValue
      purchasePrice
      purchaseDate
      dayChange
      dayChangePercent
      assetType {
        id
        name
      }
    }
  }
`;

export const CREATE_CRYPTO_ASSET = gql`
  mutation CreateCryptoAsset($input: CreateCryptoInput!) {
    createCryptoAsset(input: $input) {
      id
      name
      symbol
      walletAddress
      blockchainNetwork
      quantity
      currentValue
      purchasePrice
      dayChange
      dayChangePercent
      assetType {
        id
        name
      }
    }
  }
`;

export const CREATE_REAL_ESTATE_ASSET = gql`
  mutation CreateRealEstateAsset($input: CreateRealEstateInput!) {
    createRealEstateAsset(input: $input) {
      id
      name
      symbol
      currentValue
      purchasePrice
      purchaseDate
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
      dayChange
      dayChangePercent
      assetType {
        id
        name
      }
    }
  }
`;

export const CREATE_LIFE_INSURANCE_ASSET = gql`
  mutation CreateLifeInsuranceAsset($input: CreateLifeInsuranceInput!) {
    createLifeInsuranceAsset(input: $input) {
      id
      name
      symbol
      currentValue
      purchasePrice
      purchaseDate
      policyNumber
      insurer
      policyType
      coverageAmount
      premiumAmount
      premiumFrequency
      beneficiaries
      maturityDate
      dayChange
      dayChangePercent
      assetType {
        id
        name
      }
    }
  }
`;

export const CREATE_WATCH_ASSET = gql`
  mutation CreateWatchAsset($input: CreateWatchInput!) {
    createWatchAsset(input: $input) {
      id
      name
      symbol
      currentValue
      purchasePrice
      purchaseDate
      brand
      model
      serialNumber
      referenceNumber
      condition
      yearMade
      material
      movement
      caseSize
      waterResistance
      dayChange
      dayChangePercent
      assetType {
        id
        name
      }
    }
  }
`;

export const CREATE_LOAN_ASSET = gql`
  mutation CreateLoanAsset($input: CreateLoanInput!) {
    createLoanAsset(input: $input) {
      id
      name
      symbol
      currentValue
      purchasePrice
      purchaseDate
      description
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
      dayChange
      dayChangePercent
      assetType {
        id
        name
      }
    }
  }
`;

export const ADD_ASSET_TO_PORTFOLIO = gql`
  mutation AddAssetToPortfolio($input: PortfolioAssetInput!) {
    addAssetToPortfolio(input: $input) {
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
        assetType {
          id
          name
        }
      }
      quantity
      averagePurchasePrice
      currentValue
      dayChange
      dayChangePercent
    }
  }
`;

export const REFRESH_SINGLE_ASSET_PRICE = gql`
  mutation RefreshSingleAssetPrice($assetId: ID!) {
    refreshSingleAssetPrice(assetId: $assetId) {
      id
      assetId
      price
      timestamp
      source
    }
  }
`;
