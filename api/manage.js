import { del, get, put } from "@vercel/blob";

const UPLOAD_PREFIX = "songs/uploads/";
const TRACK_META_PATH = "songs/track-meta.json";

function checkAdminPassword(password) {
  const expectedPassword = process.env.ADMIN_UPLOAD_PASSWORD;

  if (!expectedPassword) {
    throw new Error("管理员上传密码还没有配置。");
  }

  if (password !== expectedPassword) {
    throw new Error("管理员密码不正确，请输入 9257。");
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

async function readTrackMeta() {
  try {
    const result = await get(TRACK_META_PATH, { access: "public" });
    if (!result?.stream) return {};
    const text = await new Response(result.stream).text();
    const parsed = JSON.parse(text || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeTrackMeta(meta) {
  await put(TRACK_META_PATH, JSON.stringify(meta, null, 2), {
    access: "public",
    allowOverwrite: true,
    contentType: "application/json",
    cacheControlMaxAge: 60
  });
}

async function handleManage(body) {
  checkAdminPassword(body?.password);

  const action = body?.action;
  const fileName = body?.fileName;
  assertCloudPath(fileName);

  if (action === "delete") {
    await del(fileName);
    const meta = await readTrackMeta();
    delete meta[fileName];
    await writeTrackMeta(meta);
    return Response.json({ ok: true });
  }

  if (action === "rename") {
    const artist = String(body?.artist || "").trim();
    const title = String(body?.title || "").trim();

    if (!artist || !title) {
      throw new Error("歌手名和歌曲名都不能为空。");
    }

    const meta = await readTrackMeta();
    meta[fileName] = {
      artist,
      title,
      updatedAt: new Date().toISOString()
    };
    await writeTrackMeta(meta);

    return Response.json({
      ok: true,
      track: {
        title,
        artist,
        album: "在线上传",
        mood: "在线歌曲",
        duration: 0,
        fileName,
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
