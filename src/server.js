import { createApp } from "./app";
import { readEnv } from "./config/env";
import serverless from "serverless-http";
let cachedApp = null;
export default {
    fetch(request, env, ctx) {
        if (!cachedApp) {
            const config = readEnv(env);
            cachedApp = createApp(config);
        }
        const handler = serverless(cachedApp);
        return handler(request, ctx);
    },
};
