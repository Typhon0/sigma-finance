# Authentication Domain Models

This document describes the authentication domain models implemented for the user authentication system.

## Models Overview

### User Model (`user.go`)
Enhanced the existing User model to support authentication requirements:
- **ID**: Changed from integer to UUID for better security
- **Email**: Unique email address with validation
- **EmailVerified**: Boolean flag for email verification status
- **Name**: Optional user display name
- **PasswordHash**: Bcrypt hashed password (nullable for external auth)
- **AuthMethods**: Relationship to authentication methods
- **LastLoginAt**: Timestamp of last successful login
- **FailedLoginCount**: Counter for failed login attempts
- **LockedUntil**: Account lockout timestamp

**Business Rules:**
- Email format validation using regex
- Account locks after 5 failed login attempts for 30 minutes
- Password strength validation (8+ chars, uppercase, lowercase, number, special char)
- Name length validation (max 255 characters)

### AuthMethod Model (`auth_method.go`)
Represents different authentication methods for extensibility:
- **Provider**: Authentication provider (local, authentik, google, github)
- **ExternalID**: External provider user ID (null for local auth)
- **Metadata**: JSON metadata for provider-specific data

**Business Rules:**
- Local provider must not have external ID
- External providers must have external ID
- Provider validation against allowed list

### Session Model (`session.go`)
JWT session management:
- **Token**: JWT access token (unique)
- **RefreshToken**: JWT refresh token (unique)
- **ExpiresAt**: Session expiration timestamp
- **IPAddress**: Client IP address for security
- **UserAgent**: Client user agent for audit

**Business Rules:**
- Session expiration validation
- Token uniqueness constraints
- IP and user agent tracking for security

### PasswordResetToken Model (`password_reset_token.go`)
Password reset functionality:
- **Token**: Unique reset token
- **ExpiresAt**: Token expiration (default: 1 hour)
- **Used**: Boolean flag to prevent reuse

**Business Rules:**
- Tokens expire after 1 hour
- Tokens can only be used once
- Automatic expiration validation

### EmailVerificationToken Model (`email_verification_token.go`)
Email verification functionality:
- **Token**: Unique verification token
- **ExpiresAt**: Token expiration (default: 24 hours)
- **Used**: Boolean flag to prevent reuse

**Business Rules:**
- Tokens expire after 24 hours
- Tokens can only be used once
- Automatic expiration validation

### AuthEvent Model (`auth_event.go`)
Authentication audit logging:
- **Action**: Type of authentication action
- **Success**: Whether the action succeeded
- **IPAddress**: Client IP for security tracking
- **UserAgent**: Client user agent
- **Metadata**: JSON metadata for additional context

**Supported Actions:**
- login, register, logout
- password_reset, email_verify
- token_refresh, account_lock, account_unlock

## Database Schema

The migration `27082025_add_authentication_system.go` creates:

1. **Updated user table** with authentication fields
2. **auth_method table** for multiple authentication providers
3. **session table** for JWT token management
4. **password_reset_token table** for password reset workflow
5. **email_verification_token table** for email verification
6. **auth_event table** for security audit logging

All tables use UUIDs as primary keys and include proper indexes for performance.

## Error Handling

### ValidationError
- Field-specific validation errors
- Used for input validation failures

### AuthError
- Authentication-specific errors with codes
- Standardized error codes for consistent handling

**Error Codes:**
- `INVALID_CREDENTIALS`: Wrong email/password
- `EMAIL_ALREADY_EXISTS`: Duplicate email registration
- `EMAIL_NOT_VERIFIED`: Unverified email access attempt
- `ACCOUNT_LOCKED`: Account temporarily locked
- `INVALID_TOKEN`: Invalid or malformed token
- `TOKEN_EXPIRED`: Expired token usage
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `WEAK_PASSWORD`: Password doesn't meet requirements
- `INVALID_EMAIL`: Invalid email format

## Security Features

1. **Password Security**: bcrypt hashing with strong validation
2. **Account Lockout**: 5 failed attempts locks for 30 minutes
3. **Token Management**: Unique JWT tokens with expiration
4. **Audit Logging**: All authentication events logged
5. **Email Verification**: Required for account activation
6. **Rate Limiting**: Built-in support for rate limiting
7. **Multi-Provider Support**: Extensible authentication providers

## Testing

Comprehensive test suite covers:
- Email and password validation
- Account locking/unlocking logic
- Token expiration and validation
- Authentication method validation
- Session management
- Audit event creation
- Business rule enforcement

All tests pass and validate the security requirements from the specification.

## Requirements Mapping

This implementation satisfies the following requirements:
- **1.1**: User registration with email/password
- **1.6**: Secure password hashing with bcrypt
- **7.1**: User model supports multiple authentication methods
- **7.2**: Abstracted authentication interface support

The models provide a solid foundation for the authentication service layer and ensure data integrity and security best practices.