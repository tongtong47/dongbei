import * as path from "path";

/**
 * 服务器配置。
 * 优先读取环境变量，方便部署时不用改代码：
 *   set WX_APPID=wx8fec68b66de58908
 *   set WX_APPSECRET=XXXXXXXX
 *   set PORT=3000
 */
export const config = {
    /** HTTP 监听端口 */
    port: Number(process.env.PORT || 3000),

    /** 微信小程序 appId（微信公众平台 -> 开发管理 -> 开发设置） */
    appId: process.env.WX_APPID || "wx8fec68b66de58908",

    /** 微信小程序 appSecret（也可不写死，用环境变量 WX_APPSECRET 注入） */
    appSecret: process.env.WX_APPSECRET || "0f9c1387befc890374b158465967776d",

    /** 登录令牌签名密钥，线上请改成自己的随机字符串 */
    tokenSecret: process.env.TOKEN_SECRET || "dongbei_laya_secret",

    /** 登录令牌有效期（毫秒），默认 7 天 */
    tokenExpire: 7 * 24 * 60 * 60 * 1000,

    /** 用户数据文件（JSON 文件存储，无需数据库） */
    dataFile: process.env.DATA_FILE || path.join(__dirname, "data", "users.json"),
};
