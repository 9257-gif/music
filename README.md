# Music Player

一个纯静态音乐播放器页面，支持公开歌曲库、本机临时试听、播放队列、搜索、分类、音量、进度、随机和循环。

## 管理员网页上传

项目支持在网页里上传歌曲到 Vercel Blob。上传后，所有访问网站的人都能播放。

部署前需要在 Vercel 项目里配置两个环境变量：

- `BLOB_READ_WRITE_TOKEN`：Vercel Blob 存储的读写令牌
- `ADMIN_UPLOAD_PASSWORD`：管理员上传密码，只有知道这个密码的人可以上传

前台上传入口会要求输入管理员密码。普通访客不知道密码时无法上传，只能听歌。

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
https://music-eight-ochre.vercel.app
```

请使用 Vercel 地址访问管理功能。GitHub Pages 是静态页面，不能执行上传、改名、删除这类后台操作。
