import { type ApolloCache, type NormalizedCacheObject, useMutation } from "@apollo/client";
import { UPDATE_USER_DISPLAY_CURRENCY_MUTATION } from "../graphql/mutations/user.mutations";
import { ME_QUERY } from "../graphql/queries/auth.queries";
import type { AuthUser } from "../lib/types/auth.types";

interface UpdateUserDisplayCurrencyInput {
  displayCurrency: string;
}

interface User {
  id: string;
  displayCurrency: string;
}

interface UpdateUserDisplayCurrencyResponse {
  updateUserDisplayCurrency: User;
}

/**
 * After a successful mutation, write the new displayCurrency into the
 * Apollo cache for the ME_QUERY so that use-auth.ts (which reads
 * `data?.me || authContext.user`) sees the updated value immediately
 * without a full refetch.
 */
function updateMeCache(
  cache: ApolloCache<NormalizedCacheObject>,
  result: UpdateUserDisplayCurrencyResponse,
) {
  const { updateUserDisplayCurrency } = result;
  if (!updateUserDisplayCurrency) return;

  // Read the current cached me query (if any)
  const cached = cache.readQuery<{ me: AuthUser }>({ query: ME_QUERY });
  if (!cached?.me) return;

  cache.writeQuery({
    query: ME_QUERY,
    data: {
      me: {
        ...cached.me,
        displayCurrency: updateUserDisplayCurrency.displayCurrency,
      },
    },
  });
}

export const useUpdateDisplayCurrencyMutation = () => {
  return useMutation<
    UpdateUserDisplayCurrencyResponse,
    { input: UpdateUserDisplayCurrencyInput }
  >(UPDATE_USER_DISPLAY_CURRENCY_MUTATION, {
    update: (cache, { data }) => {
      if (data) updateMeCache(cache, data);
    },
  });
};
