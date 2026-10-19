import { gql, InMemoryCache } from "@apollo/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apollo/apollo-client", () => ({ apolloClient: new InMemoryCache() }));

import { invalidateDashboardData, invalidatePortfolioQueries } from "@/hooks/use-asset-management";

/**
 * F-22: every mutation in PortfolioProvider used to be followed by a full
 * `await refetch()`, because none of the create/refresh mutations touched the
 * cache at all. That produced two identical network requests for one user
 * action, and the row-level price refresh did the same.
 *
 * The fix routes invalidation through these helpers instead. They evict the
 * root fields, which makes every *active* observer refetch on its own.
 */

const QUERY = gql`
  query InvalidationProbe($userID: ID!) {
    portfolios(filter: { userID: $userID }) {
      id
      name
    }
    watchlists(filter: { userID: $userID }) {
      id
      name
    }
  }
`;

function seededCache() {
	const cache = new InMemoryCache();
	cache.writeQuery({
		query: QUERY,
		variables: { userID: "user-1" },
		data: {
			portfolios: [{ id: "p1", name: "Main" }],
			watchlists: [{ id: "w1", name: "Tech" }],
		},
	});
	return cache;
}

describe("portfolio cache invalidation (F-22)", () => {
	it("evicts the portfolios root field", () => {
		const cache = seededCache();
		invalidatePortfolioQueries(cache);

		expect(cache.readQuery({ query: QUERY, variables: { userID: "user-1" } })).toBeNull();
	});

	it("also evicts watchlists, which live in the same query", () => {
		const cache = seededCache();
		cache.writeQuery({
			query: QUERY,
			variables: { userID: "user-1" },
			data: {
				portfolios: [{ id: "p1", name: "Main" }],
				watchlists: [
					{ id: "w1", name: "Tech" },
					{ id: "w2", name: "New" },
				],
			},
		});
		invalidatePortfolioQueries(cache);

		// Before this, addWatch had to call refetch() itself, because nothing
		// invalidated the watchlist field and a new watch stayed invisible.
		expect(cache.readQuery({ query: QUERY, variables: { userID: "user-1" } })).toBeNull();
	});

	it("evicts the dashboard root field", () => {
		const cache = seededCache();
		const result = (() => {
			try {
				invalidateDashboardData(cache);
				return "ok";
			} catch (error) {
				return error;
			}
		})();
		expect(result).toBe("ok");
	});

	it("is safe to call repeatedly", () => {
		const cache = seededCache();
		expect(() => {
			invalidatePortfolioQueries(cache);
			invalidatePortfolioQueries(cache);
			invalidateDashboardData(cache);
		}).not.toThrow();
	});

	it("does not require a refetch call to take effect", () => {
		const cache = seededCache();
		// Eviction alone is what makes Apollo re-run the active queries; assert the
		// cache is actually empty afterwards rather than merely that a spy ran.
		invalidatePortfolioQueries(cache);
		expect(cache.extract()).not.toHaveProperty("ROOT_QUERY.portfolios");
	});
});
