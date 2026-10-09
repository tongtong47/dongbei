import * as https from "https";
import { config } from "./config";

/** 微信 code2Session 接口返回结果 */
export interface WXSession {
    openid?: string;
    session_key?: string;
    unionid?: string;
    errcode?: number;
    errmsg?: string;
}

/**
 * 用小程序端 wx.login 得到的 code 换取 openid / session_key
 * 文档：https://developers.weixin.qq.com/miniprogram/dev/OpenApiDoc/user-login/code2Session.html
 */
export function code2Session(code: string): Promise<WXSession> {
    const url = "https://api.weixin.qq.com/sns/jscode2session"
        + "?appid=" + encodeURIComponent(config.appId)
        + "&secret=" + encodeURIComponent(config.appSecret)
        + "&js_code=" + encodeURIComponent(code)
        + "&grant_type=authorization_code";

    return new Promise<WXSession>((resolve, reject) => {
        const req = https.get(url, (res) => {
            let body = "";
            res.setEncoding("utf8");
            res.on("data", (chunk: string) => body += chunk);
            res.on("end", () => {
                try {
                    resolve(JSON.parse(body) as WXSession);
                } catch (e) {
                    reject(new Error("微信返回数据解析失败：" + body));
                }
            });
        });

        req.on("error", reject);
        req.setTimeout(10000, () => {
            req.destroy(new Error("请求微信接口超时"));
        });
    });
}
