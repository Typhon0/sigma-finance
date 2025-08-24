import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import codegen from "vite-plugin-graphql-codegen";

export default defineConfig({
	plugins: [
		react(),
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
		}),
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
});
