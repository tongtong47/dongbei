const { regClass, property } = Laya;

@regClass()
export class Main extends Laya.Script {

    /**
     * 资源来源（全局开关）：
     *   local -> 资源打进小游戏包里（现状）
     *   cdn   -> 所有资源从 resourceBase 拉，包里只留代码
     * 线上要切成 cdn，只需把下面两项改一下，并把域名加到微信后台
     * 「downloadFile 合法域名」+「request 合法域名」（必须 https）。
     */
    @property({ type: "string", tips: "local=包内资源；cdn=远程加载" })
    public resourceSource: string = "local";

    /**
     * CDN 根目录，对应 assets 目录（下面保持 resources/... 结构不变）。
     * 例：https://cdn.xxx.com/dongbei/
     * 传上去之后：resources/Gameinfo/dic_dongbei.json、resources/Dubbing/0001.mp3、resources/UI/... 都要能访问到。
     */
    @property({ type: "string", tips: "cdn 模式下的资源根地址，末尾自动补 /；留空则退回包内" })
    public resourceBase: string = "";

    onStart() {
        console.log("Game start");

        if (this.resourceSource === "cdn" && this.resourceBase) {
            let base = this.resourceBase;
            if (base.charAt(base.length - 1) !== "/") base += "/";

            // 关键一行：设了它，之后所有相对路径资源（场景皮肤、图集、题库、配音）都自动走 CDN
            Laya.URL.basePath = base;
            console.log("[Main] 资源来源：CDN -> " + base);
        } else {
            console.log("[Main] 资源来源：包内 local");
        }
    }
}
