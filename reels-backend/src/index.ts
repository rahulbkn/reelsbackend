interface Env {}

type WorkerFetchHandler<Environment> = (
	request: Request,
	env: Environment,
	ctx: unknown
) => Response | Promise<Response>;

type WorkerExportedHandler<Environment> = {
	fetch: WorkerFetchHandler<Environment>;
};

const JSON_HEADERS = {
	"Content-Type": "application/json; charset=utf-8",
	"Cache-Control": "no-store",
};

const TEXT_HEADERS = {
	"Content-Type": "text/plain; charset=utf-8",
	"Cache-Control": "no-store",
};

function jsonResponse(body: unknown, init?: ResponseInit): Response {
	return new Response(JSON.stringify(body), {
		...init,
		headers: {
			...JSON_HEADERS,
			...init?.headers,
		},
	});
}

function methodNotAllowed(allowedMethods: string[]): Response {
	return jsonResponse(
		{ error: "Method Not Allowed", allowedMethods },
		{
			status: 405,
			headers: { Allow: allowedMethods.join(", ") },
		}
	);
}

function notFound(pathname: string): Response {
	return jsonResponse(
		{ error: "Not Found", pathname },
		{ status: 404 }
	);
}

function handleCorsPreflight(): Response {
	return new Response(null, {
		status: 204,
		headers: {
			Allow: "GET, HEAD, OPTIONS",
			"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Max-Age": "86400",
		},
	});
}

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (request.method === "OPTIONS") {
			return handleCorsPreflight();
		}

		if (request.method !== "GET" && request.method !== "HEAD") {
			return methodNotAllowed(["GET", "HEAD", "OPTIONS"]);
		}

		switch (url.pathname) {
			case "/health":
			case "/api/health":
				return jsonResponse({ status: "ok" });
			case "/message":
			case "/api/message":
				return new Response("Hello, World!", { headers: TEXT_HEADERS });
			case "/random":
			case "/api/random":
				return jsonResponse({ id: crypto.randomUUID() });
			default:
				return notFound(url.pathname);
		}
	},
} satisfies WorkerExportedHandler<Env>;
