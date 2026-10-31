import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import codegen from "vite-plugin-graphql-codegen";

// Clear stale shell-exported localhost:8080 endpoints so proxy /graphql is used
if (
	process.env.VITE_GRAPHQL_ENDPOINT &&
	process.env.VITE_GRAPHQL_ENDPOINT.includes("localhost:8080")
) {
	delete process.env.VITE_GRAPHQL_ENDPOINT;
}

export default defineConfig({
	plugins: [
		tanstackRouter({
			target: "react",
		}),
		react(),
		tailwindcss(),
		codegen(),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	optimizeDeps: {
		exclude: ["@tanstack/router-devtools"],
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks(id: string) {
					// ~1MB — split the heavy charting library
					if (id.includes("node_modules/echarts/") || id.includes("node_modules/echarts-for-react"))
						return "vendor-echarts";
					// ~500KB — TanStack router, table, virtual + sub-packages
					if (id.includes("node_modules/@tanstack/")) return "vendor-tanstack";
					// ~200KB — Apollo Client + GraphQL
					if (id.includes("@apollo/client")) return "vendor-apollo";
					// ~100KB — Radix UI primitives
					if (id.includes("node_modules/@radix-ui/")) return "vendor-radix";
					// ~300KB — TradingView widgets (source code, not node_modules)
					if (id.includes("/tradingview/")) return "vendor-tradingview";
					return undefined;
				},
			},
		},
	},
	server: {
		host: true,
		proxy: {
			"/graphql": {
				target: "http://localhost:8080",
				changeOrigin: true,
				ws: true,
			},
			"/ws": {
				target: "http://localhost:8080",
				changeOrigin: true,
				ws: true,
			},
			"/playground": {
				target: "http://localhost:8080",
				changeOrigin: true,
			},
			"/market-data": {
				target: "http://localhost:8080",
				changeOrigin: true,
			},
			"/api": {
				target: "http://localhost:8080",
				changeOrigin: true,
			},
			"/admin": {
				target: "http://localhost:8080",
				changeOrigin: true,
			},
		},
	},
});
