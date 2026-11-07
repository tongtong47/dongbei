const assert = require("node:assert/strict");

globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.origin, "https://api.weixin.qq.com");
    assert.equal(url.pathname, "/sns/jscode2session");
    assert.equal(url.searchParams.get("grant_type"), "authorization_code");
    assert.equal(url.searchParams.get("appid"), process.env.WX_APPID);
    assert.equal(url.searchParams.get("secret"), process.env.WX_APPSECRET);
    assert.equal(options.redirect, "error");
    assert.ok(options.signal instanceof AbortSignal);

    const code = url.searchParams.get("js_code");
    if (code === "bad-code") return Response.json({ errcode: 40029, errmsg: "upstream detail" });
    if (code === "busy") return new Response("upstream detail", { status: 503 });
    if (code === "timeout") throw new DOMException("upstream detail", "TimeoutError");
    return Response.json({ openid: code, session_key: "private-session-key" });
};
