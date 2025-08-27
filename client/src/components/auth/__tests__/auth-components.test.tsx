import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoginForm } from '../login-form';
import { RegisterForm } from '../register-form';
import { PasswordResetForm } from '../password-reset-form';
import { MockedProvider } from '@apollo/client/testing';

// Mock the auth context
const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockResetPassword = vi.fn();

vi.mock('../../../lib/auth-context', () => ({
  useAuth: () => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    login: mockLogin,
    register: mockRegister,
    logout: vi.fn(),
    resetPassword: mockResetPassword,
    confirmPasswordReset: vi.fn(),
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
    refreshToken: vi.fn(),
  }),
}));

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MockedProvider mocks={[]} addTypename={false}>
    {children}
  </MockedProvider>
);

describe('Authentication Components', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('LoginForm', () => {
    it('renders login form with email and password fields', () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
    });

    it('shows validation errors for invalid inputs', async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      // Try to submit with invalid email
      fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
      fireEvent.change(passwordInput, { target: { value: '' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Check that form validation prevents submission
        expect(mockLogin).not.toHaveBeenCalled();
      });
    });

    it('calls login function with correct data when form is submitted', async () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const passwordInput = screen.getByPlaceholderText(/enter your password/i);
      const submitButton = screen.getByRole('button', { name: /sign in/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'password123' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });
  });

  describe('RegisterForm', () => {
    it('renders register form with name, email and password fields', () => {
      render(
        <TestWrapper>
          <RegisterForm />
        </TestWrapper>
      );

      expect(screen.getByRole('textbox', { name: /full name/i })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/create a strong password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });

    it('shows password requirements', () => {
      render(
        <TestWrapper>
          <RegisterForm />
        </TestWrapper>
      );

      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  describe('PasswordResetForm', () => {
    it('renders password reset form with email field', () => {
      render(
        <TestWrapper>
          <PasswordResetForm />
        </TestWrapper>
      );

      expect(screen.getByRole('textbox', { name: /email/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
    });

    it('calls resetPassword function when form is submitted', async () => {
      render(
        <TestWrapper>
          <PasswordResetForm />
        </TestWrapper>
      );

      const emailInput = screen.getByRole('textbox', { name: /email/i });
      const submitButton = screen.getByRole('button', { name: /send reset link/i });

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(mockResetPassword).toHaveBeenCalledWith('test@example.com');
      });
    });
  });
});