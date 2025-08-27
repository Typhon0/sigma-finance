# Configuration Documentation

This package provides configuration management for the Sigma Finance authentication system. It loads configuration from environment variables with secure defaults and validation.

## Configuration Structure

### Database Configuration
- `DB_HOST`: Database host (default: localhost)
- `DB_PORT`: Database port (default: 5432)
- `DB_USER`: Database username (default: postgres)
- `DB_PASSWORD`: Database password (default: postgres)
- `DB_NAME`: Database name (default: sigma_finance)
- `DB_SSLMODE`: SSL mode (default: disable)

### JWT Configuration
- `JWT_SECRET`: JWT signing secret (minimum 32 characters, auto-generated if not set)
- `JWT_ACCESS_TOKEN_EXPIRY`: Access token expiration (default: 15m)
- `JWT_REFRESH_TOKEN_EXPIRY`: Refresh token expiration (default: 168h/7 days)
- `JWT_ALGORITHM`: JWT signing algorithm (default: HS256, supports HS256/384/512, RS256/384/512)
- `JWT_ISSUER`: JWT issuer claim (default: sigma-finance)

### Security Configuration
- `BCRYPT_COST`: Bcrypt cost factor (default: 12, range: 10-15)
- `PASSWORD_MIN_LENGTH`: Minimum password length (default: 8, minimum: 8)
- `ACCOUNT_LOCKOUT_THRESHOLD`: Failed login attempts before lockout (default: 5, range: 3-10)
- `ACCOUNT_LOCKOUT_DURATION`: Account lockout duration (default: 30m)
- `RATE_LIMIT_WINDOW`: Rate limiting window (default: 15m)
- `MAX_LOGIN_ATTEMPTS`: Maximum login attempts per window (default: 5)
- `SESSION_TIMEOUT`: Session timeout duration (default: 24h)

### Authentication Configuration
- `EMAIL_VERIFICATION_EXPIRY`: Email verification token expiry (default: 24h)
- `PASSWORD_RESET_EXPIRY`: Password reset token expiry (default: 1h)
- `REQUIRE_EMAIL_VERIFICATION`: Require email verification (default: true)
- `ALLOW_REGISTRATION`: Allow new user registration (default: true)

### Email Configuration
- `SMTP_HOST`: SMTP server host (default: localhost)
- `SMTP_PORT`: SMTP server port (default: 587)
- `SMTP_USERNAME`: SMTP username (required if SMTP_HOST is not localhost)
- `SMTP_PASSWORD`: SMTP password (required if SMTP_HOST is not localhost)
- `FROM_EMAIL`: From email address (default: noreply@sigmafinance.com)
- `FROM_NAME`: From name (default: Sigma Finance)
- `BASE_URL`: Base URL for email links (default: http://localhost:3000)

### Application Environment
- `APP_ENV`: Application environment (default: development, options: development, production, staging)

## Security Considerations

### JWT Secret
- **Production**: Must be at least 32 characters long and cryptographically secure
- **Generation**: Use `openssl rand -base64 32` to generate a secure secret
- **Rotation**: Consider implementing key rotation for enhanced security

### Bcrypt Cost
- **Default**: 12 (recommended for 2024)
- **Range**: 10-15 (higher values increase security but reduce performance)
- **Consideration**: Test performance impact on your hardware

### Account Lockout
- **Threshold**: 5 failed attempts (configurable 3-10)
- **Duration**: 30 minutes (prevents brute force attacks)
- **Window**: 15 minutes (rate limiting window)

### Session Management
- **Access Token**: Short-lived (15 minutes) for security
- **Refresh Token**: Longer-lived (7 days) for user convenience
- **Session Timeout**: 24 hours of inactivity

## Environment Setup

### Development
```bash
# Copy example configuration
cp .env.example .env

# Edit configuration for development
# Most defaults are suitable for development
```

### Production
```bash
# Generate secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)

# Set production environment
APP_ENV=production

# Configure secure database connection
DB_SSLMODE=require

# Configure email service (example with Gmail)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_app_password
```

### Docker
```bash
# Use environment variables in docker-compose.yml
environment:
  - JWT_SECRET=${JWT_SECRET}
  - DB_PASSWORD=${DB_PASSWORD}
  - SMTP_PASSWORD=${SMTP_PASSWORD}
```

## Validation

The configuration system includes comprehensive validation:

- JWT secret length (minimum 32 characters)
- Bcrypt cost range (10-15)
- Password minimum length (at least 8)
- Account lockout threshold (3-10)
- Positive duration values
- Valid JWT algorithms
- SMTP configuration completeness

Invalid configurations will cause the application to panic on startup with a descriptive error message.

## Usage

```go
package main

import (
    "your-app/internal/config"
)

func main() {
    // Load and validate configuration
    cfg := config.LoadConfig()
    
    // Use configuration
    if cfg.IsDevelopment() {
        // Development-specific logic
    }
    
    // Access specific configuration
    jwtSecret := cfg.JWT.SecretKey
    bcryptCost := cfg.Security.BcryptCost
}
```

## Testing

The configuration package includes comprehensive tests:

```bash
# Run configuration tests
go test ./internal/config

# Run with coverage
go test -cover ./internal/config
```

Test coverage includes:
- Default value loading
- Environment variable override
- Configuration validation
- Helper function behavior
- Environment detection