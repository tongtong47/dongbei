import * as fs from "fs";
import * as path from "path";
import { config } from "./config";

/** 玩家数据 */
export interface UserInfo {
    openId: string;
    nickName?: string;
    avatarUrl?: string;
    /** 最高得分 */
    score: number;
    createTime: number;
    updateTime: number;
}

/**
 * 简单的 JSON 文件存储，免数据库，直接跑起来。
 * 正式项目可替换为 MySQL / MongoDB，只需替换本文件实现。
 */
class UserStore {

    private users: { [openId: string]: UserInfo } = {};

    constructor(private file: string) {
        this.load();
    }

    private load(): void {
        try {
            if (fs.existsSync(this.file)) {
                this.users = JSON.parse(fs.readFileSync(this.file, "utf8"));
            }
        } catch (e) {
            console.error("[UserStore] 读取数据失败，使用空数据", e);
            this.users = {};
        }
    }

    private save(): void {
        try {
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            fs.writeFileSync(this.file, JSON.stringify(this.users, null, 2), "utf8");
        } catch (e) {
            console.error("[UserStore] 保存数据失败", e);
        }
    }

    get(openId: string): UserInfo | null {
        return this.users[openId] || null;
    }

    /** 首次登录时创建玩家 */
    create(openId: string, nickName?: string, avatarUrl?: string): UserInfo {
        const now = Date.now();
        const user: UserInfo = {
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
    updateProfile(openId: string, nickName?: string, avatarUrl?: string): UserInfo | null {
        const user = this.users[openId];
        if (!user) return null;
        if (nickName) user.nickName = nickName;
        if (avatarUrl) user.avatarUrl = avatarUrl;
        user.updateTime = Date.now();
        this.save();
        return user;
    }

    /** 上报分数，保留历史最高分 */
    updateScore(openId: string, score: number): UserInfo | null {
        const user = this.users[openId];
        if (!user) return null;
        if (score > user.score) user.score = score;
        user.updateTime = Date.now();
        this.save();
        return user;
    }

    /** 排行榜：按最高分倒序 */
    rank(limit: number = 20): UserInfo[] {
        return Object.keys(this.users)
            .map((k) => this.users[k])
            .sort((a, b) => b.score - a.score)
            .slice(0, limit);
    }
}

export const userStore = new UserStore(config.dataFile);
