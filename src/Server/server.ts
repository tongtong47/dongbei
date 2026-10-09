import * as http from "http";
import { URL } from "url";
import { config } from "./config";
import { code2Session } from "./wxApi";
import { createToken, parseToken } from "./auth";
import { userStore } from "./userStore";

/** 写 JSON 响应 */
function json(res: http.ServerResponse, status: number, data: any): void {
    const body = JSON.stringify(data);
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Length": Buffer.byteLength(body),
    });
    res.end(body);
}

/** 允许跨域（本地浏览器调试用，小游戏线上不受影响） */
function writeCors(res: http.ServerResponse): void {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

/** 读取请求体并解析为 JSON */
function readBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
        let raw = "";
        req.on("data", (chunk) => {
            raw += chunk;
            // 简单防超大包
            if (raw.length > 1024 * 1024) {
                reject(new Error("请求体过大"));
                req.destroy();
            }
        });
        req.on("end", () => {
            if (!raw) return resolve({});
            try {
                resolve(JSON.parse(raw));
            } catch (e) {
                resolve({});
            }
        });
        req.on("error", reject);
    });
}

/** 从 body / query / Authorization 头中取 token */
function getToken(req: http.IncomingMessage, body: any, query: URLSearchParams): string {
    if (body && body.token) return body.token;
    if (query.get("token")) return query.get("token") as string;
    const auth = req.headers["authorization"];
    if (auth && typeof auth === "string") {
        return auth.replace(/^Bearer\s+/i, "").trim();
    }
    return "";
}

const server = http.createServer(async (req, res) => {
    writeCors(res);

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url || "/", "http://localhost");
    const pathname = url.pathname;
    const query = url.searchParams;

    try {
        // 微信自动登录：POST { code, nickName?, avatarUrl? }
        if (pathname === "/api/wxlogin" && req.method === "POST") {
            const body = await readBody(req);
            const code = body && body.code;
            if (!code) {
                return json(res, 400, { error: "缺少 code" });
            }

            const session = await code2Session(code);
            if (!session.openid) {
                console.error("[wxlogin] 微信登录失败", session);
                return json(res, 401, {
                    error: session.errmsg || "微信登录失败",
                    errcode: session.errcode,
                });
            }

            const openId = session.openid;
            let user = userStore.get(openId);
            if (!user) {
                user = userStore.create(openId, body.nickName, body.avatarUrl);
            } else {
                user = userStore.updateProfile(openId, body.nickName, body.avatarUrl) || user;
            }

            const token = createToken(openId);
            console.log("[wxlogin] 登录成功 openId =", openId);

            return json(res, 200, {
                openId: openId,
                token: token,
                user: user,
            });
        }

        // 查询玩家信息：GET /api/user?token=xxx
        if (pathname === "/api/user" && req.method === "GET") {
            const openId = parseToken(getToken(req, null, query));
            if (!openId) return json(res, 401, { error: "token 无效或已过期" });

            const user = userStore.get(openId);
            if (!user) return json(res, 404, { error: "玩家不存在" });

            return json(res, 200, { user: user });
        }

        // 上报分数：POST { token, score }
        if (pathname === "/api/score" && req.method === "POST") {
            const body = await readBody(req);
            const openId = parseToken(getToken(req, body, query));
            if (!openId) return json(res, 401, { error: "token 无效或已过期" });

            const score = Number(body && body.score);
            if (isNaN(score)) return json(res, 400, { error: "score 必须是数字" });

            const user = userStore.updateScore(openId, score);
            if (!user) return json(res, 404, { error: "玩家不存在" });

            return json(res, 200, { user: user });
        }

        // 排行榜：GET /api/rank?limit=20
        if (pathname === "/api/rank" && req.method === "GET") {
            const limit = Number(query.get("limit")) || 20;
            return json(res, 200, { list: userStore.rank(limit) });
        }

        // 健康检查
        if (pathname === "/api/health") {
            return json(res, 200, { ok: true, time: Date.now() });
        }

        return json(res, 404, { error: "接口不存在：" + pathname });
    } catch (e: any) {
        console.error("[server] 处理请求异常", e);
        return json(res, 500, { error: e && e.message ? e.message : "服务器内部错误" });
    }
});

server.listen(config.port, () => {
    console.log("------------------------------------------");
    console.log("东北话小游戏服务器已启动: http://localhost:" + config.port);
    console.log("接口:");
    console.log("  POST /api/wxlogin  { code }          微信自动登录");
    console.log("  GET  /api/user     ?token=           查询玩家");
    console.log("  POST /api/score    { token, score }  上报分数");
    console.log("  GET  /api/rank     ?limit=20         排行榜");
    console.log("  小程序 appId: " + config.appId);
    console.log("------------------------------------------");
    if (config.appId.indexOf("请填写") === 0 || !/^wx/.test(config.appId)) {
        console.warn("警告：WX_APPID 未配置或格式不对（应以 wx 开头），微信登录会失败！");
    }
    if (config.appSecret.indexOf("请填写") === 0) {
        console.warn("警告：WX_APPSECRET 未配置，微信登录会失败！");
    }
});
