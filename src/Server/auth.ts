import * as crypto from "crypto";
import { config } from "./config";

/**
 * 生成登录令牌：base64(openId.过期时间戳.HMAC签名)
 * 小游戏端后续请求带上 token，服务端即可识别玩家身份。
 */
export function createToken(openId: string): string {
    const expire = Date.now() + config.tokenExpire;
    const payload = openId + "." + expire;
    const sign = crypto.createHmac("sha256", config.tokenSecret).update(payload).digest("hex");
    return Buffer.from(payload + "." + sign, "utf8").toString("base64");
}

/**
 * 校验令牌并返回 openId，无效或过期返回 null。
 */
export function parseToken(token: string): string | null {
    if (!token) return null;

    let raw = "";
    try {
        raw = Buffer.from(token, "base64").toString("utf8");
    } catch (e) {
        return null;
    }

    const parts = raw.split(".");
    if (parts.length !== 3) return null;

    const openId = parts[0];
    const expire = Number(parts[1]);
    const sign = parts[2];
    if (!openId || !expire) return null;

    const expect = crypto.createHmac("sha256", config.tokenSecret)
        .update(openId + "." + expire).digest("hex");
    if (expect !== sign) return null;

    if (Date.now() > expire) return null;

    return openId;
}
