import * as fs from "node:fs";
import * as path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config";

export interface UserInfo {
    openId: string;
    nickName?: string;
    avatarUrl?: string;
    score: number;
    createTime: number;
    updateTime: number;
}

function isUser(value: unknown, openId: string): value is UserInfo {
    if (!value || typeof value !== "object") return false;
    const user = value as Partial<UserInfo>;
    return user.openId === openId
        && /^[\w-]{1,128}$/.test(openId)
        && (user.nickName === undefined || typeof user.nickName === "string")
        && (user.avatarUrl === undefined || typeof user.avatarUrl === "string")
        && typeof user.score === "number" && Number.isFinite(user.score) && user.score >= 0
        && Number.isSafeInteger(user.createTime) && Number.isSafeInteger(user.updateTime);
}

/** 单进程存储。保留原有 JSON 格式，写入失败时保留上一份完整存档。 */
class UserStore {
    private users: Record<string, UserInfo> = Object.create(null);

    constructor(private readonly file: string) {
        const dir = path.dirname(file);
        fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
        fs.accessSync(dir, fs.constants.W_OK);

        let raw: string;
        try {
            raw = fs.readFileSync(file, "utf8");
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
            this.save(this.users);
            return;
        }

        let data: unknown;
        try {
            data = JSON.parse(raw.replace(/^\uFEFF/, ""));
        } catch {
            throw new Error("用户存档不是有效的 JSON");
        }
        if (!data || typeof data !== "object" || Array.isArray(data)) {
            throw new Error("用户存档格式无效");
        }
        for (const [openId, user] of Object.entries(data)) {
            if (!isUser(user, openId)) throw new Error("用户存档包含无效记录");
            this.users[openId] = user;
        }
    }

    private save(users: Record<string, UserInfo>): void {
        const temporary = this.file + "." + randomUUID() + ".tmp";
        try {
            const descriptor = fs.openSync(temporary, "wx", 0o600);
            try {
                fs.writeFileSync(descriptor, JSON.stringify(users, null, 2), "utf8");
                fs.fsyncSync(descriptor);
            } finally {
                fs.closeSync(descriptor);
            }
            fs.renameSync(temporary, this.file);
        } finally {
            fs.rmSync(temporary, { force: true });
        }
    }

    private put(user: UserInfo): UserInfo {
        const next = Object.assign(Object.create(null), this.users);
        next[user.openId] = user;
        this.save(next);
        this.users = next;
        return user;
    }

    get(openId: string): UserInfo | null {
        return this.users[openId] ?? null;
    }

    login(openId: string, nickName?: string, avatarUrl?: string): UserInfo {
        const current = this.get(openId);
        if (current) {
            const name = nickName || current.nickName;
            const avatar = avatarUrl || current.avatarUrl;
            if (name === current.nickName && avatar === current.avatarUrl) return current;
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

    updateScore(openId: string, score: number): UserInfo | null {
        const user = this.get(openId);
        if (!user || score <= user.score) return user;
        return this.put({ ...user, score, updateTime: Date.now() });
    }

    rank(limit: number): Pick<UserInfo, "nickName" | "avatarUrl" | "score">[] {
        return Object.values(this.users)
            .sort((a, b) => b.score - a.score || a.createTime - b.createTime || a.openId.localeCompare(b.openId))
            .slice(0, limit)
            .map(({ nickName, avatarUrl, score }) => ({ nickName, avatarUrl, score }));
    }
}

export const userStore = new UserStore(config.dataFile);
