import arkenv from "arkenv";

export const env = arkenv({
	NODE_ENV: "'development' | 'production' = 'production'",
	DATABASE_URL: "string.url | string",
	ENCRYPTION_KEY: "string",
	ENCRYPTION_IV: "string",
});
