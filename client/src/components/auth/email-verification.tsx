import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { useAuth } from '../../lib/auth-context';
import { AuthFormWrapper } from './auth-form-wrapper';
import { AuthLoadingDisplay } from './auth-loading-display';
import { AuthSuccessDisplay } from './auth-success-display';
import { AuthErrorDisplay } from './auth-error-display';
import { AuthButton } from './auth-button';
import type { AuthError } from '../../lib/types/auth.types';

interface EmailVerificationProps {
  token?: string;
  email?: string;
  onSuccess?: () => void;
}

type VerificationStatus = 'idle' | 'verifying' | 'success' | 'error' | 'resending' | 'resent';

export function EmailVerification({ token, email, onSuccess }: EmailVerificationProps) {
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(token ? 'verifying' : 'idle');
  const [authErrors, setAuthErrors] = useState<AuthError[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { verifyEmail, resendVerification } = useAuth();

  // Cooldown timer effect
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  useEffect(() => {
    if (token) {
      handleVerification();
    }
  }, [token]);

  const handleVerification = async () => {
    if (!token) return;

    try {
      setVerificationStatus('verifying');
      setAuthErrors([]);
      await verifyEmail(token);
      setVerificationStatus('success');
      onSuccess?.();
    } catch (error: any) {
      console.error('Email verification failed:', error);
      setVerificationStatus('error');
      
      // Extract errors from the error object if available
      if (error?.graphQLErrors?.[0]?.extensions?.errors) {
        setAuthErrors(error.graphQLErrors[0].extensions.errors);
      } else {
        setAuthErrors([{
          code: 'INVALID_TOKEN',
          message: 'Verification failed. The link may be invalid or expired.',
        }]);
      }
    }
  };

  const handleResendVerification = async () => {
    if (!email || resendCooldown > 0) return;

    try {
      setVerificationStatus('resending');
      setAuthErrors([]);
      await resendVerification(email);
      setVerificationStatus('resent');
      setResendCooldown(60); // 60 second cooldown
      
      // Reset to idle after showing success message
      setTimeout(() => {
        setVerificationStatus('idle');
      }, 3000);
    } catch (error: any) {
      console.error('Resend verification failed:', error);
      setVerificationStatus('error');
      
      // Extract errors from the error object if available
      if (error?.graphQLErrors?.[0]?.extensions?.errors) {
        setAuthErrors(error.graphQLErrors[0].extensions.errors);
      } else {
        setAuthErrors([{
          code: 'INTERNAL_ERROR',
          message: 'Failed to send verification email. Please try again.',
        }]);
      }
    }
  };

  const handleRetry = () => {
    setAuthErrors([]);
    if (token) {
      handleVerification();
    }
  };

  // Determine what to show based on status
  const isLoading = verificationStatus === 'verifying' || verificationStatus === 'resending';
  const showSuccess = verificationStatus === 'success' || verificationStatus === 'resent';
  const showErrors = verificationStatus === 'error' && authErrors.length > 0;

  const getTitle = () => {
    switch (verificationStatus) {
      case 'success':
        return 'Email Verified!';
      case 'resent':
        return 'Verification Email Sent!';
      case 'error':
        return 'Verification Failed';
      default:
        return 'Check Your Email';
    }
  };

  const getDescription = () => {
    switch (verificationStatus) {
      case 'success':
        return 'Your email has been successfully verified. You can now access all features.';
      case 'resent':
        return 'A new verification email has been sent to your inbox. Please check your email and click the verification link.';
      case 'error':
        return 'The verification link is invalid or has expired. Please request a new one.';
      default:
        return "We've sent a verification link to your email address. Please click the link to verify your account.";
    }
  };

  const getLoadingType = () => {
    return verificationStatus === 'resending' ? 'email-verification' : 'email-verification';
  };

  const getSuccessType = () => {
    return verificationStatus === 'resent' ? 'email-verification' : 'email-verification';
  };

  return (
    <AuthFormWrapper
      title={getTitle()}
      description={getDescription()}
      errors={showErrors ? authErrors : undefined}
      isLoading={isLoading}
      loadingType={getLoadingType()}
      showSuccess={showSuccess}
      successType={getSuccessType()}
      email={email}
      onRetry={handleRetry}
      onContinue={onSuccess}
    >
      {/* Content for idle state */}
      {verificationStatus === 'idle' && email && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Didn't receive the email? Check your spam folder or request a new one.
          </p>
          <AuthButton
            authType="resend"
            onClick={handleResendVerification}
            variant="outline"
            fullWidth
            disabled={resendCooldown > 0}
          >
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
          </AuthButton>
        </div>
      )}

      {/* Resend button for error state */}
      {verificationStatus === 'error' && email && (
        <AuthButton
          authType="resend"
          onClick={handleResendVerification}
          fullWidth
          disabled={resendCooldown > 0}
        >
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
        </AuthButton>
      )}
    </AuthFormWrapper>
  );
}