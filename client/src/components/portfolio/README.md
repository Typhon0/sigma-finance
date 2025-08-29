# Portfolio Form Components

This directory contains a comprehensive set of reusable portfolio form components built with React Hook Form, Zod validation, and Radix UI components.

## Components Overview

### Core Form Components

#### `EnhancedPortfolioForm`
The main, full-featured portfolio form component with advanced UX features:
- Real-time validation with debounced name uniqueness checking
- Name suggestions for duplicate names
- Unsaved changes warnings
- Success/error message display
- Reset functionality
- Responsive design
- Accessibility compliant

```tsx
import { EnhancedPortfolioForm } from '@/components/portfolio';

<EnhancedPortfolioForm
  mode="create" // or "edit"
  onSubmit={handleSubmit}
  onCancel={handleCancel}
  existingPortfolioNames={existingNames}
  showResetButton={true}
  showCancelConfirmation={true}
/>
```

#### `CompactPortfolioForm`
A streamlined form perfect for dialogs and modals:
- Minimal UI footprint
- Essential validation
- Quick operations
- Customizable button text

```tsx
import { CompactPortfolioForm } from '@/components/portfolio';

<CompactPortfolioForm
  mode="create"
  onSubmit={handleSubmit}
  onCancel={handleCancel}
  existingPortfolioNames={existingNames}
/>
```

#### `PortfolioFormFields`
Reusable form field components that can be composed into custom forms:
- Name field with validation and suggestions
- Description field
- Can be used with any form wrapper

```tsx
import { PortfolioFormFields } from '@/components/portfolio';
import { Form } from '@/components/ui/form';

<Form {...form}>
  <form onSubmit={form.handleSubmit(onSubmit)}>
    <PortfolioFormFields
      existingPortfolioNames={existingNames}
      currentPortfolioName={portfolio?.name}
    />
    {/* Custom buttons and other fields */}
  </form>
</Form>
```

### Dialog Components

#### `PortfolioFormDialog`
A complete dialog wrapper with form integration:
- Handles dialog state
- Success/error messaging
- Auto-close on success

```tsx
import { CreatePortfolioDialog, EditPortfolioDialog } from '@/components/portfolio';

<CreatePortfolioDialog
  onSubmit={handleCreate}
  existingPortfolioNames={existingNames}
>
  <Button>Create Portfolio</Button>
</CreatePortfolioDialog>

<EditPortfolioDialog
  portfolio={portfolio}
  onSubmit={handleUpdate}
  existingPortfolioNames={existingNames}
>
  <Button>Edit Portfolio</Button>
</EditPortfolioDialog>
```

### Specialized Components

#### `QuickCreatePortfolioForm`
Minimal form for quick portfolio creation without cancel button:

```tsx
import { QuickCreatePortfolioForm } from '@/components/portfolio';

<QuickCreatePortfolioForm
  onSubmit={handleSubmit}
  existingPortfolioNames={existingNames}
/>
```

#### `InlineEditPortfolioForm`
Form optimized for inline editing scenarios:

```tsx
import { InlineEditPortfolioForm } from '@/components/portfolio';

<InlineEditPortfolioForm
  portfolio={portfolio}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
  existingPortfolioNames={existingNames}
/>
```

## Validation Schema

The components use a comprehensive Zod schema for validation:

```typescript
import { portfolioFormSchema, type PortfolioFormData } from '@/lib/validations/portfolio.schemas';

// Schema validates:
// - Name: 3-100 characters, alphanumeric + spaces, hyphens, underscores, periods
// - Description: Optional, max 500 characters
// - Uniqueness: Client-side validation against existing names
```

## Validation Helpers

The package includes utility functions for common validation tasks:

```typescript
import { portfolioValidationHelpers } from '@/lib/validations/portfolio.schemas';

// Check name uniqueness
const isUnique = portfolioValidationHelpers.validateNameUniqueness(
  'New Portfolio',
  existingNames,
  currentName // for edit mode
);

// Sanitize input
const cleanName = portfolioValidationHelpers.sanitizeName('  Portfolio Name  ');

// Generate suggestions for duplicate names
const suggestions = portfolioValidationHelpers.generateNameSuggestions(
  'Duplicate Name',
  existingNames
);
```

## Features

### Real-time Validation
- Debounced name uniqueness checking
- Immediate feedback on validation errors
- Form state management with React Hook Form

### Name Suggestions
- Automatic generation of alternative names for duplicates
- Numbered variations (Portfolio 2, Portfolio 3, etc.)
- Date-based suggestions
- One-click application of suggestions

### Error Handling
- Comprehensive error messages
- Network error handling
- Validation error display
- Retry mechanisms

### Accessibility
- ARIA labels and descriptions
- Keyboard navigation support
- Screen reader friendly
- Focus management

### Responsive Design
- Mobile-first approach
- Touch-friendly interactions
- Adaptive layouts
- Consistent spacing

## Usage Examples

### Basic Create Form
```tsx
function CreatePortfolioPage() {
  const { createPortfolio } = usePortfolioManagement();
  const [existingNames, setExistingNames] = useState<string[]>([]);

  const handleSubmit = async (data: PortfolioFormData) => {
    await createPortfolio(data);
    // Handle success
  };

  return (
    <EnhancedPortfolioForm
      mode="create"
      onSubmit={handleSubmit}
      onCancel={() => navigate('/portfolios')}
      existingPortfolioNames={existingNames}
    />
  );
}
```

### Edit Form with Existing Data
```tsx
function EditPortfolioPage({ portfolio }: { portfolio: Portfolio }) {
  const { updatePortfolio } = usePortfolioManagement();

  const handleSubmit = async (data: PortfolioFormData) => {
    await updatePortfolio(portfolio.id, data);
    // Handle success
  };

  return (
    <EnhancedPortfolioForm
      portfolio={portfolio}
      mode="edit"
      onSubmit={handleSubmit}
      onCancel={() => navigate(`/portfolios/${portfolio.id}`)}
      existingPortfolioNames={otherPortfolioNames}
    />
  );
}
```

### Dialog Integration
```tsx
function PortfolioList({ portfolios }: { portfolios: Portfolio[] }) {
  const existingNames = portfolios.map(p => p.name);

  return (
    <div>
      <CreatePortfolioDialog
        onSubmit={handleCreate}
        existingPortfolioNames={existingNames}
      >
        <Button>Add Portfolio</Button>
      </CreatePortfolioDialog>

      {portfolios.map(portfolio => (
        <div key={portfolio.id}>
          <span>{portfolio.name}</span>
          <EditPortfolioDialog
            portfolio={portfolio}
            onSubmit={(data) => handleUpdate(portfolio.id, data)}
            existingPortfolioNames={existingNames}
          >
            <Button variant="ghost">Edit</Button>
          </EditPortfolioDialog>
        </div>
      ))}
    </div>
  );
}
```

## Testing

The components include comprehensive tests covering:
- Schema validation
- Helper functions
- Error scenarios
- Success flows
- Edge cases

Run tests with:
```bash
bun test ./src/components/portfolio/__tests__/portfolio-form.test.tsx
```

## Dependencies

- `react-hook-form` - Form state management
- `@hookform/resolvers/zod` - Zod integration
- `zod` - Schema validation
- `@radix-ui/*` - UI primitives
- `lucide-react` - Icons
- `tailwindcss` - Styling

## Best Practices

1. **Always provide existing portfolio names** for uniqueness validation
2. **Use appropriate form variant** for your use case (Enhanced vs Compact)
3. **Handle success and error callbacks** for better UX
4. **Provide loading states** during async operations
5. **Use TypeScript types** for better development experience
6. **Test form validation** in your application
7. **Consider accessibility** when customizing components

## Customization

All components accept standard props for customization:
- `className` for additional styling
- `disabled` for form state control
- Custom button text
- Success/error callbacks
- Loading state management

The components are built with Tailwind CSS and can be easily themed to match your application's design system.