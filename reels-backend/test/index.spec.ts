import {
	env,
	createExecutionContext,
	waitOnExecutionContext,
	SELF,
} from "cloudflare:test";
import { describe, it, expect } from "vitest";
import worker from "../src";

const UUID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

async function fetchUnit(pathname: string, init?: RequestInit): Promise<Response> {
	const request = new Request<unknown, IncomingRequestCfProperties>(
		`http://example.com${pathname}`,
		init
	);
	const ctx = createExecutionContext();
	const response = await worker.fetch(request, env, ctx);
	await waitOnExecutionContext(ctx);
	return response;
}

describe("reels backend worker", () => {
	describe("request for /api/message", () => {
		it('responds with "Hello, World!" (unit style)', async () => {
			const response = await fetchUnit("/api/message");

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toContain("text/plain");
			expect(await response.text()).toMatchInlineSnapshot(`"Hello, World!"`);
		});

		it('responds with "Hello, World!" (integration style)', async () => {
			const response = await SELF.fetch("http://example.com/api/message");

			expect(response.status).toBe(200);
			expect(await response.text()).toMatchInlineSnapshot(`"Hello, World!"`);
		});
	});

	describe("request for /api/random", () => {
		it("responds with a random UUID JSON payload (unit style)", async () => {
			const response = await fetchUnit("/api/random");
			const body = await response.json<{ id: string }>();

			expect(response.status).toBe(200);
			expect(response.headers.get("Content-Type")).toContain("application/json");
			expect(body.id).toMatch(UUID_PATTERN);
		});

		it("responds with a random UUID JSON payload (integration style)", async () => {
			const response = await SELF.fetch("http://example.com/api/random");
			const body = await response.json<{ id: string }>();

			expect(response.status).toBe(200);
			expect(body.id).toMatch(UUID_PATTERN);
		});
	});

	describe("request routing", () => {
		it("supports health checks", async () => {
			const response = await fetchUnit("/api/health");

			expect(response.status).toBe(200);
			expect(await response.json()).toEqual({ status: "ok" });
		});

		it("returns a JSON 404 for unknown API routes", async () => {
			const response = await fetchUnit("/missing");

			expect(response.status).toBe(404);
			expect(await response.json()).toEqual({
				error: "Not Found",
				pathname: "/missing",
			});
		});

		it("rejects unsupported methods with an Allow header", async () => {
			const response = await fetchUnit("/api/message", { method: "POST" });

			expect(response.status).toBe(405);
			expect(response.headers.get("Allow")).toBe("GET, HEAD, OPTIONS");
			expect(await response.json()).toEqual({
				error: "Method Not Allowed",
				allowedMethods: ["GET", "HEAD", "OPTIONS"],
			});
		});
	});
});
