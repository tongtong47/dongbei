import { Scene_Title } from "./Scene_Title";

const { regClass, property } = Laya;

interface AlbumQuestion {
    answer: string;
    meaning: string;
    audio?: string;
    level?: number;
}

/** Shared controller for four independently laid-out scenes. No UI geometry is set here. */
@regClass()
export class Scene_Extra extends Laya.Script {
    declare owner: Laya.Scene;

    @property({ type: "string" }) public mode: string = "rank";
    @property({ type: "string" }) public rankUrl: string = "http://localhost:3000/api/rank";
    @property({ type: "string" }) public questionUrl: string = "resources/Gameinfo/dic_dongbei.json";
    @property({ type: "string" }) public audioDir: string = "resources/Dubbing/";

    private questions: AlbumQuestion[] = [];
    private learned: AlbumQuestion[] = [];
    private albumPage: number = 0;
    private selected: AlbumQuestion = null;
    private settings: { audioOnSolved: boolean; audioAutoPlay: boolean; volume: number; fontSize: number } = {
        audioOnSolved: true, audioAutoPlay: false, volume: 1, fontSize: 48
    };

    onStart(): void {
        this.click("CloseButton", this.backHome);
        this.click("RankBackButton", this.backHome);
        this.click("DailyBackButton", this.backHome);
        this.click("AlbumBackButton", this.backHome);
        this.click("SettingsBackButton", this.backHome);
        if (this.mode === "rank") this.loadRank();
        else if (this.mode === "daily") this.initDaily();
        else if (this.mode === "album") this.initAlbum();
        else if (this.mode === "settings") this.initSettings();
    }

    onDestroy(): void {
        Laya.timer.clearAll(this);
        if (Laya.SoundManager) Laya.SoundManager.stopAllSound();
    }

    private node(name: string): Laya.Node {
        return this.owner ? this.owner.getChildByName(name) : null;
    }
    private text(name: string, value: string): void {
        const control: any = this.node(name);
        if (!control) return;
        if ("label" in control) control.label = value;
        else control.text = value;
    }
    private click(name: string, handler: () => void): void {
        const button = this.node(name) as Laya.Button;
        if (button) button.on(Laya.Event.CLICK, this, handler);
    }
    private backHome(): void {
        Laya.Scene.open("Scene/Scene_Title.ls", true).catch((err: any) => console.error("[Scene_Extra] 返回首页失败", err));
    }
    private dateKey(): string {
        const d = new Date();
        return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    }

    private loadRank(): void {
        const done = (list: any[]): void => {
            const rows = Array.isArray(list) ? list : [];
            for (let i = 0; i < 10; i++) {
                const user = rows[i];
                this.text("RankRow" + i, user ? ("0" + (i + 1)).slice(-2) + "   " + (user.nickName || "玩家") + "     " + Number(user.score || 0) + " 分" : "");
            }
            this.text("RankStatus", rows.length ? "以服务器历史最高分排序" : "暂无榜单，来抢第一名吧！");
        };
        const fail = (): void => {
            for (let i = 0; i < 10; i++) this.text("RankRow" + i, "");
            this.text("RankStatus", "榜单暂不可用；离线答题不受影响。");
        };
        const w: any = Laya.Browser.window;
        const url = this.rankUrl + "?limit=10";
        if (w && w.wx && typeof w.wx.request === "function") {
            w.wx.request({ url: url, method: "GET", success: (res: any) => done(res && res.data ? res.data.list : []), fail: fail });
        } else if (w && typeof w.fetch === "function") {
            w.fetch(url).then((r: any) => r.json()).then((data: any) => done(data.list)).catch(fail);
        } else fail();
    }

    private initDaily(): void {
        this.text("DailyDate", "今日题组  ·  " + this.dateKey());
        this.text("DailyBest", "今日最佳：" + Number(Laya.LocalStorage.getItem("dongbei_daily_" + this.dateKey()) || 0) + " 分");
        this.click("StartDailyButton", () => {
            Scene_Title.pendingMode = "daily";
            Laya.Scene.open("Scene/Scene_Game.ls", true).catch((err: any) => console.error("[Scene_Extra] 打开今日挑战失败", err));
        });
    }

    private async initAlbum(): Promise<void> {
        this.click("AlbumPrevButton", () => { if (this.albumPage > 0) { this.albumPage--; this.renderAlbum(); } });
        this.click("AlbumNextButton", () => { if ((this.albumPage + 1) * 5 < this.learned.length) { this.albumPage++; this.renderAlbum(); } });
        for (let i = 0; i < 5; i++) {
            const index = i;
            this.click("AlbumRow" + i, () => this.selectAlbumRow(index));
        }
        try {
            const raw: any = await Laya.loader.load(this.questionUrl);
            let data: any = raw && raw.data !== undefined ? raw.data : raw;
            if (typeof data === "string") data = JSON.parse(data);
            this.questions = data && Array.isArray(data.questions) ? data.questions : [];
            const saved = Laya.LocalStorage.getJSON("dongbei_album");
            const answers: string[] = Array.isArray(saved) ? saved : [];
            this.learned = this.questions.filter((q) => answers.indexOf(q.answer) >= 0);
            this.renderAlbum();
        } catch (err) {
            console.warn("[Scene_Extra] 图鉴读取失败", err);
            this.text("AlbumDetail", "图鉴暂时无法读取，请返回后重试。");
        }
    }

    private renderAlbum(): void {
        const pages = Math.max(1, Math.ceil(this.learned.length / 5));
        this.text("AlbumPage", "图鉴 " + (this.albumPage + 1) + " / " + pages + "  ·  已收录 " + this.learned.length + " 词");
        for (let i = 0; i < 5; i++) {
            const q = this.learned[this.albumPage * 5 + i];
            this.text("AlbumRow" + i, q ? q.answer + "   ·   " + q.meaning : "尚未收录");
        }
        if (!this.learned.length) this.text("AlbumDetail", "答对词句后，会自动收录到这里。");
    }
    private selectAlbumRow(index: number): void {
        const q = this.learned[this.albumPage * 5 + index];
        if (!q) return;
        this.selected = q;
        this.text("AlbumDetail", "「" + q.answer + "」  " + q.meaning + (q.audio ? "  ·  点击本行可重听" : ""));
        if (q.audio) {
            const url = q.audio.indexOf("/") >= 0 ? q.audio : this.audioDir + q.audio;
            Laya.SoundManager.playSound(url, 1);
        }
    }

    private initSettings(): void {
        try {
            const saved: any = Laya.LocalStorage.getJSON("dongbei_settings");
            if (saved) {
                this.settings.audioOnSolved = saved.audioOnSolved !== false;
                this.settings.audioAutoPlay = saved.audioAutoPlay === true;
                this.settings.volume = typeof saved.volume === "number" ? Math.max(0, Math.min(1, saved.volume)) : 1;
                this.settings.fontSize = typeof saved.fontSize === "number" ? saved.fontSize : 48;
            }
        } catch (err) { console.warn("[Scene_Extra] 设置读取失败", err); }
        this.click("SolvedAudioButton", () => { this.settings.audioOnSolved = !this.settings.audioOnSolved; this.renderSettings(); });
        this.click("EarlyAudioButton", () => { this.settings.audioAutoPlay = !this.settings.audioAutoPlay; this.renderSettings(); });
        this.click("VolumeDownButton", () => { this.settings.volume = Math.max(0, Math.round(this.settings.volume * 10 - 1) / 10); this.renderSettings(); });
        this.click("VolumeUpButton", () => { this.settings.volume = Math.min(1, Math.round(this.settings.volume * 10 + 1) / 10); this.renderSettings(); });
        this.click("FontSizeButton", () => { this.settings.fontSize = this.settings.fontSize === 48 ? 56 : this.settings.fontSize === 56 ? 64 : 48; this.renderSettings(); });
        this.click("SaveSettingsButton", () => {
            Laya.LocalStorage.setJSON("dongbei_settings", this.settings);
            this.text("SettingsNotice", "设置已保存，进入答题后生效。");
        });
        this.renderSettings();
    }
    private renderSettings(): void {
        this.text("SolvedAudioButton", this.settings.audioOnSolved ? "开启" : "关闭");
        this.text("EarlyAudioButton", this.settings.audioAutoPlay ? "开启" : "关闭");
        this.text("VolumeValue", Math.round(this.settings.volume * 100) + "%");
        this.text("FontSizeButton", this.settings.fontSize === 48 ? "标准" : this.settings.fontSize === 56 ? "较大" : "最大");
    }
}