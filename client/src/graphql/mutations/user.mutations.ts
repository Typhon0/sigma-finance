import { gql } from "@apollo/client";

export const UPDATE_USER_DISPLAY_CURRENCY_MUTATION = gql`
  mutation UpdateUserDisplayCurrency($input: UpdateUserDisplayCurrencyInput!) {
    updateUserDisplayCurrency(input: $input) {
      id
      displayCurrency
    }
  }
`;

export const UPDATE_USER_THEME_PREFERENCES_MUTATION = gql`
  mutation UpdateUserThemePreferences($input: UpdateUserThemePreferencesInput!) {
    updateUserThemePreferences(input: $input) {
      id
      themePreference
      themeBaseColor
      themeAccentColor
      themeFontPreference
      themeHeadingFont
      themeMenuAccent
      themeMenuColor
      themeStyle
      themeRadius
      themeRTL
    }
  }
`;
