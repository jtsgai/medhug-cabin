# MedHug Cabin · JT Virtual Try-On

全息舱前端：Decart Lucy 实时试衣 + Kids 变身 + FX + Stage + LiveAvatar 实时数字人。

## 本地运行

```bash
cp config.example.js config.js
# 编辑 config.js，填入 dct_ 开头的 API Key

cp talk/config.example.js talk/config.js
# 编辑 talk/config.js，填入 LiveAvatar 嵌入链接

npx serve .
```

摄像头与 API 仅在点「试穿」后连接。TALK 模式仅在点「开始对话」后开启 LiveAvatar。

## Modes

| Path | Role |
|------|------|
| `/` `index.html` | Virtual try-on |
| `/kids/` | Character transform |
| `/fx/` | Light effects |
| `/stage/` | 3D friends |
| `/talk/` | Realtime digital human (LiveAvatar) |
| `home.html` | Mode picker |

## TALK 简易版

1. 打开 [app.liveavatar.com](https://app.liveavatar.com) 创建公共形象 + Knowledge Base
2. 复制 Embed / Share URL
3. 写进舱机 `talk/config.js` 的 `LIVEAVATAR_EMBED_URL`
4. 舱内打开 `/talk/`，点开始，默认 5 分钟自动结束

有自建 token 代理时改填 `LIVEAVATAR_TOKEN_URL`，页面会走 `@heygen/liveavatar-web-sdk`。

## GitHub Pages + 域名 medhug.ai

1. Settings → Pages → Source: branch `main` / root
2. Custom domain: `medhug.ai`（仓库已含 `CNAME`）
3. DNS:

| Type | Host | Value |
|------|------|-------|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| CNAME | www | jtsgai.github.io |

4. Enable Enforce HTTPS after DNS propagates.

Do **not** commit API keys. Keep `config.js` local (gitignored).

## Layout rules (locked)

- Explore: page-based 2×2, snap scroll, 3:4 cells hug images, 4 visible
- Left panel ~66.67% height
- Featured/explore: object-fit contain, no crop
- API only on try-on; disconnect on exit
