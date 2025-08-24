import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
	schema: "http://localhost:8080/graphql",
	documents: [
		"src/lib/graphql/**/*.ts",
		"src/hooks/**/*.ts",
		"src/pages/**/*.tsx",
	],
	generates: {
		"./src/gql/": {
			preset: "client",
		},
	},
};

export default config;
