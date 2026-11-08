import { gql } from "@apollo/client";

export const ADMIN_CREATE_USER = gql`
  mutation AdminCreateUser($input: AdminCreateUserInput!) {
    adminCreateUser(input: $input) {
      id
      username
      email
      role
      emailVerified
      createdAt
      updatedAt
      displayCurrency
      taxJurisdiction
      isLocked
      failedLoginCount
    }
  }
`;

export const ADMIN_UPDATE_USER = gql`
  mutation AdminUpdateUser($id: ID!, $input: AdminUpdateUserInput!) {
    adminUpdateUser(id: $id, input: $input) {
      id
      username
      email
      role
      displayCurrency
      taxJurisdiction
      updatedAt
    }
  }
`;

export const ADMIN_SET_USER_ROLE = gql`
  mutation AdminSetUserRole($id: ID!, $role: String!) {
    adminSetUserRole(id: $id, role: $role) {
      id
      role
      updatedAt
    }
  }
`;

export const ADMIN_SET_USER_LOCK = gql`
  mutation AdminSetUserLock($id: ID!, $locked: Boolean!, $lockUntil: Time) {
    adminSetUserLock(id: $id, locked: $locked, lockUntil: $lockUntil) {
      id
      lockedUntil
      isLocked
      failedLoginCount
      updatedAt
    }
  }
`;

export const ADMIN_SET_USER_PASSWORD = gql`
  mutation AdminSetUserPassword($id: ID!, $password: String!) {
    adminSetUserPassword(id: $id, password: $password)
  }
`;

export const ADMIN_SET_USER_EMAIL_VERIFIED = gql`
  mutation AdminSetUserEmailVerified($id: ID!, $verified: Boolean!) {
    adminSetUserEmailVerified(id: $id, verified: $verified) {
      id
      emailVerified
      updatedAt
    }
  }
`;

export const ADMIN_DELETE_USER = gql`
  mutation AdminDeleteUser($id: ID!, $hardDelete: Boolean! = false) {
    adminDeleteUser(id: $id, hardDelete: $hardDelete)
  }
`;

