"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeChatError = void 0;
exports.code2Session = code2Session;
const config_1 = require("./config");
class WeChatError extends Error {
    constructor(status, message, errcode) {
        super(message);
        this.status = status;
        this.errcode = errcode;
    }
}
exports.WeChatError = WeChatError;
async function code2Session(code) {
    var _a;
    const query = new URLSearchParams({
        appid: config_1.config.appId,
        secret: config_1.config.appSecret,
        js_code: code,
        grant_type: "authorization_code",
    });
    let session;
    try {
        const response = await fetch("https://api.weixin.qq.com/sns/jscode2session?" + query, {
            signal: AbortSignal.timeout(8000),
            redirect: "error",
        });
        if (!response.ok) {
            await ((_a = response.body) === null || _a === void 0 ? void 0 : _a.cancel());
            throw new Error("微信返回非成功状态");
        }
        session = await response.json();
    }
    catch (error) {
        if (error instanceof Error && error.name === "TimeoutError") {
            throw new WeChatError(504, "微信登录响应超时");
        }
        throw new WeChatError(502, "微信登录服务暂不可用");
    }
    const errcode = session === null || session === void 0 ? void 0 : session.errcode;
    if ((errcode === undefined || errcode === 0)
        && typeof (session === null || session === void 0 ? void 0 : session.openid) === "string" && /^[\w-]{1,128}$/.test(session.openid)) {
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
