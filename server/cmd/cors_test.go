package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newCORSApp(env string, allowedOrigins string) *fiber.App {
	origEnv := os.Getenv("ENVIRONMENT")
	origCORS := os.Getenv("CORS_ALLOWED_ORIGINS")
	defer func() {
		os.Setenv("ENVIRONMENT", origEnv)
		os.Setenv("CORS_ALLOWED_ORIGINS", origCORS)
	}()

	os.Setenv("ENVIRONMENT", env)
	os.Setenv("CORS_ALLOWED_ORIGINS", allowedOrigins)

	app := fiber.New()
	if allowedOrigins == "" {
		allowedOrigins = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
	}

	isProd := strings.EqualFold(os.Getenv("ENVIRONMENT"), "production") || strings.EqualFold(os.Getenv("ENV"), "production")

	app.Use(cors.New(cors.Config{
		AllowOriginsFunc: func(origin string) bool {
			if allowedOrigins == "*" {
				return true
			}
			for _, o := range strings.Split(allowedOrigins, ",") {
				if strings.TrimSpace(o) == origin {
					return true
				}
			}
			if !isProd {
				if strings.HasPrefix(origin, "http://localhost:") ||
					strings.HasPrefix(origin, "http://127.0.0.1:") ||
					strings.HasPrefix(origin, "http://192.168.") ||
					strings.HasPrefix(origin, "http://10.") ||
					strings.HasPrefix(origin, "http://172.") {
					return true
				}
			}
			return false
		},
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowCredentials: true,
		AllowMethods:     "GET, POST, OPTIONS",
	}))

	app.Get("/test", func(c *fiber.Ctx) error {
		return c.SendString("ok")
	})

	return app
}

func TestCORS_ProductionVsDevelopment(t *testing.T) {
	t.Run("Development allows local network and localhost prefixes", func(t *testing.T) {
		app := newCORSApp("development", "http://app.sigmavan.com")

		// Predeclared origin
		req := httptest.NewRequest(http.MethodOptions, "/test", nil)
		req.Header.Set("Origin", "http://app.sigmavan.com")
		req.Header.Set("Access-Control-Request-Method", "GET")
		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, "http://app.sigmavan.com", resp.Header.Get("Access-Control-Allow-Origin"))

		// Undeclared local network IP
		req = httptest.NewRequest(http.MethodOptions, "/test", nil)
		req.Header.Set("Origin", "http://192.168.1.199:5173")
		req.Header.Set("Access-Control-Request-Method", "GET")
		resp, err = app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, "http://192.168.1.199:5173", resp.Header.Get("Access-Control-Allow-Origin"))

		// Evil origin rejected
		req = httptest.NewRequest(http.MethodOptions, "/test", nil)
		req.Header.Set("Origin", "https://attacker.example.com")
		req.Header.Set("Access-Control-Request-Method", "GET")
		resp, err = app.Test(req)
		require.NoError(t, err)
		assert.Empty(t, resp.Header.Get("Access-Control-Allow-Origin"))
	})

	t.Run("Production blocks undeclared local network and localhost", func(t *testing.T) {
		app := newCORSApp("production", "https://app.sigmavan.com")

		// Predeclared origin allowed
		req := httptest.NewRequest(http.MethodOptions, "/test", nil)
		req.Header.Set("Origin", "https://app.sigmavan.com")
		req.Header.Set("Access-Control-Request-Method", "GET")
		resp, err := app.Test(req)
		require.NoError(t, err)
		assert.Equal(t, "https://app.sigmavan.com", resp.Header.Get("Access-Control-Allow-Origin"))

		// Undeclared local network blocked in production
		req = httptest.NewRequest(http.MethodOptions, "/test", nil)
		req.Header.Set("Origin", "http://192.168.1.199:5173")
		req.Header.Set("Access-Control-Request-Method", "GET")
		resp, err = app.Test(req)
		require.NoError(t, err)
		assert.Empty(t, resp.Header.Get("Access-Control-Allow-Origin"))

		// Undeclared localhost blocked in production
		req = httptest.NewRequest(http.MethodOptions, "/test", nil)
		req.Header.Set("Origin", "http://localhost:9999")
		req.Header.Set("Access-Control-Request-Method", "GET")
		resp, err = app.Test(req)
		require.NoError(t, err)
		assert.Empty(t, resp.Header.Get("Access-Control-Allow-Origin"))
	})
}
