import { Scene_Title } from "./Scene_Title";

const { regClass, property } = Laya;

/** 考题结构，对应 Gameinfo/dic_dongbei.json 中的一条记录 */
export interface DongbeiQuestion {
    /** 编号（可选） */
    id?: number;
    /** 东北话原文（答案） */
    answer: string;
    /** 普通话含义，显示在 info 组件 */
    meaning: string;
    /** 额外提示（可选） */
    tip?: string;
    /** 难度（可选） */
    level?: number;
    /** 分值（可选，缺省 100） */
    score?: number;
    /**
     * 配音文件（可选）
     * 可写完整路径（resources/Gameinfo/audio/gaha.mp3），
     * 也可只写文件名（gaha.mp3），会自动拼上 audioDir 前缀。
     */
    audio?: string;
}

/** 文字池中的一个字 */
interface CharItem {
    /** 文字 */
    char: string;
    /** 该字在正确答案中的位置，用于区分重复字 */
    pos: number;
    /** 是否已被放进答案池 */
    used: boolean;
}

/** 出题队列中的一项 */
interface QueueItem {
    /** 在 _questions 中的下标 */
    idx: number;
    /** 该题所属难度 */
    level: number;
}

/**
 * 核心玩法场景：拼装东北话
 *
 * 玩法：
 * 1. 按难度从低到高出题：难度1 随机抽 questionsPerLevel 道（不重复）-> 难度2 -> 难度3，
 *    某个难度的题目不足时出完为止；全部出完后重新洗牌开新一轮
 * 2. 取到题目后拆成单字，再掺进几个不属于答案的干扰字，一起打乱放入 List_2（文字池）
 * 3. 玩家逐字点击，字进入 List_1（答案池）
 * 4. 拼成正确答案即得分，info 组件显示这句话的普通话含义
 * 5. 提示：自动填入下一个正确的字（扣 tipCost 分）；卸下：退回最后一个字；排行榜：拉取服务器榜单
 */
@regClass()
export class Scene_Game extends Laya.Script {

    declare owner: Laya.Scene;

    /** 答案池 */
    @property({ type: Laya.List, tips: "答案池 List_1" })
    public List_1: Laya.List = null;

    /** 文字池 */
    @property({ type: Laya.List, tips: "文字池 List_2" })
    public List_2: Laya.List = null;

    /** 含义/提示信息 */
    @property({ type: Laya.Label, tips: "显示普通话含义的 info 组件" })
    public info: Laya.Label = null;

    @property({ type: Laya.Button })
    public TipsButton: Laya.Button = null;

    @property({ type: Laya.Button })
    public downButton: Laya.Button = null;

    @property({ type: Laya.Button })
    public RankButton: Laya.Button = null;

    /** 分数数字 */
    @property({ type: Laya.Label })
    public My_score_Number: Laya.Label = null;
    private levelNumber: Laya.Label = null;
    private progressNumber: Laya.Label = null;
    private backHomeButton: Laya.Button = null;
    private dailyMode: boolean = false;
    private stateOverlay: Laya.Box = null;
    private overlayMode: string = "";
    private overlayActionButton: Laya.Button = null;
    private overlayReplayButton: Laya.Button = null;

    /** 题库文件（相对 assets 目录） */
    @property({ type: "string", tips: "题库 JSON 路径，可不断扩充题目" })
    public questionUrl: string = "resources/Gameinfo/dic_dongbei.json";

    /** 配音文件目录，JSON 里 audio 只写文件名时自动拼这个前缀 */
    @property({ type: "string", tips: "配音目录，例如 resources/Gameinfo/audio/；audio 写了完整路径时此项忽略" })
    public audioDir: string = "resources/Dubbing/";

    /**
     * 配音/题库走不走 CDN，不用在这里配：
     * 由 Main 脚本的 resourceSource / resourceBase 统一控制（它会设置 Laya.URL.basePath）。
     * 这里的 questionUrl / audioDir 继续写相对路径即可，下面会自动拼成远程地址。
     */

    /** 拼对后自动播放该题的配音 */
    @property({ type: "boolean", tips: "玩家拼对后自动播东北话配音；微信环境首次播放可能需要玩家先点一下屏幕" })
    public audioOnSolved: boolean = true;

    /** 出题后自动播放该题的配音（默认关：拼对时才播） */
    @property({ type: "boolean", tips: "出题时就播配音，等于提前把答案念出来，一般关掉" })
    public audioAutoPlay: boolean = false;

    /** 配音音量 0~1 */
    @property({ type: "number", tips: "配音音量，0 静音、1 最大" })
    public audioVolume: number = 1;

    /** 配音最长等待时间(毫秒)：万一播不出声或回调丢了，也不会一直卡在这一题 */
    @property({ type: "number", tips: "等配音播完的兜底上限，超过就直接进下一题" })
    public audioMaxWait: number = 8000;

    /** 答对后「答对了」提示最短停留时间(毫秒)，太短玩家来不及看 */
    @property({ type: "number", tips: "配音很短时，答对提示至少停留这么久" })
    public solvedMinShow: number = 900;

    /** 喇叭按钮（可选）：点一下重听当前题目的配音；场景里没有就不显示 */
    @property({ type: Laya.Button, tips: "场景里的 AudioButton 节点，点了重听配音" })
    public AudioButton: Laya.Button = null;

    /** 服务器排行榜地址 */
    @property({ type: "string" })
    public rankUrl: string = Scene_Title.apiBaseUrl + "/api/rank";

    /** 服务器分数上报地址 */
    @property({ type: "string" })
    public scoreUrl: string = Scene_Title.apiBaseUrl + "/api/score";

    /** 每个难度出多少题（该难度题目不足时出完为止，取过的题不再重复） */
    @property({ type: "number", tips: "每个难度从题库随机抽取的题目数，0 或负数表示不限制（出完该难度全部）" })
    public questionsPerLevel: number = 50;

    /** 干扰字最少几个（混进文字池里、不属于答案的字） */
    @property({ type: "number", tips: "文字池里掺的干扰字数量下限，0 表示不加干扰字" })
    public distractorMin: number = 2;

    /** 干扰字最多几个 */
    @property({ type: "number", tips: "文字池里掺的干扰字数量上限" })
    public distractorMax: number = 3;

    /** 难度每升一级，干扰字多加几个 */
    @property({ type: "number", tips: "难度每高一级额外增加的干扰字数量" })
    public distractorPerLevel: number = 1;

    /** 每次提示扣的分 */
    @property({ type: "number" })
    public tipCost: number = 20;

    /** 单个字的格子宽（与 List 的 item 模板 Box 尺寸一致） */
    @property({ type: "number", tips: "与 List item 模板一致，改模板时要同步改这里" })
    public cellWidth: number = 200;

    /** 单个字的格子高 */
    @property({ type: "number" })
    public cellHeight: number = 200;

    /** 格子水平间距 */
    @property({ type: "number" })
    public spaceX: number = 50;

    /** 格子垂直间距 */
    @property({ type: "number" })
    public spaceY: number = 15;

    /** 题库 */
    private _questions: DongbeiQuestion[] = [];
    /** 出题队列：先难度1、再难度2、再难度3，同一难度内随机且不重复 */
    private _queue: QueueItem[] = [];
    /** 每个难度本轮计划出的题数 */
    private _levelPlan: { [level: number]: number } = {};
    /** 每个难度本轮已出的题数 */
    private _levelDone: { [level: number]: number } = {};
    /** 当前题目的难度 */
    private _curLevel: number = 1;
    /** 下一题要显示的提示语（换难度 / 新一轮） */
    private _pendingTip: string = "";
    /** 当前题目 */
    private _cur: DongbeiQuestion = null;
    /** 当前正在播放的配音 */
    private _audioChannel: Laya.SoundChannel = null;
    /** 答对后：配音是否已播完 */
    private _audioDone: boolean = false;
    /** 答对后：「答对了」提示是否已停留够久 */
    private _minShown: boolean = false;
    /** 答对后：是否已经安排过下一题（防止重复进入下一题） */
    private _solvedDone: boolean = false;
    /** 文字池 */
    private _pool: CharItem[] = [];
    /** 答案池，长度等于答案字数，未填的位置为 null */
    private _answer: CharItem[] = [];
    /** 当前分数 */
    private _score: number = 0;
    /** 结算/提示动画期间锁定操作 */
    private _locked: boolean = false;
    /** 两个 List 在场景中的原始位置，用于每道题重新居中 */
    private _baseX1: number = 0;
    private _baseY1: number = 0;
    private _baseX2: number = 0;
    private _baseY2: number = 0;

    // ------------------------------------------------------------------
    // 生命周期
    // ------------------------------------------------------------------

    onStart(): void {
        this.dailyMode = Scene_Title.pendingMode === "daily";
        this.applyPlayerSettings();
        this.bindNodes();
        this.applyFontSize();
        this.initList(this.List_1, this.onRenderAnswer, this.onAnswerMouse);
        this.initList(this.List_2, this.onRenderPool, this.onPoolMouse);
        this.bindButtons();
        this.updateScore(0);
        this.loadQuestions();
    }

    onDestroy(): void {
        Laya.timer.clearAll(this);
        if (this.TipsButton) this.TipsButton.off(Laya.Event.CLICK, this, this.onTipsClick);
        if (this.downButton) this.downButton.off(Laya.Event.CLICK, this, this.onDownClick);
        if (this.RankButton) this.RankButton.off(Laya.Event.CLICK, this, this.onRankClick);
        if (this.AudioButton) this.AudioButton.off(Laya.Event.CLICK, this, this.onAudioClick);
        if (this.backHomeButton) this.backHomeButton.off(Laya.Event.CLICK, this, this.onBackHome);
        if (this.overlayActionButton) this.overlayActionButton.off(Laya.Event.CLICK, this, this.onOverlayAction);
        if (this.overlayReplayButton) this.overlayReplayButton.off(Laya.Event.CLICK, this, this.onOverlayReplay);
        this.stopAudio();
    }

    /** 未在 IDE 绑定引用时，按节点名字自动查找（支持一层嵌套） */
    private bindNodes(): void {
        const owner = this.owner;
        if (!owner) return;
        if (!this.List_1) this.List_1 = this.findNode(owner, "List_1") as Laya.List;
        if (!this.List_2) this.List_2 = this.findNode(owner, "List_2") as Laya.List;
        if (!this.info) this.info = this.findNode(owner, "info") as Laya.Label;
        if (!this.TipsButton) this.TipsButton = this.findNode(owner, "TipsButton") as Laya.Button;
        if (!this.downButton) this.downButton = this.findNode(owner, "downButton") as Laya.Button;
        if (!this.RankButton) this.RankButton = this.findNode(owner, "RankButton") as Laya.Button;
        if (!this.My_score_Number) this.My_score_Number = this.findNode(owner, "My_score_Number") as Laya.Label;
        if (!this.AudioButton) this.AudioButton = this.findNode(owner, "AudioButton") as Laya.Button;
        this.levelNumber = this.findNode(owner, "LevelNumber") as Laya.Label;
        this.progressNumber = this.findNode(owner, "ProgressNumber") as Laya.Label;
        this.backHomeButton = this.findNode(owner, "BackHomeButton") as Laya.Button;
        this.stateOverlay = this.findNode(owner, "GameStateOverlay") as Laya.Box;
        this.overlayActionButton = this.findNode(owner, "OverlayActionButton") as Laya.Button;
        this.overlayReplayButton = this.findNode(owner, "OverlayReplayButton") as Laya.Button;
        if (this.AudioButton) this.AudioButton.visible = false;

        // 记录初始坐标，后续按题目居中时会在此基础上偏移
        if (this.List_1) {
            this._baseX1 = this.List_1.x;
            this._baseY1 = this.List_1.y;
        }
        if (this.List_2) {
            this._baseX2 = this.List_2.x;
            this._baseY2 = this.List_2.y;
        }
    }

    private bindButtons(): void {
        if (this.TipsButton) this.TipsButton.on(Laya.Event.CLICK, this, this.onTipsClick);
        if (this.downButton) this.downButton.on(Laya.Event.CLICK, this, this.onDownClick);
        if (this.RankButton) this.RankButton.on(Laya.Event.CLICK, this, this.onRankClick);
        if (this.AudioButton) this.AudioButton.on(Laya.Event.CLICK, this, this.onAudioClick);
        if (this.backHomeButton) this.backHomeButton.on(Laya.Event.CLICK, this, this.onBackHome);
        if (this.overlayActionButton) this.overlayActionButton.on(Laya.Event.CLICK, this, this.onOverlayAction);
        if (this.overlayReplayButton) this.overlayReplayButton.on(Laya.Event.CLICK, this, this.onOverlayReplay);
    }

    // ------------------------------------------------------------------
    // 配音
    // ------------------------------------------------------------------

    /** CDN 根地址，由 Main 脚本设置；为空表示资源还在包内 */
    private cdnBase(): string {
        return (Laya.URL && Laya.URL.basePath) ? Laya.URL.basePath : "";
    }

    /**
     * 把相对路径变成真正要加载的地址：
     * Main 开了 CDN 就拼远程前缀，否则原样用包内路径。
     * 已经是 http(s) 的不动，避免重复拼前缀。
     */
    private resolveUrl(path: string): string {
        if (!path) return path;
        if (path.indexOf("http://") === 0 || path.indexOf("https://") === 0) return path;
        const base = this.cdnBase();
        return base ? base + path : path;
    }

    /** 只取文件名：audio 可能是 resources/Dubbing/0001.mp3 */
    private audioFileName(a: string): string {
        const i = Math.max(a.lastIndexOf("/"), a.lastIndexOf("\\"));
        return i >= 0 ? a.substring(i + 1) : a;
    }

    /** 取当前题目的配音地址：包名路径先算好，再统一过一遍 CDN 解析 */
    private audioUrlOf(q: DongbeiQuestion): string {
        if (!q || !q.audio) return "";
        const a = q.audio;
        let dir = this.audioDir || "";
        if (dir && dir.charAt(dir.length - 1) !== "/") dir += "/";
        // 写了 / 或 : 的当成完整路径（或远程地址）
        const localPath = (a.indexOf("/") >= 0 || a.indexOf(":") >= 0) ? a : dir + a;
        return this.resolveUrl(localPath);
    }

    /** 是否走 CDN（用于「播失败要不要退回包内重试」这类判断） */
    private useCdnAudio(): boolean {
        return !!this.cdnBase();
    }

    /**
     * 播放当前题目的配音
     * manual=true 表示玩家点喇叭按钮触发的
     * retryLocal=true 表示 CDN 播失败后正在用包内地址重试（重试不再回头找 CDN，避免死循环）
     */
    private playCurAudio(manual: boolean = false, onComplete?: () => void, retryLocal: boolean = false): void {
        let url = this.audioUrlOf(this._cur);
        if (retryLocal) {
            // 走包内目录，不管 audio 里写的是完整路径还是文件名
            let dir = this.audioDir || "";
            if (dir && dir.charAt(dir.length - 1) !== "/") dir += "/";
            url = this._cur && this._cur.audio ? dir + this.audioFileName(this._cur.audio) : "";
        }

        // 没有配音的题目不显示喇叭
        if (this.AudioButton) this.AudioButton.visible = !!url;
        if (!url) {
            // 没配音也得往下走，不然会卡住不出下一题
            if (onComplete) onComplete();
            return;
        }

        try {
            this.stopAudio();
            Laya.SoundManager.setSoundVolume(this.audioVolume);
            this._audioChannel = Laya.SoundManager.playSound(url, 1,
                Laya.Handler.create(this, () => {
                    this._audioChannel = null;
                    if (onComplete) onComplete();
                }));
            if (!this._audioChannel) {
                // CDN 拿不到就用包里的那份再试一次（域名没配、断网时不会一直没声）
                if (!retryLocal && this.useCdnAudio()) {
                    console.warn("[Scene_Game] CDN 配音播放失败，改用包内配音：" + url);
                    this.playCurAudio(manual, onComplete, true);
                    return;
                }
                console.warn("[Scene_Game] 配音播放失败，检查文件是否存在：" + url);
                if (onComplete) onComplete();
            } else if (!manual) {
                console.log("[Scene_Game] 播放配音：" + url);
            }
        } catch (e) {
            console.warn("[Scene_Game] 播放配音异常", e);
            if (onComplete) onComplete();
        }
    }

    /** 停止当前配音 */
    private stopAudio(): void {
        if (this._audioChannel) {
            this._audioChannel.stop();
            this._audioChannel = null;
        }
    }

    /** 点喇叭按钮：重听一遍 */
    private onAudioClick(): void {
        this.playCurAudio(true);
    }

    /**
     * 答对后安排下一题：
     * 有配音 -> 等配音播完再进（另加兜底超时，防止播不出声卡住）
     * 没配音 -> 按 1200ms 固定间隔进
     */
    private scheduleNext(): void {
        this._audioDone = false;
        this._minShown = false;
        this._solvedDone = false;

        const url = this.audioUrlOf(this._cur);
        if (url && this.audioOnSolved) {
            // 兜底：超时也直接进下一题
            Laya.timer.once(Math.max(this.audioMaxWait, 1000), this, this.onAudioDone);
            // 至少要让玩家看见「答对了」
            Laya.timer.once(this.solvedMinShow, this, this.onMinShown);
            this.playCurAudio(false, () => this.onAudioDone());
        } else {
            Laya.timer.once(1200, this, () => {
                this._audioDone = true;
                this._minShown = true;
                this.goNext();
            });
        }
    }

    /** 配音播完（或超时） */
    private onAudioDone(): void {
        Laya.timer.clear(this, this.onAudioDone);
        this._audioDone = true;
        this.goNext();
    }

    /** 「答对了」提示已停留够久 */
    private onMinShown(): void {
        this._minShown = true;
        this.goNext();
    }

    /** 两个条件都满足才进下一题，且只进一次 */
    private goNext(): void {
        if (this._solvedDone) return;
        if (!this._audioDone || !this._minShown) return;
        this._solvedDone = true;
        Laya.timer.clear(this, this.onAudioDone);
        this.hideOverlay();
        if (this.dailyMode && this._queue.length === 0) {
            this.finishDailyChallenge();
        } else {
            this.nextQuestion();
        }
    }

    private initList(list: Laya.List, render: (cell: Laya.Box, index: number) => void,
        mouse: (e: Laya.Event, index: number) => void): void {
        if (!list) return;
        list.mouseEnabled = true;
        list.mouseThrough = false;
        list.spaceX = this.spaceX;
        list.spaceY = this.spaceY;
        list.renderHandler = Laya.Handler.create(this, render, null, false);
        list.mouseHandler = Laya.Handler.create(this, mouse, null, false);
    }

    // ------------------------------------------------------------------
    // 题库加载
    // ------------------------------------------------------------------

    private async loadQuestions(): Promise<void> {
        this.setInfo("题库加载中...");
        try {
            // 注意：.json 用 loader.load 拿到的是 TextResource，真正的内容在 .data 上
            const res: any = await Laya.loader.load(this.resolveUrl(this.questionUrl));
            console.log("[Scene_Game] 题库加载返回：" + (res == null ? "null" : (typeof res === "object" ? Object.keys(res).join(",") : typeof res)));
            let data: any = (res && res.data !== undefined && res.data !== null) ? res.data : res;
            if (typeof data === "string") data = JSON.parse(data);

            const list: DongbeiQuestion[] = data && data.questions ? data.questions : null;
            if (!list || !list.length) throw new Error("题库为空或格式不对（缺少 questions 数组）：" + this.questionUrl);

            this._questions = list.filter((q) => q && q.answer && q.meaning);
            console.log("[Scene_Game] 题库加载成功，共 " + this._questions.length + " 题");
        } catch (e) {
            console.error("[Scene_Game] 题库加载失败，使用默认题目", e);
            this._questions = [{ answer: "嘎哈", meaning: "干什么、做什么", level: 1 }];
        }
        this.fillQueue();
        this.nextQuestion();
    }

    /**
     * 重新生成出题队列：按难度从低到高，每个难度随机抽 questionsPerLevel 道（不重复）
     * 例：难度1 抽 50 道 -> 难度2 抽 50 道 -> 难度3 抽 50 道
     */
    private fillQueue(): void {
        this._queue = [];
        if (this.dailyMode) {
            this._levelPlan = { 1: 10 };
            this._levelDone = { 1: 0 };
            const seed = this.dateKey();
            const scores = this._questions.map((_, idx) => ({ idx: idx, sort: this.stableHash(seed + ":" + idx) }));
            scores.sort((a, b) => a.sort - b.sort || a.idx - b.idx);
            for (let i = 0; i < Math.min(10, scores.length); i++) this._queue.push({ idx: scores[i].idx, level: 1 });
            this._levelPlan[1] = this._queue.length;
            return;
        }
        this._levelPlan = {};
        this._levelDone = {};

        const levels = this.collectLevels();
        for (let i = 0; i < levels.length; i++) {
            const lv = levels[i];

            // 该难度全部题目的下标，打乱后从头取，保证随机且不重复
            const idxList: number[] = [];
            for (let j = 0; j < this._questions.length; j++) {
                if (this.levelOf(this._questions[j]) === lv) idxList.push(j);
            }
            this.shuffle(idxList);

            const limit = this.questionsPerLevel > 0 ? this.questionsPerLevel : idxList.length;
            const take = Math.min(limit, idxList.length);
            for (let k = 0; k < take; k++) this._queue.push({ idx: idxList[k], level: lv });

            this._levelPlan[lv] = take;
            this._levelDone[lv] = 0;
            console.log("[Scene_Game] 难度 " + lv + " 本轮出题 " + take + " 道（题库共 " + idxList.length + " 道）");
        }
    }

    /** 题库里出现过的所有难度，升序 */
    private collectLevels(): number[] {
        const levels: number[] = [];
        for (let i = 0; i < this._questions.length; i++) {
            const lv = this.levelOf(this._questions[i]);
            if (levels.indexOf(lv) < 0) levels.push(lv);
        }
        levels.sort((a, b) => a - b);
        return levels;
    }

    /** 取题目难度，没写 level 的按 1 处理 */
    private levelOf(q: DongbeiQuestion): number {
        return typeof q.level === "number" && q.level > 0 ? q.level : 1;
    }

    // ------------------------------------------------------------------
    // 出题与渲染
    // ------------------------------------------------------------------

    private nextQuestion(): void {
        if (!this._questions.length) return;

        // 队列取空说明所有难度的题都出完了，重新洗牌开新一轮
        const newRound = this._queue.length === 0;
        if (newRound && this.dailyMode) {
            this.finishDailyChallenge();
            return;
        }
        if (newRound) this.fillQueue();

        const item = this._queue.shift();
        const q = item ? this._questions[item.idx] : null;
        this._cur = q;
        if (!q || !item) return;

        // 换难度或开新一轮时提示一下
        this._curLevel = item.level;
        this._levelDone[item.level] = (this._levelDone[item.level] || 0) + 1;
        // 提示语挂到下一次 showMeaning 上显示（避免被含义信息覆盖）
        const levelTransition = !this.dailyMode && (newRound || (this._levelDone[item.level] === 1 && item.level > 1));
        if (newRound) {
            this._pendingTip = "全部题目已答完，重新开始新一轮！";
        } else if (this._levelDone[item.level] === 1) {
            this._pendingTip = "进入难度 " + item.level + "，整起来！";
        }

        const chars = q.answer.split("");
        if (chars.length > 8) {
            console.warn("[Scene_Game] 题目超过 8 个字，可能显示不全：", q.answer);
        }

        // 文字池：拆字 + 干扰字 + 打乱
        this._pool = chars.map((c, i) => ({ char: c, pos: i, used: false }));
        const distractors = this.buildDistractors(chars);
        for (let i = 0; i < distractors.length; i++) this._pool.push(distractors[i]);

        // 避免一上来就是正确顺序
        let guard = 0;
        do {
            this.shuffle(this._pool);
            guard++;
        } while (guard < 10 && this._pool.every((it, i) => it.pos === i));

        // 答案池：全部空槽
        this._answer = [];
        for (let i = 0; i < chars.length; i++) this._answer.push(null);

        this._locked = false;
        this.showMeaning();
        this.refreshLists();

        // 出题阶段不播配音、也不显示喇叭（否则等于把答案念出来，剧透）
        this.stopAudio();
        if (this.AudioButton) this.AudioButton.visible = false;

        if (levelTransition) this.showOverlay("level", "闯到下一档，继续整！", "难度 " + item.level + " · 东北乡音", "", "当前难度计划题数：" + (this._levelPlan[item.level] || 0) + " 题", "点击继续，开始拼字。", "继续拼字");
        else if (this.audioAutoPlay) this.playCurAudio(false);
    }

    /**
     * 生成干扰字：从题库里其他题目的字中随机挑，且不会与本题答案的字重复
     * （不重复是为了保证「提示」和判定不会模棱两可）
     */
    private buildDistractors(answerChars: string[]): CharItem[] {
        const count = this.distractorCount();
        const out: CharItem[] = [];
        if (count <= 0) return out;

        // 本题答案里出现过的字不能当干扰字
        const banned: { [char: string]: boolean } = {};
        for (let i = 0; i < answerChars.length; i++) banned[answerChars[i]] = true;

        // 候选字：题库所有答案里的字（风格贴近东北话），不够时用常用字兜底
        const candidates: string[] = [];
        for (let i = 0; i < this._questions.length; i++) {
            const cs = this._questions[i].answer.split("");
            for (let j = 0; j < cs.length; j++) {
                if (!banned[cs[j]]) candidates.push(cs[j]);
            }
        }
        const spare = "的地得了就不也是";
        for (let i = 0; i < spare.length; i++) {
            if (!banned[spare.charAt(i)]) candidates.push(spare.charAt(i));
        }

        // 去重后随机抽 count 个
        const uniq: string[] = [];
        for (let i = 0; i < candidates.length; i++) {
            if (uniq.indexOf(candidates[i]) < 0) uniq.push(candidates[i]);
        }
        for (let i = 0; i < count && uniq.length > 0; i++) {
            const idx = Math.floor(Math.random() * uniq.length);
            out.push({ char: uniq.splice(idx, 1)[0], pos: -1, used: false });
        }
        return out;
    }

    /** 干扰字数量：在 [min, max] 之间随机，难度每高一级多 distractorPerLevel 个 */
    private distractorCount(): number {
        let min = Math.max(0, Math.floor(this.distractorMin));
        let max = Math.max(min, Math.floor(this.distractorMax));
        const extra = Math.max(0, Math.floor(this.distractorPerLevel)) * Math.max(0, this._curLevel - 1);
        min += extra;
        max += extra;
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    private refreshLists(): void {
        // 行列数完全按当前题目的字数动态计算，并把格子整体居中
        this.applyGrid(this.List_1, this._baseX1, this._baseY1, this._answer.length);
        this.applyGrid(this.List_2, this._baseX2, this._baseY2, this._pool.length);

        if (this.List_1) this.List_1.array = this._answer.slice();
        if (this.List_2) this.List_2.array = this._pool.slice();
    }

    /**
     * 按格子数量动态布局一个 List：
     * 1. 列数 = 容器宽度能放下的最大列数（不超过字数）
     * 2. 行数 = 向上取整(字数 / 列数)
     * 3. 整个格子阵在 List 区域内水平、垂直居中
     */
    private applyGrid(list: Laya.List, baseX: number, baseY: number, count: number): void {
        if (!list) return;

        const areaW = list.width || 960;
        const areaH = list.height || 420;
        const stepX = this.cellWidth + this.spaceX;
        const stepY = this.cellHeight + this.spaceY;

        // 容器最多能放下几列 / 几行
        const maxCols = Math.max(1, Math.floor((areaW + this.spaceX) / stepX));
        const maxRows = Math.max(1, Math.floor((areaH + this.spaceY) / stepY));

        // 一行放得下就排一行（答案按从左到右读）；放不下就尽量排成均衡的多行
        let cols: number;
        if (count > 0 && count <= maxCols) {
            cols = count;
        } else {
            cols = Math.min(maxCols, Math.ceil(count / maxRows));
        }
        cols = Math.max(1, cols);
        const rows = Math.max(1, Math.ceil(count / cols));

        list.spaceX = this.spaceX;
        list.spaceY = this.spaceY;
        list.repeatX = cols;
        list.repeatY = rows;

        const gridW = cols * this.cellWidth + (cols - 1) * this.spaceX;
        const gridH = rows * this.cellHeight + (rows - 1) * this.spaceY;

        // 行数超出可视区域时（长题目）整体等比缩小，保证全部格子可见
        const scale = rows > maxRows ? Math.max(0.5, areaH / gridH) : 1;
        list.scale(scale, scale);

        const showW = gridW * scale;
        const showH = gridH * scale;
        list.x = baseX + Math.max(0, (areaW - showW) / 2);
        list.y = baseY + Math.max(0, (areaH - showH) / 2);
    }

    /** 答案池单元格 */
    private onRenderAnswer(cell: Laya.Box, index: number): void {
        if (!cell) return;
        cell.mouseEnabled = true;
        const item = this._answer[index];
        const label = this.findNode(cell, "Label_1") as Laya.Label;
        if (label) label.text = item ? item.char : "";
    }

    /** 文字池单元格 */
    private onRenderPool(cell: Laya.Box, index: number): void {
        if (!cell) return;
        cell.mouseEnabled = true;
        const item = this._pool[index];
        const label = this.findNode(cell, "Label_2") as Laya.Label;
        if (label) label.text = item && !item.used ? item.char : "";
        const bg = this.findNode(cell, "bg_2") as Laya.Image;
        if (bg) bg.alpha = item && item.used ? 0.25 : 1;
    }

    // ------------------------------------------------------------------
    // 交互
    // ------------------------------------------------------------------

    /** 点文字池：把字放进答案池第一个空位 */
    private onPoolMouse(e: Laya.Event, index: number): void {
        if (!e || e.type !== Laya.Event.CLICK) return;
        if (this._locked) return;

        const item = this._pool[index];
        if (!item || item.used) return;

        const slot = this._answer.indexOf(null);
        if (slot < 0) return;

        item.used = true;
        this._answer[slot] = item;
        this.refreshLists();
        this.checkAnswer();
    }

    /** 点答案池：把字退回文字池 */
    private onAnswerMouse(e: Laya.Event, index: number): void {
        if (!e || e.type !== Laya.Event.CLICK) return;
        if (this._locked) return;

        const item = this._answer[index];
        if (!item) return;

        item.used = false;
        this._answer[index] = null;
        this.refreshLists();
    }

    /** 卸下：退回最后一个已填的字 */
    private onDownClick(): void {
        if (this._locked) return;
        for (let i = this._answer.length - 1; i >= 0; i--) {
            const item = this._answer[i];
            if (item) {
                item.used = false;
                this._answer[i] = null;
                break;
            }
        }
        this.refreshLists();
    }

    /** 提示：自动填入下一个正确的字，并扣分 */
    private onTipsClick(): void {
        if (this._locked || !this._cur) return;

        const slot = this._answer.indexOf(null);
        if (slot < 0) return;

        const need = this._cur.answer.charAt(slot);
        let target: CharItem = null;
        for (let i = 0; i < this._pool.length; i++) {
            const item = this._pool[i];
            if (!item.used && item.char === need) {
                target = item;
                break;
            }
        }
        if (!target) return;

        target.used = true;
        this._answer[slot] = target;
        this.updateScore(Math.max(0, this._score - this.tipCost));
        this.setInfo("提示：第 " + (slot + 1) + " 个字是「" + need + "」"
            + (this._cur.tip ? "，" + this._cur.tip : "") + "（-" + this.tipCost + " 分）");
        this.refreshLists();
        this.checkAnswer();
        if (!this._locked) this.showOverlay("hint", "提示正在生效", "第 " + (slot + 1) + " 个字是「" + need + "」", "已扣 " + this.tipCost + " 分", this._cur.tip || this._cur.meaning, "已填入答案池，还可以继续选择字块。", "继续拼字");
    }

    /** 排行榜 */
    private onRankClick(): void {
        Laya.Scene.open("Scene/Scene_Rank.ls", true)
            .catch((err: any) => console.error("[Scene_Game] 打开排行榜失败", err));
    }

    // ------------------------------------------------------------------
    // 判定与计分
    // ------------------------------------------------------------------

    private checkAnswer(): void {
        if (!this._cur) return;
        if (this._answer.indexOf(null) >= 0) return;

        const text = this._answer.map((i) => (i ? i.char : "")).join("");
        if (text === this._cur.answer) {
            this._locked = true;
            const add = typeof this._cur.score === "number" ? this._cur.score : 100;
            this.updateScore(this._score + add);
            this.setInfo("答对了！「" + text + "」 " + this._cur.meaning + "  +" + add + " 分");
            this.recordAlbum(text);
            this.showOverlay("solved", "答对啦，老带劲了！", "「" + text + "」", "+" + add + " 分", this._cur.meaning, this.audioUrlOf(this._cur) ? "东北话配音播放后自动进入下一题" : "稍后自动进入下一题", "下一题");
            // 等配音播完再进下一题（没配音就按固定间隔）
            this.scheduleNext();
        } else {
            this._locked = true;
            this.setInfo("不对劲儿，池子里混了干扰字，再想想~");
            Laya.timer.once(800, this, () => {
                this.clearAnswer();
                this.showMeaning();
                this._locked = false;
            });
        }
    }

    private clearAnswer(): void {
        for (let i = 0; i < this._answer.length; i++) {
            const item = this._answer[i];
            if (item) item.used = false;
            this._answer[i] = null;
        }
        this.refreshLists();
    }

    private updateScore(score: number): void {
        this._score = score;
        if (this.My_score_Number) this.My_score_Number.text = String(this._score);
        this.reportScore();
    }

    /** 登录过就把分数同步到服务器 */
    private reportScore(): void {
        const wx = this.wx;
        if (!wx || typeof wx.request !== "function") return;

        const token = Scene_Title.loginInfo ? Scene_Title.loginInfo.token : null;
        if (!token) return;

        wx.request({
            url: this.scoreUrl,
            method: "POST",
            data: { token: token, score: this._score },
            header: { "content-type": "application/json" },
            success: (res: any) => {
                if (!res || res.statusCode !== 200) {
                    console.warn("[Scene_Game] 分数上报失败，状态码", res && res.statusCode);
                }
            },
            fail: (err: any) => {
                console.warn("[Scene_Game] 分数上报失败", err);
            }
        });
    }

    // ------------------------------------------------------------------
    // 工具
    // ------------------------------------------------------------------

    private get wx(): any {
        return Laya.Browser.window ? Laya.Browser.window.wx : null;
    }

    /** 显示当前题目的含义，并带上难度进度 */
    private showMeaning(): void {
        if (!this._cur) return;
        const done = this._levelDone[this._curLevel] || 0;
        const total = this._levelPlan[this._curLevel] || 0;
        if (this.levelNumber) this.levelNumber.text = this.dailyMode ? "今日" : ("0" + this._curLevel).slice(-2);
        if (this.progressNumber) this.progressNumber.text = done + " / " + total;
        let text = (this.dailyMode ? "【今日挑战 " : "【难度" + this._curLevel + " ") + done + "/" + total + "】含义：" + this._cur.meaning;
        if (this._pendingTip) {
            text = this._pendingTip + "\n" + text;
            this._pendingTip = "";
        }
        this.setInfo(text);
    }

    private setInfo(text: string): void {
        if (this.info) this.info.text = text;
        else console.log("[Scene_Game]", text);
    }

    private onBackHome(): void {
        this.stopAudio();
        Laya.Scene.open("Scene/Scene_Title.ls", true).catch((err: any) => console.error("[Scene_Game] 返回首页失败", err));
    }

    /** Hint, solved and level-transition panels are prefab nodes; scripts change only content and visibility. */
    private showOverlay(mode: string, title: string, answer: string, score: string, meaning: string, note: string, action: string): void {
        if (!this.stateOverlay) return;
        this.overlayMode = mode;
        const values: { [name: string]: string } = {
            OverlayTitle: title, OverlayAnswer: answer, OverlayScore: score,
            OverlayMeaning: meaning, OverlayNote: note
        };
        for (const name in values) {
            const label = this.findNode(this.stateOverlay, name) as Laya.Label;
            if (label) label.text = values[name];
        }
        if (this.overlayActionButton) this.overlayActionButton.label = action;
        if (this.overlayReplayButton) this.overlayReplayButton.visible = mode === "solved" && !!this.audioUrlOf(this._cur);
        this.stateOverlay.visible = true;
        this._locked = true;
    }

    private hideOverlay(): void {
        if (this.stateOverlay) this.stateOverlay.visible = false;
        this.overlayMode = "";
    }

    private onOverlayAction(): void {
        if (this.overlayMode === "solved") {
            Laya.timer.clearAll(this);
            this.stopAudio();
            this._audioDone = true;
            this._minShown = true;
            this.goNext();
        } else if (this.overlayMode === "hint" || this.overlayMode === "level") {
            const wasLevel = this.overlayMode === "level";
            this.hideOverlay();
            this._locked = false;
            if (wasLevel && this.audioAutoPlay) this.playCurAudio(false);
        }
    }

    private onOverlayReplay(): void {
        if (this.overlayMode === "solved") this.playCurAudio(true);
    }

    private applyPlayerSettings(): void {
        try {
            const settings: any = Laya.LocalStorage.getJSON("dongbei_settings");
            if (!settings) return;
            this.audioOnSolved = settings.audioOnSolved !== false;
            this.audioAutoPlay = settings.audioAutoPlay === true;
            this.audioVolume = typeof settings.volume === "number" ? Math.max(0, Math.min(1, settings.volume)) : 1;
        } catch (err) { console.warn("[Scene_Game] 设置读取失败", err); }
    }

    private applyFontSize(): void {
        try {
            const settings: any = Laya.LocalStorage.getJSON("dongbei_settings");
            if (settings && this.info && typeof settings.fontSize === "number") {
                this.info.fontSize = Math.max(42, Math.min(64, settings.fontSize));
            }
        } catch (err) { console.warn("[Scene_Game] 字号读取失败", err); }
    }

    private recordAlbum(answer: string): void {
        try {
            const old = Laya.LocalStorage.getJSON("dongbei_album");
            const album: string[] = Array.isArray(old) ? old : [];
            if (album.indexOf(answer) < 0) {
                album.push(answer);
                Laya.LocalStorage.setJSON("dongbei_album", album);
            }
        } catch (err) { console.warn("[Scene_Game] 图鉴记录失败", err); }
    }

    private dateKey(): string {
        const d = new Date();
        return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
    }

    private stableHash(s: string): number {
        let hash = 2166136261;
        for (let i = 0; i < s.length; i++) hash = Math.imul(hash ^ s.charCodeAt(i), 16777619);
        return hash >>> 0;
    }

    private finishDailyChallenge(): void {
        this._locked = true;
        const key = "dongbei_daily_" + this.dateKey();
        try {
            const best = Number(Laya.LocalStorage.getItem(key) || 0);
            if (this._score > best) Laya.LocalStorage.setItem(key, String(this._score));
        } catch (err) { console.warn("[Scene_Game] 今日成绩保存失败", err); }
        if (this.info) this.info.text = "今日挑战完成！获得 " + this._score + " 分。点击右上角返回首页。";
        if (this.List_1) this.List_1.array = [];
        if (this.List_2) this.List_2.array = [];
        if (this.TipsButton) this.TipsButton.disabled = true;
        if (this.downButton) this.downButton.disabled = true;
    }

    /** 查找子节点（直接子节点 + 一层嵌套） */
    private findNode(root: Laya.Node, name: string): Laya.Node {
        if (!root) return null;
        const direct = root.getChildByName(name);
        if (direct) return direct;
        for (let i = 0; i < root.numChildren; i++) {
            const child = root.getChildAt(i);
            const found = child.getChildByName(name);
            if (found) return found;
        }
        return null;
    }

    private shuffle(arr: any[]): void {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const t = arr[i];
            arr[i] = arr[j];
            arr[j] = t;
        }
    }
}
