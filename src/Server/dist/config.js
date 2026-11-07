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
var _a, _b, _c, _d, _e, _f;
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
const path = __importStar(require("node:path"));
const port = Number((_a = process.env.PORT) !== null && _a !== void 0 ? _a : 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT 必须为 1–65535 的整数");
}
const appId = (_c = (_b = process.env.WX_APPID) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : "";
const appSecret = (_e = (_d = process.env.WX_APPSECRET) === null || _d === void 0 ? void 0 : _d.trim()) !== null && _e !== void 0 ? _e : "";
const tokenSecret = (_f = process.env.TOKEN_SECRET) !== null && _f !== void 0 ? _f : "";
if (!/^wx[0-9a-f]{16}$/i.test(appId)) {
    throw new Error("请配置有效的 WX_APPID");
}
if (!/^[0-9a-f]{32}$/i.test(appSecret)) {
    throw new Error("请配置有效的 WX_APPSECRET");
}
if (Buffer.byteLength(tokenSecret.trim()) < 32) {
    throw new Error("请配置至少 32 字节的随机 TOKEN_SECRET");
}
exports.config = {
    host: process.env.HOST || "127.0.0.1",
    port,
    appId,
    appSecret,
    tokenSecret,
    tokenExpire: 7 * 24 * 60 * 60 * 1000,
    dataFile: process.env.DATA_FILE || path.join(__dirname, "data", "users.json"),
    corsOrigins: new Set((process.env.CORS_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean)),
};
