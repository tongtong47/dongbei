const { regClass, property } = Laya;

/**
 * 微信登录后的用户信息。
 * openId / token 由开发者服务器使用 wx.login 的 code 换取后返回，
 * 具体字段以服务器返回为准，这里只定义常用字段。
 */
interface WXUserInfo {
    /** 用户唯一标识（由服务器用 code 换取） */
    openId?: string;
    /** 登录态令牌 */
    token?: string;
    /** 昵称 */
    nickName?: string;
    /** 头像地址 */
    avatarUrl?: string;
    /** 微信登录凭证 */
    code?: string;
    [key: string]: any;
}

/**
 * 标题场景脚本（绑定在 Scene_Title.ls 场景根节点上）
 *
 * 1. 微信小游戏版本：进入场景后自动登录（wx.login 获取 code，再用 code 向开发者服务器换取 openId / token）
 * 2. 点击“开始游戏”按钮，打开 Scene_Game 场景
 */
@regClass()
export class Scene_Title extends Laya.Script {

    declare owner: Laya.Scene;

    /** 场景中的“开始游戏”按钮（Start_Button） */
    @property({ type: Laya.Button, tips: "场景中的 Start_Button 节点" })
    public Start_Button: Laya.Button = null;

    /** 点击开始游戏后要打开的场景（相对 assets 目录的路径） */
    @property({ type: "string", tips: "相对 assets 目录的场景路径" })
    public gameSceneUrl: string = "Scene/Scene_Game.ls";

    /**
     * 开发者服务器登录接口，用于把 wx.login 的 code 换成 openId / token。
     * 留空时只做本地静默登录：仅获取并缓存 code，不请求服务器。
     */
    @property({ type: "string", tips: "开发者服务器登录接口，例如 http://localhost:3000/api/wxlogin；留空则仅静默登录，不请求服务器" })
    public loginUrl: string = "http://localhost:3000/api/wxlogin";

    /** 本地缓存 key：用户信息 */
    private static readonly KEY_USER_INFO: string = "wx_user_info";
    /** 本地缓存 key：登录凭证 */
    private static readonly KEY_LOGIN_CODE: string = "wx_login_code";

    /** 登录结果，全局访问：Scene_Title.loginInfo */
    public static loginInfo: WXUserInfo = null;

    /** 是否已登录 */
    public static get isLogin(): boolean {
        return !!Scene_Title.loginInfo;
    }

    /** 按钮默认文本，登录过程中会被临时替换 */
    private _defaultLabel: string = "开始游戏";
    /** 防止重复点击导致重复打开场景 */
    private _enteringGame: boolean = false;

    /** 微信小游戏原生对象 */
    private get wx(): any {
        return Laya.Browser.window ? Laya.Browser.window.wx : null;
    }

    /** 是否运行在微信小游戏环境 */
    private get isWxMiniGame(): boolean {
        const wx = this.wx;
        return !!wx && typeof wx.login === "function";
    }

    /** 开始按钮：优先用 IDE 绑定的引用，未绑定时按名字查找 */
    private get startButton(): Laya.Button {
        if (this.Start_Button) return this.Start_Button;
        return this.owner ? (this.owner.getChildByName("Start_Button") as Laya.Button) : null;
    }

    onStart(): void {
        const btn = this.startButton;
        if (btn) {
            this._defaultLabel = btn.label || this._defaultLabel;
            btn.on(Laya.Event.CLICK, this, this.onClickStart);
        } else {
            console.warn("[Scene_Title] 未找到 Start_Button 节点");
        }

        // 进入标题场景后自动登录
        this.wxAutoLogin();
    }

    onDestroy(): void {
        const btn = this.startButton;
        if (btn) btn.off(Laya.Event.CLICK, this, this.onClickStart);
    }

    // ------------------------------------------------------------------
    // 微信自动登录
    // ------------------------------------------------------------------

    /**
     * 微信自动登录：静默调用 wx.login，无需玩家任何操作。
     * 非微信环境（浏览器调试）直接跳过，不影响游戏流程。
     */
    private wxAutoLogin(): void {
        if (!this.isWxMiniGame) {
            console.log("[Scene_Title] 非微信小游戏环境，跳过微信自动登录");
            this.onLoginFinished(null);
            return;
        }

        // 先读取本地缓存的登录信息，避免每次启动都等待网络请求
        const cached = this.getCachedUserInfo();
        if (cached) {
            Scene_Title.loginInfo = cached;
            console.log("[Scene_Title] 使用本地缓存的登录信息", cached);
        }

        this.setButtonState("登录中...", true);

        this.wx.login({
            success: (res: any) => {
                const code = res ? res.code : null;
                if (!code) {
                    console.error("[Scene_Title] wx.login 失败，未获取到 code", res);
                    this.onLoginFinished(cached);
                    return;
                }
                console.log("[Scene_Title] wx.login 成功 code =", code);
                this.loginByCode(code, cached);
            },
            fail: (err: any) => {
                console.error("[Scene_Title] wx.login 调用失败", err);
                this.onLoginFinished(cached);
            }
        });
    }

    /**
     * 用 code 向开发者服务器换取登录态。
     * 未配置 loginUrl 时，只把 code 缓存到本地。
     */
    private loginByCode(code: string, fallback: WXUserInfo): void {
        // 保存凭证，便于服务器接入后补换取 openId
        this.setStorageItem(Scene_Title.KEY_LOGIN_CODE, code);

        if (!this.loginUrl) {
            const info: WXUserInfo = fallback || {};
            info.code = code;
            this.saveUserInfo(info);
            this.onLoginFinished(info);
            return;
        }

        if (typeof this.wx.request !== "function") {
            this.onLoginFinished(fallback);
            return;
        }

        this.wx.request({
            url: this.loginUrl,
            method: "POST",
            data: { code: code },
            header: { "content-type": "application/json" },
            success: (res: any) => {
                const data = res ? res.data : null;
                if (data && (data.openId || data.token)) {
                    data.code = code;
                    this.saveUserInfo(data);
                    this.onLoginFinished(data);
                } else {
                    console.error("[Scene_Title] 登录接口返回数据异常", data);
                    this.onLoginFinished(fallback);
                }
            },
            fail: (err: any) => {
                console.error("[Scene_Title] 登录接口请求失败", err);
                this.onLoginFinished(fallback);
            }
        });
    }

    /** 登录流程结束（成功或失败都恢复按钮可用） */
    private onLoginFinished(info: WXUserInfo): void {
        Scene_Title.loginInfo = info || null;
        this.setButtonState(this._defaultLabel, false);

        if (info) {
            console.log("[Scene_Title] 微信登录完成", info);
            // 其它模块可监听该事件：Laya.stage.on("WX_LOGIN_SUCCESS", this, cb)
            Laya.stage.event("WX_LOGIN_SUCCESS", info);
        } else {
            console.log("[Scene_Title] 未获取到登录信息，以游客身份继续");
        }
    }

    private saveUserInfo(info: WXUserInfo): void {
        if (!info) return;
        try {
            Laya.LocalStorage.setJSON(Scene_Title.KEY_USER_INFO, info);
        } catch (e) {
            console.warn("[Scene_Title] 保存登录信息失败", e);
        }
    }

    private getCachedUserInfo(): WXUserInfo {
        try {
            const info = Laya.LocalStorage.getJSON(Scene_Title.KEY_USER_INFO);
            return info ? (info as WXUserInfo) : null;
        } catch (e) {
            return null;
        }
    }

    private setStorageItem(key: string, value: string): void {
        try {
            Laya.LocalStorage.setItem(key, value);
        } catch (e) {
            console.warn("[Scene_Title] 本地存储写入失败", e);
        }
    }

    /** 设置开始按钮的文本与可用状态 */
    private setButtonState(label: string, disabled: boolean): void {
        const btn = this.startButton;
        if (!btn) return;
        btn.label = label;
        btn.disabled = disabled;
    }

    // ------------------------------------------------------------------
    // 开始游戏
    // ------------------------------------------------------------------

    private onClickStart(): void {
        if (this._enteringGame) return;
        this._enteringGame = true;

        const btn = this.startButton;
        if (btn) btn.disabled = true;

        console.log("[Scene_Title] 开始游戏，打开场景：", this.gameSceneUrl);

        // closeOther = true：打开游戏场景时关闭标题场景
        Laya.Scene.open(this.gameSceneUrl, true, { user: Scene_Title.loginInfo })
            .catch((err: any) => {
                console.error("[Scene_Title] 打开场景失败：", this.gameSceneUrl, err);
                this._enteringGame = false;
                if (btn) btn.disabled = false;
            });
    }

    /** 获取当前登录用户信息（未登录返回 null） */
    public static getUserInfo(): WXUserInfo {
        return Scene_Title.loginInfo;
    }
}
