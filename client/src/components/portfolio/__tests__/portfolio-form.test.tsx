import { describe, it, expect } from 'vitest';
import { 
  portfolioValidationHelpers,
  portfolioFormSchema,
  portfolioErrorMessages,
} from '@/lib/validations/portfolio.schemas';

describe('Portfolio Form Validation', () => {

  describe('Portfolio Schema Validation', () => {
    it('validates valid portfolio data', () => {
      const validData = {
        name: 'Test Portfolio',
        description: 'A test portfolio description',
      };

      const result = portfolioFormSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const invalidData = {
        name: '',
        description: 'A test portfolio description',
      };

      const result = portfolioFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects name that is too short', () => {
      const invalidData = {
        name: 'AB',
        description: 'A test portfolio description',
      };

      const result = portfolioFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects name that is too long', () => {
      const invalidData = {
        name: 'A'.repeat(101),
        description: 'A test portfolio description',
      };

      const result = portfolioFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('rejects name with invalid characters', () => {
      const invalidData = {
        name: 'Test@Portfolio#',
        description: 'A test portfolio description',
      };

      const result = portfolioFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });

    it('accepts valid name with allowed characters', () => {
      const validData = {
        name: 'Test-Portfolio_123.v2',
        description: 'A test portfolio description',
      };

      const result = portfolioFormSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('accepts empty description', () => {
      const validData = {
        name: 'Test Portfolio',
        description: '',
      };

      const result = portfolioFormSchema.safeParse(validData);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.description).toBeUndefined();
      }
    });

    it('accepts undefined description', () => {
      const validData = {
        name: 'Test Portfolio',
      };

      const result = portfolioFormSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('rejects description that is too long', () => {
      const invalidData = {
        name: 'Test Portfolio',
        description: 'A'.repeat(501),
      };

      const result = portfolioFormSchema.safeParse(invalidData);
      expect(result.success).toBe(false);
    });
  });

  describe('Portfolio Validation Helpers', () => {
    describe('validateNameUniqueness', () => {
      it('returns true for unique names', () => {
        const existingNames = ['Portfolio 1', 'Portfolio 2'];
        const result = portfolioValidationHelpers.validateNameUniqueness(
          'Portfolio 3',
          existingNames
        );
        expect(result).toBe(true);
      });

      it('returns false for duplicate names', () => {
        const existingNames = ['Portfolio 1', 'Portfolio 2'];
        const result = portfolioValidationHelpers.validateNameUniqueness(
          'Portfolio 1',
          existingNames
        );
        expect(result).toBe(false);
      });

      it('returns true when editing with same name', () => {
        const existingNames = ['Portfolio 1', 'Portfolio 2'];
        const result = portfolioValidationHelpers.validateNameUniqueness(
          'Portfolio 1',
          existingNames,
          'Portfolio 1'
        );
        expect(result).toBe(true);
      });

      it('handles case insensitive comparison', () => {
        const existingNames = ['Portfolio 1'];
        const result = portfolioValidationHelpers.validateNameUniqueness(
          'PORTFOLIO 1',
          existingNames
        );
        expect(result).toBe(false);
      });

      it('handles whitespace in names', () => {
        const existingNames = ['Test Portfolio'];
        const result = portfolioValidationHelpers.validateNameUniqueness(
          '  Test Portfolio  ',
          existingNames
        );
        expect(result).toBe(false);
      });
    });

    describe('sanitizeName', () => {
      it('trims whitespace', () => {
        const result = portfolioValidationHelpers.sanitizeName('  Test Portfolio  ');
        expect(result).toBe('Test Portfolio');
      });

      it('replaces multiple spaces with single space', () => {
        const result = portfolioValidationHelpers.sanitizeName('Test    Portfolio');
        expect(result).toBe('Test Portfolio');
      });

      it('removes invalid characters', () => {
        const result = portfolioValidationHelpers.sanitizeName('Test@Portfolio#');
        expect(result).toBe('TestPortfolio');
      });

      it('preserves valid characters', () => {
        const result = portfolioValidationHelpers.sanitizeName('Test-Portfolio_123.v2');
        expect(result).toBe('Test-Portfolio_123.v2');
      });
    });

    describe('sanitizeDescription', () => {
      it('trims whitespace', () => {
        const result = portfolioValidationHelpers.sanitizeDescription('  Test Description  ');
        expect(result).toBe('Test Description');
      });

      it('replaces multiple spaces with single space', () => {
        const result = portfolioValidationHelpers.sanitizeDescription('Test    Description');
        expect(result).toBe('Test Description');
      });
    });

    describe('generateNameSuggestions', () => {
      it('generates numbered suggestions', () => {
        const existingNames = ['Test Portfolio'];
        const suggestions = portfolioValidationHelpers.generateNameSuggestions(
          'Test Portfolio',
          existingNames
        );
        
        expect(suggestions).toContain('Test Portfolio 2');
        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.length).toBeLessThanOrEqual(5);
      });

      it('returns empty array for empty base name', () => {
        const suggestions = portfolioValidationHelpers.generateNameSuggestions('', []);
        expect(suggestions).toEqual([]);
      });

      it('includes base name if unique', () => {
        const existingNames = ['Other Portfolio'];
        const suggestions = portfolioValidationHelpers.generateNameSuggestions(
          'Test Portfolio',
          existingNames
        );
        
        expect(suggestions).toContain('Test Portfolio');
      });

      it('generates date-based suggestions', () => {
        const existingNames = ['Test Portfolio', 'Test Portfolio 2', 'Test Portfolio 3', 'Test Portfolio 4', 'Test Portfolio 5'];
        const suggestions = portfolioValidationHelpers.generateNameSuggestions(
          'Test Portfolio',
          existingNames
        );
        
        // Should generate suggestions (may include date-based ones)
        expect(suggestions.length).toBeGreaterThan(0);
        
        // All suggestions should be unique and not in existing names
        suggestions.forEach(suggestion => {
          expect(existingNames).not.toContain(suggestion);
        });
      });

      it('limits suggestions to 5', () => {
        const existingNames = ['Test Portfolio'];
        const suggestions = portfolioValidationHelpers.generateNameSuggestions(
          'Test Portfolio',
          existingNames
        );
        
        expect(suggestions.length).toBeLessThanOrEqual(5);
      });
    });
  });

  describe('Error Messages', () => {
    it('provides consistent error messages', () => {
      expect(portfolioErrorMessages.nameRequired).toBe('Portfolio name is required');
      expect(portfolioErrorMessages.nameExists).toBe('A portfolio with this name already exists');
      expect(portfolioErrorMessages.nameTooShort).toBe('Portfolio name must be at least 3 characters');
      expect(portfolioErrorMessages.nameTooLong).toBe('Portfolio name must be less than 100 characters');
    });
  });
});