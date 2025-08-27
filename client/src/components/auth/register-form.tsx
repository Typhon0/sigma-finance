import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '../ui/button';
import { useAuth } from '../../lib/auth-context';
import { registerSchema, type RegisterFormData } from '../../lib/validations/auth.schemas';
import { AuthFormWrapper } from './auth-form-wrapper';
import { AuthFormField } from './auth-form-field';
import { AuthButton } from './auth-button';
import { useAuthErrorHandler } from '../../lib/auth-error-handler';
import type { AuthError } from '../../lib/types/auth.types';

interface RegisterFormProps {
  onSwitchToLogin?: () => void;
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [authErrors, setAuthErrors] = useState<AuthError[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState('');
  const { register: registerUser, isLoading, resendVerification } = useAuth();
  const { handleAuthResponse } = useAuthErrorHandler();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const watchedValues = watch();

  const onSubmit = async (data: RegisterFormData) => {
    setAuthErrors([]);
    try {
      await registerUser(data.email, data.password, data.name);
      setRegisteredEmail(data.email);
      setShowSuccess(true);
      reset(); // Clear form on successful registration
    } catch (error: any) {
      // Extract errors from the error object if available
      if (error?.graphQLErrors?.[0]?.extensions?.errors) {
        setAuthErrors(error.graphQLErrors[0].extensions.errors);
      } else {
        setAuthErrors([{
          code: 'INTERNAL_ERROR',
          message: 'Registration failed. Please try again.',
        }]);
      }
    }
  };

  const handleRetry = () => {
    setAuthErrors([]);
    setShowSuccess(false);
  };

  const handleResendEmail = async () => {
    if (registeredEmail) {
      try {
        await resendVerification(registeredEmail);
      } catch (error) {
        console.error('Failed to resend verification:', error);
      }
    }
  };

  const isFormLoading = isLoading || isSubmitting;

  return (
    <AuthFormWrapper
      title="Create Account"
      description="Sign up to start tracking your portfolio"
      errors={authErrors}
      isLoading={isFormLoading}
      loadingType="register"
      showSuccess={showSuccess}
      successType="registration"
      email={registeredEmail}
      onRetry={handleRetry}
      onResendEmail={handleResendEmail}
      onContinue={onSwitchToLogin}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <AuthFormField
          id="name"
          name="name"
          type="text"
          label="Full Name"
          placeholder="Enter your full name"
          value={watchedValues.name || ''}
          error={errors.name?.message}
          disabled={isFormLoading}
          required
          autoComplete="name"
          {...register('name')}
        />

        <AuthFormField
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="Enter your email"
          value={watchedValues.email || ''}
          error={errors.email?.message}
          disabled={isFormLoading}
          required
          autoComplete="email"
          {...register('email')}
        />

        <AuthFormField
          id="password"
          name="password"
          type="password"
          label="Password"
          placeholder="Create a strong password"
          value={watchedValues.password || ''}
          error={errors.password?.message}
          disabled={isFormLoading}
          required
          autoComplete="new-password"
          showPasswordToggle
          description="Password must be at least 8 characters with uppercase, lowercase, and number"
          {...register('password')}
        />

        <AuthButton
          type="submit"
          authType="register"
          isLoading={isFormLoading}
          disabled={isFormLoading}
          fullWidth
        />

        {onSwitchToLogin && (
          <div className="text-center">
            <div className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Button
                type="button"
                variant="link"
                className="p-0 h-auto font-normal"
                onClick={onSwitchToLogin}
                disabled={isFormLoading}
              >
                Sign in
              </Button>
            </div>
          </div>
        )}
      </form>
    </AuthFormWrapper>
  );
}