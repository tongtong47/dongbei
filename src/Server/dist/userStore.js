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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("./config");
/**
 * 简单的 JSON 文件存储，免数据库，直接跑起来。
 * 正式项目可替换为 MySQL / MongoDB，只需替换本文件实现。
 */
class UserStore {
    constructor(file) {
        this.file = file;
        this.users = {};
        this.load();
    }
    load() {
        try {
            if (fs.existsSync(this.file)) {
                this.users = JSON.parse(fs.readFileSync(this.file, "utf8"));
            }
        }
        catch (e) {
            console.error("[UserStore] 读取数据失败，使用空数据", e);
            this.users = {};
        }
    }
    save() {
        try {
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            fs.writeFileSync(this.file, JSON.stringify(this.users, null, 2), "utf8");
        }
        catch (e) {
            console.error("[UserStore] 保存数据失败", e);
        }
    }
    get(openId) {
        return this.users[openId] || null;
    }
    /** 首次登录时创建玩家 */
    create(openId, nickName, avatarUrl) {
        const now = Date.now();
        const user = {
            openId: openId,
            nickName: nickName || "玩家" + openId.slice(-4),
            avatarUrl: avatarUrl || "",
            score: 0,
            createTime: now,
            updateTime: now,
        };
        this.users[openId] = user;
        this.save();
        return user;
    }
    /** 更新昵称 / 头像（有值时才覆盖） */
    updateProfile(openId, nickName, avatarUrl) {
        const user = this.users[openId];
        if (!user)
            return null;
        if (nickName)
            user.nickName = nickName;
        if (avatarUrl)
            user.avatarUrl = avatarUrl;
        user.updateTime = Date.now();
        this.save();
        return user;
    }
    /** 上报分数，保留历史最高分 */
    updateScore(openId, score) {
        const user = this.users[openId];
        if (!user)
            return null;
        if (score > user.score)
            user.score = score;
        user.updateTime = Date.now();
        this.save();
        return user;
    }
    /** 排行榜：按最高分倒序 */
    rank(limit = 20) {
        return Object.keys(this.users)
            .map((k) => this.users[k])
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
}
exports.userStore = new UserStore(config_1.config.dataFile);
