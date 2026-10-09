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
exports.createToken = createToken;
exports.parseToken = parseToken;
const crypto = __importStar(require("crypto"));
const config_1 = require("./config");
/**
 * 生成登录令牌：base64(openId.过期时间戳.HMAC签名)
 * 小游戏端后续请求带上 token，服务端即可识别玩家身份。
 */
function createToken(openId) {
    const expire = Date.now() + config_1.config.tokenExpire;
    const payload = openId + "." + expire;
    const sign = crypto.createHmac("sha256", config_1.config.tokenSecret).update(payload).digest("hex");
    return Buffer.from(payload + "." + sign, "utf8").toString("base64");
}
/**
 * 校验令牌并返回 openId，无效或过期返回 null。
 */
function parseToken(token) {
    if (!token)
        return null;
    let raw = "";
    try {
        raw = Buffer.from(token, "base64").toString("utf8");
    }
    catch (e) {
        return null;
    }
    const parts = raw.split(".");
    if (parts.length !== 3)
        return null;
    const openId = parts[0];
    const expire = Number(parts[1]);
    const sign = parts[2];
    if (!openId || !expire)
        return null;
    const expect = crypto.createHmac("sha256", config_1.config.tokenSecret)
        .update(openId + "." + expire).digest("hex");
    if (expect !== sign)
        return null;
    if (Date.now() > expire)
        return null;
    return openId;
}
