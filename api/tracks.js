import { get, list } from "@vercel/blob";

const TRACK_META_PATH = "songs/track-meta.json";

function parseTrackName(pathname, index) {
  const fileName = pathname.split("/").pop() || `song-${index + 1}`;
  const cleanName = fileName.replace(/^\d+-/, "").replace(/\.[^/.]+$/, "");
  const [artistPart, ...titleParts] = cleanName.split(" - ");
  const artist = artistPart?.trim() || "未知歌手";
  const title = titleParts.join(" - ").trim() || cleanName || "未命名歌曲";

  return { artist, title };
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

export async function GET() {
  try {
    const savedMeta = await readTrackMeta();
    const result = await list({ prefix: "songs/uploads/", limit: 1000 });
    const tracks = result.blobs
      .sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime())
      .map((blob, index) => {
        const meta = parseTrackName(blob.pathname, index);
        const override = savedMeta[blob.pathname] || {};
        const extension = blob.pathname.split(".").pop()?.toUpperCase() || "AUDIO";
        return {
          title: override.title || meta.title,
          artist: override.artist || meta.artist,
          album: "在线上传",
          mood: "在线歌曲",
          tag: (blob.contentType || "").split("/")[1]?.toUpperCase() || extension,
          duration: 0,
          src: blob.url,
          fileName: blob.pathname,
          uploadedAt: blob.uploadedAt
        };
      });

    return Response.json({ tracks }, {
      headers: {
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return Response.json({ tracks: [], error: error.message }, {
      status: 200,
      headers: {
        "Cache-Control": "no-store"
      }
    });
  }
}

export default async function handler(_request, response) {
  const result = await GET();
  const body = await result.json();
  response.status(result.status).json(body);
}
