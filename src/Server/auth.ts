import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config";

function sign(payload: string): Buffer {
    return createHmac("sha256", config.tokenSecret).update(payload).digest();
}

/** 保留已发布客户端使用的令牌格式。 */
export function createToken(openId: string): string {
    const payload = openId + "." + (Date.now() + config.tokenExpire);
    return Buffer.from(payload + "." + sign(payload).toString("hex")).toString("base64");
}

export function parseToken(token: string): string | null {
    if (!token || token.length > 512) return null;

    const [openId, deadline, signature, extra] = Buffer.from(token, "base64").toString("utf8").split(".");
    if (extra !== undefined || !/^[\w-]{1,128}$/.test(openId) || !/^[0-9a-f]{64}$/.test(signature ?? "")) {
        return null;
    }

    const expires = Number(deadline);
    if (!Number.isSafeInteger(expires) || expires <= Date.now()) return null;

    return timingSafeEqual(sign(openId + "." + deadline), Buffer.from(signature, "hex")) ? openId : null;
}
