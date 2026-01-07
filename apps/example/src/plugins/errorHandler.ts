import Elysia, { ValidationError } from "elysia";

export const errorHandler = new Elysia({ name: "globalErrorHandler" }).onError(
	{ as: "global" },
	function globalErrorHandler({ error, code, set }) {
		if (error instanceof ValidationError) {
			return {
				code: 10001,
				message: error.customError,
				details: error,
			};
		}
		if (code === 401) {
			return {
				code: 401,
				message: "Unauthorized :(",
			};
		}

		return error;
	}
);
