package main

import (
	"log"

	"github.com/gofiber/fiber/v2"
)

func main() {
	// NewApp() creates and wires the entire application.
	app, err := NewApp()
	if err != nil {
		log.Fatalf("Failed to create app: %v", err)
	}

	// Start server using the fully configured Fiber app from our container.
	log.Println("Server starting on port 8080...")
	if err := app.FiberApp.Listen(":8080"); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}

// Keep your custom error handler here or move it to app.go
func errorHandler(c *fiber.Ctx, err error) error {
	log.Printf("An error occurred: %v", err)

	code := fiber.StatusInternalServerError
	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
	}

	return c.Status(code).JSON(fiber.Map{
		"error": true,
		"msg":   err.Error(),
	})
}
