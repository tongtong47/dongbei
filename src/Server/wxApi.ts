import { config } from "./config";

export class WeChatError extends Error {
    constructor(public readonly status: number, message: string, public readonly errcode?: number) {
        super(message);
    }
}

export async function code2Session(code: string): Promise<string> {
    const query = new URLSearchParams({
        appid: config.appId,
        secret: config.appSecret,
        js_code: code,
        grant_type: "authorization_code",
    });

    let session: { openid?: unknown; errcode?: unknown } | null;
    try {
        const response = await fetch("https://api.weixin.qq.com/sns/jscode2session?" + query, {
            signal: AbortSignal.timeout(8000),
            redirect: "error",
        });
        if (!response.ok) {
            await response.body?.cancel();
            throw new Error("微信返回非成功状态");
        }
        session = await response.json() as typeof session;
    } catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
            throw new WeChatError(504, "微信登录响应超时");
        }
        throw new WeChatError(502, "微信登录服务暂不可用");
    }

    const errcode = session?.errcode;
    if ((errcode === undefined || errcode === 0)
        && typeof session?.openid === "string" && /^[\w-]{1,128}$/.test(session.openid)) {
        return session.openid;
    }
    if (errcode === 40029 || errcode === 40163) {
        throw new WeChatError(401, "微信登录凭证无效或已使用", errcode);
    }
    if (errcode === 45011 || errcode === 40226) {
        throw new WeChatError(429, "微信登录受限，请稍后重试", errcode);
    }
    throw new WeChatError(502, "微信登录服务暂不可用", typeof errcode === "number" ? errcode : undefined);
}
