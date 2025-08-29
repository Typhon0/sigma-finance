# Portfolio Edit Functionality

This document describes the portfolio editing functionality implemented for the portfolio management system.

## Overview

The portfolio edit functionality allows users to update their portfolio information including name and description. It includes both a full-page edit experience and a modal dialog for quick edits.

## Components

### 1. EditPortfolioDialog

A modal dialog component that provides a quick way to edit portfolio information.

**Features:**
- Modal dialog interface
- Form validation with existing portfolio name checking
- Real-time validation feedback
- Success/error handling
- Automatic dialog closing after successful update

**Usage:**
```tsx
import { EditPortfolioDialog } from "@/components/portfolio";

<EditPortfolioDialog portfolioId="portfolio-id">
  <Button>Edit Portfolio</Button>
</EditPortfolioDialog>
```

### 2. EditPortfolioButton

A convenience component that provides a pre-styled button for editing portfolios.

**Usage:**
```tsx
import { EditPortfolioButton } from "@/components/portfolio";

<EditPortfolioButton 
  portfolioId="portfolio-id"
  variant="outline"
  size="sm"
/>
```

### 3. Enhanced Portfolio Edit Page

The full-page edit experience at `/portfolios/:id/edit` provides comprehensive editing capabilities.

**Features:**
- Full-page form interface
- Enhanced validation with name uniqueness checking
- Cancel confirmation for unsaved changes
- Breadcrumb navigation
- Error handling for authorization and not found scenarios

## Key Features

### Unique Name Validation

The edit functionality validates that portfolio names are unique within a user's portfolio collection:

- Excludes the current portfolio from uniqueness check during editing
- Provides real-time validation feedback
- Suggests alternative names when conflicts occur

### Authorization & Security

- Verifies user ownership before allowing edits
- Handles unauthorized access gracefully
- Provides appropriate error messages for different scenarios

### Form Validation

- Required field validation for portfolio name
- Character limits and format validation
- Real-time validation feedback
- Form state management with unsaved changes detection

### Error Handling

Comprehensive error handling for various scenarios:
- Portfolio not found
- Unauthorized access
- Network errors
- Validation errors
- Unique name conflicts

### User Experience

- Optimistic updates for better perceived performance
- Loading states during operations
- Success feedback with automatic navigation
- Cancel confirmation for unsaved changes
- Responsive design for mobile and desktop

## Integration Points

### Portfolio Detail Page

The portfolio detail page includes an edit button that opens the edit dialog:

```tsx
<EditPortfolioDialog portfolioId={portfolioId}>
  <Button variant="outline" size="sm">
    <Edit className="mr-2 h-4 w-4" />
    Edit
  </Button>
</EditPortfolioDialog>
```

### Portfolio Card Component

Portfolio cards in the list view include an edit option in their action menu:

```tsx
<EditPortfolioDialog portfolioId={portfolioId}>
  <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
    <Edit className="mr-2 h-4 w-4" />
    Edit
  </DropdownMenuItem>
</EditPortfolioDialog>
```

## API Integration

The edit functionality uses the following GraphQL operations:

### Mutations
- `UPDATE_PORTFOLIO`: Updates portfolio name and description

### Queries
- `GET_PORTFOLIOS_WITH_ANALYTICS`: Fetches user's portfolios for name validation
- `GET_PORTFOLIO`: Fetches individual portfolio details

## Requirements Fulfilled

This implementation fulfills the following requirements from the specification:

- **4.1**: Edit portfolio form with current information pre-populated
- **4.2**: Update operations with proper form validation
- **4.3**: Input validation including unique name checking
- **4.4**: Unique name validation during updates (excluding current portfolio)
- **4.5**: Success feedback and navigation after updates
- **4.6**: Cancel functionality that reverts changes with confirmation

## Testing

The edit functionality includes:
- Component export tests
- Form validation tests (via existing portfolio form tests)
- TypeScript type checking
- Integration with existing portfolio management hooks

## Future Enhancements

Potential improvements for the edit functionality:
- Bulk edit capabilities for multiple portfolios
- Advanced validation rules
- Audit trail for portfolio changes
- Undo/redo functionality
- Auto-save drafts