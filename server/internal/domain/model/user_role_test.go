package model

import "testing"

func TestUserValidate_DefaultsRoleToUser(t *testing.T) {
	user := &User{
		Email: "user@example.com",
		Name:  "User",
	}

	if err := user.Validate(); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if user.Role != UserRoleUser {
		t.Fatalf("expected role %s, got %s", UserRoleUser, user.Role)
	}
}

func TestUserValidate_NormalizesAdminRole(t *testing.T) {
	user := &User{
		Email: "admin@example.com",
		Name:  "Admin",
		Role:  UserRole("admin"),
	}

	if err := user.Validate(); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if user.Role != UserRoleAdmin {
		t.Fatalf("expected role %s, got %s", UserRoleAdmin, user.Role)
	}
}

func TestUserValidate_RejectsInvalidRole(t *testing.T) {
	user := &User{
		Email: "bad-role@example.com",
		Name:  "Bad",
		Role:  UserRole("SUPER_ADMIN"),
	}

	err := user.Validate()
	if err == nil {
		t.Fatal("expected validation error for invalid role")
	}

	validationErr, ok := err.(*ValidationError)
	if !ok {
		t.Fatalf("expected ValidationError, got %T", err)
	}

	if validationErr.Field != "role" {
		t.Fatalf("expected role field error, got %s", validationErr.Field)
	}
}
