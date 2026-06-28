import { copy, del } from "@vercel/blob";

const UPLOAD_PREFIX = "songs/uploads/";

function checkAdminPassword(password) {
  const expectedPassword = process.env.ADMIN_UPLOAD_PASSWORD;

  if (!expectedPassword) {
    throw new Error("管理员上传密码还没有配置。");
  }

  if (password !== expectedPassword) {
    throw new Error("管理员密码不正确。");
  }
}

function assertCloudPath(pathname) {
  if (!pathname || typeof pathname !== "string") {
    throw new Error("没有找到要管理的歌曲。");
  }

  if (!pathname.startsWith(UPLOAD_PREFIX) || pathname.includes("..")) {
    throw new Error("只能管理管理员上传的歌曲。");
  }
}

function getFileExtension(fileName, fallback = "mp3") {
  return fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || fallback;
}

function getContentType(extension) {
  const types = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    mp4: "audio/mp4",
    aac: "audio/aac",
    wav: "audio/wav",
    ogg: "audio/ogg",
    flac: "audio/flac"
  };

  return types[extension] || "audio/mpeg";
}

function makeSafePathPart(value) {
  return (value || "untitled")
    .trim()
    .replace(/[\\/#?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "untitled";
}

async function handleManage(body) {
  checkAdminPassword(body?.password);

  const action = body?.action;
  const fileName = body?.fileName;
  assertCloudPath(fileName);
  console.log(`[manage] action=${action} fileName=${fileName}`);

  if (action === "delete") {
    await del(fileName);
    console.log(`[manage] deleted fileName=${fileName}`);
    return Response.json({ ok: true });
  }

  if (action === "rename") {
    const artist = String(body?.artist || "").trim();
    const title = String(body?.title || "").trim();

    if (!artist || !title) {
      throw new Error("歌手名和歌曲名都不能为空。");
    }

    const extension = getFileExtension(fileName);
    const newPathname = `${UPLOAD_PREFIX}${Date.now()}-${makeSafePathPart(artist)} - ${makeSafePathPart(title)}.${extension}`;
    const copied = await copy(fileName, newPathname, {
      access: "public",
      contentType: getContentType(extension)
    });
    await del(fileName);
    console.log(`[manage] renamed from=${fileName} to=${copied.pathname}`);

    return Response.json({
      ok: true,
      track: {
        title,
        artist,
        album: "在线上传",
        mood: "在线歌曲",
        tag: extension.toUpperCase(),
        duration: 0,
        src: copied.url,
        fileName: copied.pathname,
        uploadedAt: new Date().toISOString()
      }
    });
  }

  throw new Error("不支持的管理操作。");
}

export async function POST(request) {
  try {
    const body = await request.json();
    return handleManage(body);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const result = await handleManage(request.body || {});
    const resultBody = await result.json();
    response.status(result.status).json(resultBody);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
}
