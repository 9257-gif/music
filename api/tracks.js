import { list } from "@vercel/blob";

function parseTrackName(pathname, index) {
  const fileName = pathname.split("/").pop() || `song-${index + 1}`;
  const cleanName = fileName.replace(/^\d+-/, "").replace(/\.[^/.]+$/, "");
  const [artistPart, ...titleParts] = cleanName.split(" - ");
  const artist = artistPart?.trim() || "未知歌手";
  const title = titleParts.join(" - ").trim() || cleanName || "未命名歌曲";

  return { artist, title };
}

export async function GET() {
  try {
    const result = await list({ prefix: "songs/uploads/", limit: 1000 });
    const tracks = result.blobs
      .filter((blob) => /^audio\//.test(blob.contentType || ""))
      .map((blob, index) => {
        const meta = parseTrackName(blob.pathname, index);
        return {
          title: meta.title,
          artist: meta.artist,
          album: "在线上传",
          mood: "在线歌曲",
          tag: (blob.contentType || "audio").split("/")[1]?.toUpperCase() || "Audio",
          duration: 0,
          src: blob.url,
          fileName: blob.pathname
        };
      });

    return Response.json({ tracks });
  } catch (error) {
    return Response.json({ tracks: [], error: error.message }, { status: 200 });
  }
}

export default async function handler(_request, response) {
  const result = await GET();
  const body = await result.json();
  response.status(result.status).json(body);
}
