import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
	schema: "http://localhost:8080/graphql",
	documents: ["src/**/*.{ts,tsx,graphql,gql}"],
	generates: {
		"./src/gql/": {
			preset: "client",
		},
	},
};

export default config;
