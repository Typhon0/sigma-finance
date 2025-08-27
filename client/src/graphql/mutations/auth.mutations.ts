import { gql } from '@apollo/client';

export const REGISTER_MUTATION = gql`
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      success
      data {
        token
        refreshToken
        expiresAt
        user {
          id
          email
          name
          emailVerified
        }
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      success
      data {
        token
        refreshToken
        expiresAt
        user {
          id
          email
          name
          emailVerified
        }
      }
      errors {
        code
        message
        field
      }
    }
  }
`;

export const LOGOUT_MUTATION = gql`
  mutation Logout($input: LogoutInput!) {
    logout(input: $input) {
      success
      errors {
        code
        message
        field
      }
    }
  }
`;

export const RESET_PASSWORD_MUTATION = gql`
  mutation ResetPassword($input: PasswordResetInput!) {
    resetPassword(input: $input) {
      success
      errors {
        code
        message
        field
      }
    }
  }
`;

export const CONFIRM_PASSWORD_RESET_MUTATION = gql`
  mutation ConfirmPasswordReset($input: PasswordResetConfirmInput!) {
    confirmPasswordReset(input: $input) {
      success
      errors {
        code
        message
        field
      }
    }
  }
`;

export const VERIFY_EMAIL_MUTATION = gql`
  mutation VerifyEmail($input: EmailVerificationInput!) {
    verifyEmail(input: $input) {
      success
      errors {
        code
        message
        field
      }
    }
  }
`;

export const RESEND_VERIFICATION_MUTATION = gql`
  mutation ResendVerification($input: ResendVerificationInput!) {
    resendVerification(input: $input) {
      success
      errors {
        code
        message
        field
      }
    }
  }
`;

export const REFRESH_TOKEN_MUTATION = gql`
  mutation RefreshToken($input: RefreshTokenInput!) {
    refreshToken(input: $input) {
      success
      data {
        token
        refreshToken
        expiresAt
        user {
          id
          email
          name
          emailVerified
        }
      }
      errors {
        code
        message
        field
      }
    }
  }
`;