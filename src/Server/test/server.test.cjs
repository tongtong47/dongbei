const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const { createHmac } = require("node:crypto");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");
const { test } = require("node:test");

const root = path.join(__dirname, "..");
const testEnv = {
    ...process.env,
    HOST: "127.0.0.1",
    WX_APPID: "wx" + "0".repeat(16),
    WX_APPSECRET: "0".repeat(32),
    TOKEN_SECRET: "test-only-signing-key".repeat(3),
    CORS_ORIGINS: "https://game.example",
};

async function reservePort() {
    const server = net.createServer().listen(0, testEnv.HOST);
    await once(server, "listening");
    const port = server.address().port;
    await new Promise((resolve) => server.close(resolve));
    return String(port);
}

test("启动拒绝缺失密钥", () => {
    const result = spawnSync(process.execPath, ["dist/server.js"], {
        cwd: root,
        env: { ...testEnv, PORT: "3000", TOKEN_SECRET: "" },
        encoding: "utf8",
        timeout: 5000,
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /TOKEN_SECRET/);
});

test("登录、鉴权、榜单和持久化", { timeout: 20000 }, async (t) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "dongbei-test-"));
    const file = path.join(dir, "users.json");
    const backup = path.join(dir, "backup.json");
    await fs.writeFile(file, JSON.stringify({
        legacy_player: { openId: "legacy_player", nickName: "老玩家", score: 20, createTime: 1, updateTime: 2 },
    }));

    const port = await reservePort();
    const base = "http://127.0.0.1:" + port;
    let child;
    async function stop() {
        if (child && child.exitCode === null && child.signalCode === null) {
            const exited = once(child, "exit");
            child.kill();
            await exited;
        }
    }
    t.after(async () => {
        await stop();
        await fs.rm(dir, { recursive: true, force: true });
    });

    async function start() {
        child = spawn(process.execPath, ["--require", "./test/wechat-stub.cjs", "dist/server.js"], {
            cwd: root,
            env: { ...testEnv, PORT: port, DATA_FILE: file },
            stdio: ["ignore", "pipe", "pipe"],
        });
        let output = "";
        child.stderr.on("data", (chunk) => { output += chunk; });
        child.stdout.resume();
        for (let i = 0; i < 100 && child.exitCode === null; i++) {
            const response = await fetch(base + "/api/health", { signal: AbortSignal.timeout(500) }).catch(() => null);
            if (response?.ok) {
                assert.equal((await response.json()).ok, true);
                return;
            }
            await delay(50);
        }
        assert.fail("服务未启动\n" + output);
    }

    async function request(route, status, options) {
        const response = await fetch(base + "/api/" + route, options);
        assert.equal(response.status, status, route);
        assert.equal(response.headers.get("cache-control"), "no-store");
        return response.json();
    }

    function post(route, body, status = 200) {
        return request(route, status, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        });
    }

    await start();
    const preflight = await fetch(base + "/api/score", { method: "OPTIONS", headers: { Origin: "https://game.example" } });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), "https://game.example");
    const foreign = await fetch(base + "/api/health", { headers: { Origin: "https://foreign.example" } });
    assert.equal(foreign.headers.get("access-control-allow-origin"), null);
    await foreign.json();

    await request("wxlogin", 405);
    await request("unknown", 404);
    await request("score", 400, { method: "POST", body: "{" });
    await post("wxlogin", { code: "坏".repeat(3000) }, 413);
    const chunked = new ReadableStream({
        start(controller) {
            controller.enqueue(Buffer.alloc(5000));
            controller.enqueue(Buffer.alloc(5000));
            controller.close();
        },
    });
    await request("score", 413, { method: "POST", body: chunked, duplex: "half" });
    await post("wxlogin", { code: 123 }, 400);
    const invalid = await post("wxlogin", { code: "bad-code" }, 401);
    assert.equal(invalid.errcode, 40029);
    assert.doesNotMatch(JSON.stringify(invalid), /upstream detail/);
    await post("wxlogin", { code: "busy" }, 502);
    await post("wxlogin", { code: "timeout" }, 504);

    const login = await post("wxlogin", { code: "new_player", nickName: "新玩家" });
    assert.equal(login.openId, "new_player");
    assert.equal(login.user.score, 0);
    assert.doesNotMatch(JSON.stringify(login), /private-session-key/);
    const { token } = login;
    const auth = { headers: { Authorization: "Bearer " + token } };
    const tampered = Buffer.from(token, "base64").toString("utf8").replace(/^new_player/, "legacy_player");
    await request("user", 401, { headers: { Authorization: "Bearer " + Buffer.from(tampered).toString("base64") } });
    const expired = "new_player." + (Date.now() - 1000);
    const signature = createHmac("sha256", testEnv.TOKEN_SECRET).update(expired).digest("hex");
    const expiredToken = Buffer.from(expired + "." + signature).toString("base64");
    await request("user", 401, { headers: { Authorization: "Bearer " + expiredToken } });
    await request("user?token=" + encodeURIComponent(token), 200);
    for (const score of [null, "80", -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        await post("score", { token, score }, 400);
    }
    await Promise.all([100, 300, 50, 200].map((score) => post("score", { token, score })));
    assert.equal((await request("user", 200, auth)).user.score, 300);

    const updated = await post("wxlogin", { code: "new_player", nickName: "更新昵称", avatarUrl: "https://game.example/avatar.png" });
    assert.equal(updated.user.score, 300);
    assert.deepEqual((await request("rank?limit=1", 200)).list, [
        { nickName: "更新昵称", avatarUrl: "https://game.example/avatar.png", score: 300 },
    ]);
    await request("rank?limit=-1", 400);

    await fs.rename(file, backup);
    await fs.mkdir(file);
    await post("score", { token, score: 400 }, 500);
    assert.equal((await request("user", 200, auth)).user.score, 300);
    await fs.rmdir(file);
    await fs.rename(backup, file);
    assert.deepEqual(await fs.readdir(dir), ["users.json"]);

    await stop();
    await start();
    assert.equal((await request("user", 200, auth)).user.score, 300);
    assert.deepEqual((await request("rank", 200)).list.map((user) => user.score), [300, 20]);

    await stop();
    await fs.writeFile(file, "{broken");
    const broken = spawnSync(process.execPath, ["dist/server.js"], {
        cwd: root,
        env: { ...testEnv, PORT: port, DATA_FILE: file },
        encoding: "utf8",
        timeout: 5000,
    });
    assert.equal(broken.status, 1, broken.stderr);
    assert.equal(await fs.readFile(file, "utf8"), "{broken");
});
