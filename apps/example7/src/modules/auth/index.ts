import { Elysia, t } from "elysia";
import { authService, AuthService } from "./Auth.service";
import { errorHandler } from "../../plugins/errorHandler";
import cron from "@elysiajs/cron";

export const auth = new Elysia()
	.use(errorHandler)
	.use(authService)
	.use(
		cron({
			name: "testt",
			pattern: "0 0 0 * * *",
			async run() {
				console.log("cronjob started");
			},
		})
	)
	.macro({
		isSignedIn: {
			async resolve({ status }) {
				if (Math.random() > 0.5) {
					return status(401);
				}
				return {
					user: {
						id: 1,
					},
				};
			},
		},
	})
	.get(
		"/test",
		({
			store: {
				cron: { testt },
			},
		}) => {
			testt.trigger();
			throw new Error("test error");
		}
	)
	.post(
		"/login",
		async ({ body, auth }) => {
			const result = auth.login(body.email, body.password);
			return result;
		},
		{
			body: t.Object({
				email: t.String(),
				password: t.String(),
			}),
			detail: {
				description: "Login to the system",
				tags: ["auth", "public"],
				summary: "Login to the system",
				responses: {
					"200": {
						description: "Login successful",
						content: t.Boolean(),
					},
				},
			},
			isSignedIn: true,
		}
	);
