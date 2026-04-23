import { gql } from "@apollo/client";

export const ME_QUERY = gql`
  query Me {
    me {
      id
      email
      name
      emailVerified
      displayCurrency
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
