# 《我爱东北方言》分层 UI 实装

- 项目：`E:\Yijue\dongbei`（LayaAir 3.2.9，1080×2160 竖屏）。
- 资源：`assets/resources/UI/Dongbei/`，32 张独立图层 PNG（含冬日背景、面板、按钮各状态、答案槽、字块、信息条等）和 5 张供 Laya `Button.stateNum=3` 使用的状态合图；每张都有 `.meta`。
- 场景：`Scene_Title.ls`、`Scene_Game.ls`、`Scene_Rank.ls`、`Scene_Daily.ls`、`Scene_Album.ls`、`Scene_Settings.ls`。
- 脚本：`Scene_Title.ts` 保留微信登录及入口；`Scene_Game.ts` 保留答题、配音、计分并接入每日挑战、图鉴、设置，以及提示中、答对后、难度切换三种独立面板状态；`Scene_Extra.ts` 驱动四个独立菜单场景。
- 设计源：本工作目录的 `ui_style_lock.json`、`layer_manifest.json`、`png_layers/`，以及六张 `preview_Scene_*.png`。预览由场景节点和相同 PNG 合成，不是 Laya 运行截图。
- 验证：TypeScript `tsc --noEmit`、六场景节点/皮肤 UUID 检查、透明组件 alpha 检查通过。尚需在 Laya IDE 的运行模式逐项点击与微信端验收。

登录、排行榜及成绩上报仍使用原项目配置的 `localhost:3000` 接口；没有服务器时离线答题可用，排行榜显示不可用状态。
