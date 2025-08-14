# Portfolio Tracker Architecture

This document explains the architecture of the Portfolio Tracker application, which follows Clean Architecture principles to maintain separation of concerns, testability, and flexibility.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Layered Structure](#layered-structure)
3. [Detailed Layer Descriptions](#detailed-layer-descriptions)
   - [Model Layer](#model-layer)
   - [Use Cases Layer](#use-cases-layer)
   - [Interface Adapters Layer](#interface-adapters-layer)
   - [Frameworks & Drivers Layer](#frameworks--drivers-layer)
   - [Composition Root](#composition-root)
4. [Dependency Flow](#dependency-flow)
5. [Project Structure](#project-structure)
6. [Key Principles](#key-principles)
7. [Getting Started](#getting-started)
8. [Contribution Guidelines](#contribution-guidelines)
9. [Development Workflow](#development-workflow)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Considerations](#deployment-considerations)
12. [Working with External Services](#working-with-external-services)
13. [Common Anti-Patterns to Avoid](#common-anti-patterns-to-avoid)
14. [Future Architecture Evolution](#future-architecture-evolution)

## Architecture Overview

The Portfolio Tracker follows Clean Architecture principles as proposed by Robert C. Martin. This architecture organizes the system into concentric layers with clear responsibilities and dependency rules.

The key principles are:
1. Dependencies point inward - inner layers don't know about outer layers
2. Business rules are isolated from external concerns
3. Each layer has a distinct responsibility
4. Changes to external systems (databases, APIs, frameworks) don't affect business logic

## Layered Structure

The application is organized into the following layers, from innermost to outermost:

1. **Model Layer**: Contains enterprise-wide business rules and domain models
2. **Use Cases Layer**: Contains application-specific business rules
3. **Interface Adapters Layer**: Contains adapters that convert data between formats
4. **Frameworks & Drivers Layer**: Contains implementation details of external systems
5. **Composition Root**: Where all dependencies are wired together


## Detailed Layer Descriptions

### Model Layer

**Location**: `internal/domain/model/`

**Purpose**:
- Contains enterprise-wide business rules and domain models
- Represents the core business objects and their relationships
- Contains business logic that applies across multiple applications

**Contents**:
- Domain model definitions (User, Asset, Portfolio, etc.)
- Enterprise business rules
- Core data structures

**Key Characteristics**:
- No dependencies on any other layer
- Should be completely framework-agnostic
- Changes least frequently

**Example**:
```go
// internal/domain/model/user.go
package model

import "github.com/uptrace/bun"

type User struct {
    bun.BaseModel `bun:"table:users"`

    ID       int64  `bun:"id,pk,autoincrement"`
    Username string `bun:"username,unique"`
    Email    string `bun:"email,unique"`
    Password string `bun:"password"`

    // Business methods would go here
    Validate() error {
        // Business validation rules
    }
}
