# 《我爱东北方言》后端部署

## 1. 配置密钥

在 `src/Server` 目录复制 `.env.example` 为 `.env`，填入微信公众平台上该小游戏的 `WX_APPID` 和 `WX_APPSECRET`。旧版曾把 AppSecret 和签名密钥写入源码及构建产物。上线前先在微信公众平台重置 AppSecret，再生成新的签名密钥。部署新签名密钥后，玩家重新进入首页登录即可获取新令牌。

```sh
cp .env.example .env
chmod 600 .env
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

把生成值填入 `TOKEN_SECRET`，服务重启和更新时复用该值。可选的 `CORS_ORIGINS` 填允许访问接口的浏览器页面源，例如 `http://localhost:18090`，多个用逗号分隔。微信小游戏的请求域名另在微信后台配置。

## 2. 启动后端

**Docker Compose**

```sh
docker compose up -d --build
docker compose ps
curl --fail http://127.0.0.1:3000/api/health
```

容器以普通用户运行，宿主机只在回环地址发布端口。命名卷保留玩家和排行榜数据。此部署使用单进程文件存储，请运行一个实例。更新用同一 Compose 项目执行 `docker compose up -d --build`，保留数据卷。

**直接运行 Node.js**

安装 Node.js 24 LTS。在 `src/Server` 目录执行以下命令，生产环境由进程管理器启动最后一行。可在 `.env` 设置绝对路径 `DATA_FILE`，其所在目录须允许服务账号读写。默认监听 `127.0.0.1:3000`，默认存档为 `dist/data/users.json`。

```sh
npm ci
npm test
node --env-file=.env dist/server.js
```

## 3. 对外提供 HTTPS

让宿主机的 HTTPS 反向代理把 `/api/` 转发到 `http://127.0.0.1:3000`。部署入口应限制请求频率和请求体大小。下面的 Nginx 配置片段可并入已有 TLS 虚拟主机。

```nginx
# 放在 http 块内
limit_req_zone $binary_remote_addr zone=dongbei_api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=dongbei_login:10m rate=12r/m;

# 放在已有的 HTTPS server 块内
client_max_body_size 8k;
proxy_read_timeout 20s;
limit_req_status 429;

location = /api/wxlogin {
    limit_req zone=dongbei_login burst=6 nodelay;
    proxy_pass http://127.0.0.1:3000;
}
location /api/ {
    limit_req zone=dongbei_api burst=30 nodelay;
    proxy_pass http://127.0.0.1:3000;
}
```

- 在微信公众平台将正式 HTTPS 域名加入小游戏的 request 合法域名。将 `src/Client/Scene_Title.ts` 中的 `apiBaseUrl` 改为同一域名，末尾不加斜杠，然后重新发布客户端。
- 先访问正式域名的 `/api/health`，再用微信真机打开游戏。验证首页登录、答对一题后排行榜出现成绩，以及服务重启后成绩仍在。健康检查只检查后端进程是否就绪，微信联调以真机为准。

## 4. 数据备份和迁移

旧版 `users.json` 可以直接读取。迁移时先停旧进程，备份原文件，再放到新服务的 `DATA_FILE` 路径后启动。Compose 中的实际路径为容器内 `/app/data/users.json`。

如需导入旧文件，先把副本命名为 `users.json` 放在当前目录，再执行以下命令。先备份目标卷已有的数据。下面的命令会替换目标卷中的同名文件。

```sh
docker compose stop backend
docker compose run --rm --no-deps -T backend sh -c 'umask 077; cat > /app/data/users.import && mv /app/data/users.import /app/data/users.json' < users.json
docker compose up -d
```

运行中可执行 `docker compose cp backend:/app/data/users.json ./users.backup.json` 备份。存档包含玩家标识，备份应限制访问。存档损坏时，服务会拒绝启动并保留文件，以便从备份恢复。

## API

| 接口 | 请求 | 成功响应 |
| --- | --- | --- |
| `POST /api/wxlogin` | JSON `{ code, nickName?, avatarUrl? }` | `{ openId, token, user }` |
| `GET /api/user` | `Authorization: Bearer <token>` | `{ user }` |
| `POST /api/score` | JSON `{ token, score }`，也可用 Bearer 令牌 | `{ user }`，保留历史最高分 |
| `GET /api/rank?limit=10` | 默认 20 条，最多 100 条 | `{ list }`，包含昵称、头像和分数 |
| `GET /api/health` | 无 | `{ ok, time }` |

新接入请通过 Bearer 头传令牌。旧版查询字符串传令牌仍可用，使用该形式时须确保代理及应用链路的日志不记录查询字符串。成绩由已登录的客户端上报，后端验证格式和身份，排行榜沿用休闲玩法的计分规则，客户端能自行构造分数，适用范围为休闲榜。每日挑战和图鉴继续使用客户端本地存储。
