import { handleUpload } from "@vercel/blob/client";

function parsePayload(payload) {
  try {
    return JSON.parse(payload || "{}");
  } catch {
    return {};
  }
}

async function handleRequest(request, body) {
  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async (_pathname, clientPayload) => {
      const payload = parsePayload(clientPayload);
      const expectedPassword = process.env.ADMIN_UPLOAD_PASSWORD;

      if (!expectedPassword) {
        throw new Error("管理员上传密码还没有配置。");
      }

      if (payload.password !== expectedPassword) {
        throw new Error("管理员密码不正确。");
      }

      return {
        allowedContentTypes: [
          "audio/mpeg",
          "audio/mp3",
          "audio/mp4",
          "audio/aac",
          "audio/wav",
          "audio/x-wav",
          "audio/ogg",
          "audio/flac"
        ],
        maximumSizeInBytes: 60 * 1024 * 1024,
        tokenPayload: JSON.stringify({
          artist: payload.artist || "",
          title: payload.title || ""
        })
      };
    },
    onUploadCompleted: async () => {}
  });

  return Response.json(jsonResponse);
}

export async function POST(request) {
  const body = await request.json();
  return handleRequest(request, body);
}

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const result = await handleRequest(request, request.body);
    const body = await result.json();
    response.status(result.status).json(body);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
}
