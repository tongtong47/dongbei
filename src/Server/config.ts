import * as path from "node:path";

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT 必须为 1–65535 的整数");
}

const appId = process.env.WX_APPID?.trim() ?? "";
const appSecret = process.env.WX_APPSECRET?.trim() ?? "";
const tokenSecret = process.env.TOKEN_SECRET ?? "";

if (!/^wx[0-9a-f]{16}$/i.test(appId)) {
    throw new Error("请配置有效的 WX_APPID");
}
if (!/^[0-9a-f]{32}$/i.test(appSecret)) {
    throw new Error("请配置有效的 WX_APPSECRET");
}
if (Buffer.byteLength(tokenSecret.trim()) < 32) {
    throw new Error("请配置至少 32 字节的随机 TOKEN_SECRET");
}

export const config = {
    host: process.env.HOST || "127.0.0.1",
    port,
    appId,
    appSecret,
    tokenSecret,
    tokenExpire: 7 * 24 * 60 * 60 * 1000,
    dataFile: process.env.DATA_FILE || path.join(__dirname, "data", "users.json"),
    corsOrigins: new Set((process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean)),
};
