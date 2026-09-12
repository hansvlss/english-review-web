# 英语自建词书网页版 MVP

移动优先的 React + TypeScript + Vite 网页，已经包含手机号登录界面、词书与条目管理、固定间隔复习、每日打卡、音标查询入口和英文朗读。

## 本地运行

需要 Node.js 20 或更高版本：

```bash
pnpm install
pnpm dev
```

未配置环境变量时会进入本地测试模式：手机号可填写任意有效的中国大陆 11 位号码，验证码为 `123456`，业务数据保存在浏览器 `localStorage`。

## 服务端接口

复制 `.env.example` 为 `.env.local` 后可配置：

- `VITE_API_BASE_URL`：账号接口及 `POST /submitReview` 的基础地址。
- `VITE_TTS_ENDPOINT`：微软语音接口地址。测试阶段留空，优先使用免费的浏览器系统语音；后续填 `/api/tts` 即可启用微软神经语音。
- `VITE_IPA_ENDPOINT`：接收 `{ text }`，返回 `{ ipa }`。

后续接入微软神经语音时，独立服务端需要配置：

- `AZURE_SPEECH_KEY`：Azure Speech 资源密钥，只能保存在服务端。
- `AZURE_SPEECH_REGION`：Azure Speech 资源区域，例如资源控制台显示的区域代码。
- `AZURE_SPEECH_VOICE`：可选，默认 `en-US-JennyNeural`。

服务端接口返回 MP3 音频；微软语音不可用时，前端自动回退到浏览器系统朗读。当前测试版不配置该接口，不产生微软语音费用。

普通词书和条目目前使用本地数据适配器。接入 CloudBase 时，应按 `ownerId` 写数据库权限规则，并将相同的数据结构替换为 CloudBase SDK 调用。

## 验证

```bash
pnpm test
pnpm build
```

复习间隔为 1、3、7、14、30、60、120 天；“忘了”降低一级并在 1 分钟后重新到期。网络版 `submitReview` 写入失败时不会切换到下一条。
