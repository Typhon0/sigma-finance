import { CheckCircle, Mail, Shield, Key, UserCheck } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Button } from '../ui/button';

interface AuthSuccessDisplayProps {
  type: 'registration' | 'login' | 'logout' | 'password-reset' | 'email-verification' | 'password-change';
  message?: string;
  email?: string;
  onContinue?: () => void;
  onResendEmail?: () => void;
  className?: string;
}

export function AuthSuccessDisplay({ 
  type, 
  message, 
  email,
  onContinue,
  onResendEmail,
  className 
}: AuthSuccessDisplayProps) {
  const getSuccessIcon = () => {
    switch (type) {
      case 'registration':
        return <UserCheck className="h-4 w-4" />;
      case 'login':
        return <CheckCircle className="h-4 w-4" />;
      case 'logout':
        return <Shield className="h-4 w-4" />;
      case 'password-reset':
      case 'password-change':
        return <Key className="h-4 w-4" />;
      case 'email-verification':
        return <Mail className="h-4 w-4" />;
      default:
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getSuccessTitle = () => {
    switch (type) {
      case 'registration':
        return 'Account Created Successfully!';
      case 'login':
        return 'Welcome Back!';
      case 'logout':
        return 'Logged Out Successfully';
      case 'password-reset':
        return 'Reset Link Sent!';
      case 'password-change':
        return 'Password Updated!';
      case 'email-verification':
        return 'Email Verified!';
      default:
        return 'Success!';
    }
  };

  const getDefaultMessage = () => {
    switch (type) {
      case 'registration':
        return email 
          ? `A verification email has been sent to ${email}. Please check your inbox and click the verification link to complete your registration.`
          : 'Your account has been created. Please check your email for verification instructions.';
      case 'login':
        return 'You have been successfully logged in. Redirecting to your dashboard...';
      case 'logout':
        return 'You have been safely logged out of your account.';
      case 'password-reset':
        return email
          ? `A password reset link has been sent to ${email}. Please check your inbox and follow the instructions to reset your password.`
          : 'A password reset link has been sent to your email address.';
      case 'password-change':
        return 'Your password has been successfully updated. You can now use your new password to log in.';
      case 'email-verification':
        return 'Your email address has been successfully verified. You now have full access to your account.';
      default:
        return 'Operation completed successfully.';
    }
  };

  const showResendOption = type === 'registration' || type === 'password-reset';

  return (
    <Alert 
      variant="success" 
      className={className}
      role="alert"
      aria-live="polite"
    >
      {getSuccessIcon()}
      <AlertTitle>{getSuccessTitle()}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>{message || getDefaultMessage()}</p>
        
        {type === 'registration' && (
          <div className="text-sm space-y-1">
            <p className="font-medium">Next steps:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Check your email inbox (and spam folder)</li>
              <li>Click the verification link in the email</li>
              <li>Return here to log in with your new account</li>
            </ul>
          </div>
        )}

        {type === 'password-reset' && (
          <div className="text-sm space-y-1">
            <p className="font-medium">Important:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>The reset link will expire in 1 hour</li>
              <li>Check your spam folder if you don't see the email</li>
              <li>You can request a new link if needed</li>
            </ul>
          </div>
        )}

        <div className="flex gap-2 mt-3">
          {showResendOption && onResendEmail && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResendEmail}
              className="h-8"
            >
              Resend Email
            </Button>
          )}
          
          {onContinue && (
            <Button
              size="sm"
              onClick={onContinue}
              className="h-8"
            >
              Continue
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}