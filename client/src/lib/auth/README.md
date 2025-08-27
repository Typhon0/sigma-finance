# Authentication System Implementation

This document describes the comprehensive authentication system implementation for the frontend application.

## Overview

The authentication system provides secure user registration, login, session management, and JWT token handling with automatic refresh capabilities. It includes comprehensive error handling, user feedback, and React hooks for easy integration.

## Architecture

### Core Components

1. **GraphQL Integration**
   - Authentication mutations and queries
   - Apollo Client integration with auth links
   - Automatic token refresh on GraphQL requests

2. **State Management**
   - React Context for global auth state
   - Local storage for token persistence
   - Automatic session management

3. **Security Features**
   - JWT token storage and validation
   - Automatic token refresh
   - Session timeout handling
   - Secure error handling

4. **User Experience**
   - Loading states for all operations
   - Field-level error handling
   - User-friendly error messages
   - Session warnings

## Files Structure

```
src/
├── graphql/
│   ├── mutations/auth.mutations.ts    # GraphQL auth mutations
│   └── queries/auth.queries.ts        # GraphQL auth queries
├── hooks/
│   ├── use-auth.ts                    # Enhanced auth hook with server sync
│   ├── use-auth-mutations.ts          # GraphQL mutation hooks
│   ├── use-authentication.ts          # Comprehensive auth hooks
│   └── auth/index.ts                  # Centralized exports
├── lib/
│   ├── auth-context.tsx               # React context with auto-refresh
│   ├── auth-error-handler.ts          # Error handling utilities
│   ├── auth-utils.ts                  # Token and state utilities
│   └── types/auth.types.ts            # TypeScript definitions
├── components/auth/
│   ├── session-warning.tsx            # Session timeout warning
│   └── auth-status.tsx                # Authentication status indicator
└── lib/apollo/
    └── auth-link.ts                   # Apollo auth and error links
```

## Key Features

### 1. GraphQL Integration

#### Mutations
- `register` - User registration
- `login` - User authentication
- `logout` - Session termination
- `resetPassword` - Password reset request
- `confirmPasswordReset` - Password reset confirmation
- `verifyEmail` - Email verification
- `resendVerification` - Resend verification email
- `refreshToken` - Token refresh

#### Queries
- `me` - Get current authenticated user

### 2. Authentication Hooks

#### `useAuth()`
Enhanced authentication hook with server synchronization:
```typescript
const { user, isAuthenticated, login, logout, refreshUserData } = useAuth();
```

#### `useAuthentication()`
Comprehensive hook with loading states:
```typescript
const {
  user,
  isAuthenticated,
  login,
  register,
  logout,
  isActionLoading,
  isAnyActionLoading
} = useAuthentication();
```

#### `useAuthForm()`
Form-specific hook with field-level error handling:
```typescript
const {
  fieldErrors,
  isSubmitting,
  handleFormSubmit,
  clearFieldError,
  getFieldError
} = useAuthForm();
```

#### `useAuthGuard()`
Authentication guards and access control:
```typescript
const {
  requireAuth,
  requireEmailVerification,
  canAccess
} = useAuthGuard();
```

### 3. Token Management

#### Automatic Refresh
- Tokens are automatically refreshed 5 minutes before expiry
- Failed refresh attempts trigger logout
- Refresh attempts are deduplicated to prevent multiple simultaneous requests

#### Storage
- JWT tokens stored in localStorage
- Automatic cleanup on logout
- Expiry tracking for validation

### 4. Error Handling

#### User-Friendly Messages
```typescript
const ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password. Please try again.',
  EMAIL_ALREADY_EXISTS: 'An account with this email already exists.',
  ACCOUNT_LOCKED: 'Account temporarily locked due to failed attempts.',
  // ... more error mappings
};
```

#### Field-Level Errors
- Form validation with field-specific error messages
- Real-time error clearing
- Accessibility-compliant error display

### 5. Session Management

#### Session Warnings
- Automatic warnings 5 minutes before session expiry
- One-click session extension
- Countdown timer display

#### Session Utilities
```typescript
// Check session status
SessionManager.shouldShowSessionWarning()
SessionManager.getSessionTimeRemaining()
SessionManager.formatTimeRemaining(milliseconds)
```

## Usage Examples

### Basic Authentication

```typescript
import { useAuthentication } from '@/hooks/use-authentication';

function LoginPage() {
  const { login, isActionLoading } = useAuthentication();
  
  const handleLogin = async (email: string, password: string) => {
    await login(email, password);
    // Automatic redirect and error handling
  };
  
  return (
    <form onSubmit={handleSubmit(handleLogin)}>
      {/* Form fields */}
      <button disabled={isActionLoading('login')}>
        {isActionLoading('login') ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
}
```

### Form Error Handling

```typescript
import { useAuthForm } from '@/hooks/use-authentication';

function RegisterForm() {
  const { fieldErrors, handleFormSubmit, getFieldError } = useAuthForm();
  
  const onSubmit = handleFormSubmit(
    async () => {
      // Registration logic
    },
    (result) => {
      // Success callback
    },
    (errors) => {
      // Error callback with field-specific errors
    }
  );
  
  return (
    <form onSubmit={onSubmit}>
      <input name="email" />
      {getFieldError('email') && (
        <span className="error">{getFieldError('email')}</span>
      )}
    </form>
  );
}
```

### Protected Routes

```typescript
import { useAuthGuard } from '@/hooks/use-authentication';

function ProtectedPage() {
  const { requireAuth, canAccess } = useAuthGuard();
  
  useEffect(() => {
    requireAuth(); // Throws error if not authenticated
  }, [requireAuth]);
  
  if (!canAccess(true, true)) {
    return <div>Access denied</div>;
  }
  
  return <div>Protected content</div>;
}
```

### Session Warning

```typescript
import { SessionWarning } from '@/components/auth/session-warning';

function Layout() {
  return (
    <div>
      <SessionWarning />
      {/* Rest of layout */}
    </div>
  );
}
```

## Security Considerations

### Token Security
- JWT tokens stored in localStorage (consider httpOnly cookies for production)
- Automatic token refresh prevents long-lived tokens
- Secure token validation on server requests

### Error Handling
- No sensitive information exposed in error messages
- Consistent error responses prevent user enumeration
- Automatic logout on authentication failures

### Session Management
- Configurable session timeouts
- Automatic cleanup of expired sessions
- Session warnings prevent unexpected logouts

## Configuration

### Environment Variables
```env
VITE_GRAPHQL_ENDPOINT=http://localhost:8080/graphql
```

### Apollo Client Setup
The authentication system integrates with Apollo Client through custom links:
- `authLink` - Adds JWT tokens to requests
- `authErrorLink` - Handles authentication errors and token refresh

## Testing

### Unit Tests
- Authentication hooks testing
- Error handling validation
- Token management utilities
- Form state management

### Integration Tests
- GraphQL mutation testing
- Apollo Client integration
- End-to-end authentication flows

## Future Enhancements

1. **Multi-Factor Authentication**
   - TOTP support
   - SMS verification
   - Backup codes

2. **Social Authentication**
   - OAuth providers (Google, GitHub, etc.)
   - SAML integration
   - External identity providers

3. **Enhanced Security**
   - Device fingerprinting
   - Suspicious activity detection
   - Rate limiting improvements

4. **User Experience**
   - Remember me functionality
   - Biometric authentication
   - Progressive web app features

## Troubleshooting

### Common Issues

1. **Token Refresh Failures**
   - Check network connectivity
   - Verify refresh token validity
   - Ensure server endpoint is accessible

2. **Session Timeouts**
   - Adjust token expiry settings
   - Implement session extension
   - Add user activity tracking

3. **Error Handling**
   - Check error message mappings
   - Verify GraphQL error format
   - Test error boundary components

### Debug Tools

```typescript
// Enable debug logging
localStorage.setItem('auth_debug', 'true');

// Check token status
console.log(TokenManager.hasValidToken());
console.log(TokenManager.getTimeUntilExpiry());

// Verify auth state
console.log(AuthState.isAuthenticated());
console.log(AuthState.getCurrentUser());
```