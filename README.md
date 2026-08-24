# MedHug Cabin · JT Virtual Try-On

全息舱实时虚拟试衣前端（Decart Lucy VTON realtime）。

## 本地运行

```bash
cp config.example.js config.js
# 编辑 config.js，填入 dct_ 开头的 API Key

npx serve .
```

摄像头与 API 仅在点「试穿」后连接。

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

## Files

| File | Role |
|------|------|
| index.html | Customer UI |
| admin.html | Layout admin |
| app.js | Try-on + Decart |
| styles.css | Cabin UI |
| catalog.json | Catalog |
| layout.json | Layout params |
