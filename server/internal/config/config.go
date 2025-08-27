package config

import (
	"os"
	"strconv"
)

// Config holds application configuration
type Config struct {
	Database DatabaseConfig
	Email    EmailConfig
	JWT      JWTConfig
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Host     string
	Port     string
	User     string
	Password string
	DBName   string
	SSLMode  string
}

// EmailConfig holds email configuration
type EmailConfig struct {
	SMTPHost     string
	SMTPPort     int
	SMTPUsername string
	SMTPPassword string
	FromEmail    string
	FromName     string
	BaseURL      string // Base URL for email links
}

// JWTConfig holds JWT configuration
type JWTConfig struct {
	SecretKey string
}

// LoadConfig loads configuration from environment variables
func LoadConfig() *Config {
	return &Config{
		Database: DatabaseConfig{
			Host:     getEnvOrDefault("DB_HOST", "localhost"),
			Port:     getEnvOrDefault("DB_PORT", "5432"),
			User:     getEnvOrDefault("DB_USER", "postgres"),
			Password: getEnvOrDefault("DB_PASSWORD", "postgres"),
			DBName:   getEnvOrDefault("DB_NAME", "sigma_finance"),
			SSLMode:  getEnvOrDefault("DB_SSLMODE", "disable"),
		},
		Email: EmailConfig{
			SMTPHost:     getEnvOrDefault("SMTP_HOST", "localhost"),
			SMTPPort:     getEnvIntOrDefault("SMTP_PORT", 587),
			SMTPUsername: getEnvOrDefault("SMTP_USERNAME", ""),
			SMTPPassword: getEnvOrDefault("SMTP_PASSWORD", ""),
			FromEmail:    getEnvOrDefault("FROM_EMAIL", "noreply@sigmafinance.com"),
			FromName:     getEnvOrDefault("FROM_NAME", "Sigma Finance"),
			BaseURL:      getEnvOrDefault("BASE_URL", "http://localhost:3000"),
		},
		JWT: JWTConfig{
			SecretKey: getEnvOrDefault("JWT_SECRET", "your-secret-key"),
		},
	}
}

func getEnvIntOrDefault(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
