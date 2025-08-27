import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
	schema: "../server/internal/handler/graphql/schema/*.graphqls",
	documents: ['src/**/*.tsx', 'src/**/*.ts'],
	generates: {
		"./src/gql/": {
			preset: "client",
		},
	},
};

export default config;
