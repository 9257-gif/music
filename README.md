# Music Player

一个纯静态音乐播放器页面，支持公开歌曲库、本机临时试听、播放队列、搜索、分类、音量、进度、随机和循环。

## 让别人也能听到你的歌曲

浏览器里的“本机临时试听”只在你自己的电脑可用，别人打开网址听不到。

要发布歌曲：

1. 把 MP3、M4A 或 WAV 文件放进 `songs/` 文件夹。
2. 编辑 `songs/manifest.json`，把每首歌的 `src` 指向对应文件。
3. 提交并推送到 GitHub。
4. Vercel 会自动重新部署。

示例：

```json
{
  "title": "我的歌曲",
  "artist": "我的歌手名",
  "album": "我的歌单",
  "mood": "流行",
  "tag": "MP3",
  "duration": 0,
  "src": "./songs/my-song.mp3"
}
```

部署目标：

```text
https://9257-gif.github.io/music/
```
