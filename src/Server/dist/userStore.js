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
exports.userStore = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const node_crypto_1 = require("node:crypto");
const config_1 = require("./config");
function isUser(value, openId) {
    if (!value || typeof value !== "object")
        return false;
    const user = value;
    return user.openId === openId
        && /^[\w-]{1,128}$/.test(openId)
        && (user.nickName === undefined || typeof user.nickName === "string")
        && (user.avatarUrl === undefined || typeof user.avatarUrl === "string")
        && typeof user.score === "number" && Number.isFinite(user.score) && user.score >= 0
        && Number.isSafeInteger(user.createTime) && Number.isSafeInteger(user.updateTime);
}
/** 单进程存储。保留原有 JSON 格式，写入失败时保留上一份完整存档。 */
class UserStore {
    constructor(file) {
        this.file = file;
        this.users = Object.create(null);
        const dir = path.dirname(file);
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        fs.accessSync(dir, fs.constants.W_OK);
        let raw;
        try {
            raw = fs.readFileSync(file, "utf8");
        }
        catch (error) {
            if (error.code !== "ENOENT")
                throw error;
            this.save(this.users);
            return;
        }
        let data;
        try {
            data = JSON.parse(raw.replace(/^\uFEFF/, ""));
        }
        catch (_a) {
            throw new Error("用户存档不是有效的 JSON");
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("用户存档格式无效");
        }
        for (const [openId, user] of Object.entries(data)) {
            if (!isUser(user, openId))
                throw new Error("用户存档包含无效记录");
            this.users[openId] = user;
        }
    }
    save(users) {
        const temporary = this.file + "." + (0, node_crypto_1.randomUUID)() + ".tmp";
        try {
            const descriptor = fs.openSync(temporary, "wx", 0o600);
            try {
                fs.writeFileSync(descriptor, JSON.stringify(users, null, 2), "utf8");
                fs.fsyncSync(descriptor);
            }
            finally {
                fs.closeSync(descriptor);
            }
            fs.renameSync(temporary, this.file);
        }
        finally {
            fs.rmSync(temporary, { force: true });
        }
    }
    put(user) {
        const next = Object.assign(Object.create(null), this.users);
        next[user.openId] = user;
        this.save(next);
        this.users = next;
        return user;
    }
    get(openId) {
        var _a;
        return (_a = this.users[openId]) !== null && _a !== void 0 ? _a : null;
    }
    login(openId, nickName, avatarUrl) {
        const current = this.get(openId);
        if (current) {
            const name = nickName || current.nickName;
            const avatar = avatarUrl || current.avatarUrl;
            if (name === current.nickName && avatar === current.avatarUrl)
                return current;
            return this.put({ ...current, nickName: name, avatarUrl: avatar, updateTime: Date.now() });
        }
        const now = Date.now();
        return this.put({
            openId,
            nickName: nickName || "玩家" + openId.slice(-4),
            avatarUrl: avatarUrl || "",
            score: 0,
            createTime: now,
            updateTime: now,
        });
    }
    updateScore(openId, score) {
        const user = this.get(openId);
        if (!user || score <= user.score)
            return user;
        return this.put({ ...user, score, updateTime: Date.now() });
    }
    rank(limit) {
        return Object.values(this.users)
            .sort((a, b) => b.score - a.score || a.createTime - b.createTime || a.openId.localeCompare(b.openId))
            .slice(0, limit)
            .map(({ nickName, avatarUrl, score }) => ({ nickName, avatarUrl, score }));
    }
}
exports.userStore = new UserStore(config_1.config.dataFile);
