"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createToken = createToken;
exports.parseToken = parseToken;
const node_crypto_1 = require("node:crypto");
const config_1 = require("./config");
function sign(payload) {
    return (0, node_crypto_1.createHmac)("sha256", config_1.config.tokenSecret).update(payload).digest();
}
/** 保留已发布客户端使用的令牌格式。 */
function createToken(openId) {
    const payload = openId + "." + (Date.now() + config_1.config.tokenExpire);
    return Buffer.from(payload + "." + sign(payload).toString("hex")).toString("base64");
}
function parseToken(token) {
    if (!token || token.length > 512)
        return null;
    const [openId, deadline, signature, extra] = Buffer.from(token, "base64").toString("utf8").split(".");
    if (extra !== undefined || !/^[\w-]{1,128}$/.test(openId) || !/^[0-9a-f]{64}$/.test(signature !== null && signature !== void 0 ? signature : "")) {
        return null;
    }
    const expires = Number(deadline);
    if (!Number.isSafeInteger(expires) || expires <= Date.now())
        return null;
    return (0, node_crypto_1.timingSafeEqual)(sign(openId + "." + deadline), Buffer.from(signature, "hex")) ? openId : null;
}
