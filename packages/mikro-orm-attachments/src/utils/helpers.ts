import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export async function use(module: string) {
	try {
		const result = await import(module);

		if (result.default) {
			return result.default;
		}

		return result;
	} catch (err) {
		console.error(err);
		throw new Error(`Module ${module} not found, please install it first.`);
	}
}

export function resolveModule<T>(candidates: string[]): T {
	for (const candidate of candidates) {
		try {
			return require(candidate) as T;
		} catch {}
	}

	throw new Error(`Could not resolve any of the following modules: ${candidates.join(", ")}`);
}
