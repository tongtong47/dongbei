"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const http = __importStar(require("node:http"));
const config_1 = require("./config");
const wxApi_1 = require("./wxApi");
const auth_1 = require("./auth");
const userStore_1 = require("./userStore");
const maxBodyBytes = 8192;
const maxConcurrentLogins = 16;
let pendingLogins = 0;
class RequestError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
function json(res, status, data) {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
    });
    res.end(body);
}
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let bytes = 0;
        req.on("error", reject);
        req.on("data", (chunk) => {
            bytes += chunk.length;
            if (bytes > maxBodyBytes) {
                chunks.length = 0;
                reject(new RequestError(413, "请求体过大"));
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => {
            if (bytes > maxBodyBytes)
                return;
            try {
                const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
                if (!data || typeof data !== "object" || Array.isArray(data))
                    throw new Error();
                resolve(data);
            }
            catch (_a) {
                reject(new RequestError(400, "请求体必须是 JSON 对象"));
            }
        });
    });
}
function getToken(req, query, body) {
    var _a, _b, _c;
    if (req.headers.authorization) {
        return (_b = (_a = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization)) === null || _a === void 0 ? void 0 : _a[1]) !== null && _b !== void 0 ? _b : "";
    }
    if ((body === null || body === void 0 ? void 0 : body.token) !== undefined)
        return typeof body.token === "string" ? body.token : "";
    return (_c = query.get("token")) !== null && _c !== void 0 ? _c : "";
}
function optionalString(value, maxLength, field) {
    if (value === undefined)
        return undefined;
    if (typeof value !== "string" || value.length > maxLength) {
        throw new RequestError(400, field + " 格式不正确");
    }
    return value.trim() || undefined;
}
function validAvatar(value) {
    if (!value)
        return true;
    const url = URL.parse(value);
    return (url === null || url === void 0 ? void 0 : url.protocol) === "https:" && !url.username && !url.password;
}
const methods = new Map([
    ["/api/wxlogin", "POST"],
    ["/api/user", "GET"],
    ["/api/score", "POST"],
    ["/api/rank", "GET"],
    ["/api/health", "GET"],
]);
const server = http.createServer({
    maxHeaderSize: 8192,
    headersTimeout: 10000,
    requestTimeout: 15000,
    connectionsCheckingInterval: 1000,
}, async (req, res) => {
    var _a, _b;
    res.setHeader("Vary", "Origin");
    const origin = req.headers.origin;
    if (origin && config_1.config.corsOrigins.has(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    }
    try {
        const url = URL.parse(req.url || "/", "http://localhost");
        if (!url)
            throw new RequestError(400, "请求地址无效");
        const { pathname, searchParams } = url;
        const method = methods.get(pathname);
        if (!method)
            throw new RequestError(404, "接口不存在");
        if (req.method === "OPTIONS") {
            res.writeHead(204).end();
            return;
        }
        if (req.method !== method) {
            res.setHeader("Allow", method + ", OPTIONS");
            throw new RequestError(405, "请求方法不支持");
        }
        if (method === "POST" && Number(req.headers["content-length"]) > maxBodyBytes) {
            throw new RequestError(413, "请求体过大");
        }
        switch (pathname) {
            case "/api/wxlogin": {
                const body = await readBody(req);
                const code = optionalString(body.code, 256, "code");
                if (!code)
                    throw new RequestError(400, "缺少 code");
                const nickName = optionalString(body.nickName, 64, "nickName");
                const avatarUrl = optionalString(body.avatarUrl, 2048, "avatarUrl");
                if (!validAvatar(avatarUrl))
                    throw new RequestError(400, "avatarUrl 必须为 HTTPS 地址");
                if (pendingLogins >= maxConcurrentLogins)
                    throw new RequestError(503, "登录繁忙，请稍后重试");
                pendingLogins++;
                try {
                    const openId = await (0, wxApi_1.code2Session)(code);
                    const user = userStore_1.userStore.login(openId, nickName, avatarUrl);
                    return json(res, 200, { openId, token: (0, auth_1.createToken)(openId), user });
                }
                finally {
                    pendingLogins--;
                }
            }
            case "/api/user":
            case "/api/score": {
                const body = method === "POST" ? await readBody(req) : undefined;
                const openId = (0, auth_1.parseToken)(getToken(req, searchParams, body));
                if (!openId)
                    throw new RequestError(401, "token 无效或已过期");
                let user = userStore_1.userStore.get(openId);
                if (body) {
                    const score = body.score;
                    if (typeof score !== "number" || !Number.isSafeInteger(score) || score < 0) {
                        throw new RequestError(400, "score 必须是非负安全整数");
                    }
                    user = userStore_1.userStore.updateScore(openId, score);
                }
                if (!user)
                    throw new RequestError(404, "玩家不存在");
                return json(res, 200, { user });
            }
            case "/api/rank": {
                const raw = (_a = searchParams.get("limit")) !== null && _a !== void 0 ? _a : "20";
                if (!/^\d+$/.test(raw) || Number(raw) < 1) {
                    throw new RequestError(400, "limit 必须为正整数");
                }
                return json(res, 200, { list: userStore_1.userStore.rank(Math.min(100, Number(raw))) });
            }
            case "/api/health":
                return json(res, 200, { ok: true, time: Date.now() });
        }
    }
    catch (error) {
        if (error instanceof wxApi_1.WeChatError) {
            if (error.status >= 500)
                console.error("[wxlogin]", error.status, (_b = error.errcode) !== null && _b !== void 0 ? _b : "");
            return json(res, error.status, { error: error.message, errcode: error.errcode });
        }
        if (error instanceof RequestError) {
            if (error.status === 413)
                res.setHeader("Connection", "close");
            return json(res, error.status, { error: error.message });
        }
        console.error("[server] 请求处理失败", error);
        if (!res.destroyed)
            return json(res, 500, { error: "服务器内部错误" });
    }
});
server.listen(config_1.config.port, config_1.config.host, () => {
    console.log("[server] 东北话小游戏后端已启动", server.address());
});
function shutdown() {
    server.close((error) => {
        if (error)
            process.exitCode = 1;
    });
    setTimeout(() => server.closeAllConnections(), 15000).unref();
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
