import { upload } from "@vercel/blob/client";

const CANONICAL_SITE_URL = "https://music-eight-ochre.vercel.app";
const API_BASE_URL = window.location.hostname.endsWith("github.io") ? CANONICAL_SITE_URL : "";

if (window.location.hostname.endsWith("github.io")) {
  window.location.replace(CANONICAL_SITE_URL);
}

const tracks = [];
let cloudTrackIndexes = [];

const coverPalette = [
  "linear-gradient(135deg, #211f1a 0%, #4fc3a6 44%, #efc45a 100%)",
  "linear-gradient(135deg, #1d2027 0%, #7b6bd6 45%, #e66f58 100%)",
  "linear-gradient(135deg, #1e1714 0%, #b66a48 45%, #f2d47a 100%)",
  "linear-gradient(135deg, #111d1b 0%, #2c8f79 45%, #f7f4ea 100%)",
  "linear-gradient(135deg, #151515 0%, #735a3a 42%, #efc45a 100%)"
];

const state = {
  current: 0,
  elapsed: 0,
  playing: false,
  repeat: false,
  shuffle: false,
  liked: new Set([0]),
  mood: "全部",
  query: "",
  timer: null,
  audio: null,
  oscillator: null,
  lfo: null,
  gain: null,
  filter: null,
  media: null,
  volume: 0.72
};

const els = {
  trackList: document.querySelector("#trackList"),
  queueList: document.querySelector("#queueList"),
  moodTabs: document.querySelector("#moodTabs"),
  searchInput: document.querySelector("#searchInput"),
  musicUpload: document.querySelector("#musicUpload"),
  cloudMusicUpload: document.querySelector("#cloudMusicUpload"),
  cloudUploadButton: document.querySelector("#cloudUploadButton"),
  cloudFileName: document.querySelector("#cloudFileName"),
  cloudTrackList: document.querySelector("#cloudTrackList"),
  cloudTrackCount: document.querySelector("#cloudTrackCount"),
  refreshCloudButton: document.querySelector("#refreshCloudButton"),
  adminPassword: document.querySelector("#adminPassword"),
  adminArtist: document.querySelector("#adminArtist"),
  adminTitle: document.querySelector("#adminTitle"),
  uploadHint: document.querySelector("#uploadHint"),
  trackCount: document.querySelector("#trackCount"),
  albumArt: document.querySelector("#albumArt"),
  title: document.querySelector("#trackTitle"),
  artist: document.querySelector("#trackArtist"),
  mood: document.querySelector("#trackMood"),
  currentTime: document.querySelector("#currentTime"),
  duration: document.querySelector("#duration"),
  progress: document.querySelector("#progressBar"),
  playButton: document.querySelector("#playButton"),
  playIcon: document.querySelector("#playIcon"),
  playStatus: document.querySelector("#playStatus"),
  prevButton: document.querySelector("#prevButton"),
  nextButton: document.querySelector("#nextButton"),
  repeatButton: document.querySelector("#repeatButton"),
  shuffleButton: document.querySelector("#shuffleButton"),
  shuffleListButton: document.querySelector("#shuffleListButton"),
  likeButton: document.querySelector("#likeButton"),
  volume: document.querySelector("#volumeBar"),
  volumeValue: document.querySelector("#volumeValue"),
  queueButton: document.querySelector("#queueButton"),
  queueBackButton: document.querySelector("#queueBackButton"),
  queuePanel: document.querySelector("#queuePanel"),
  queueState: document.querySelector("#queueState"),
  sessionMood: document.querySelector("#sessionMood"),
  eq: document.querySelector(".mini-eq"),
  toastLayer: document.querySelector("#toastLayer")
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = "info") {
  if (!els.toastLayer) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <iconify-icon icon="${type === "error" ? "solar:danger-circle-linear" : type === "success" ? "solar:check-circle-linear" : "solar:info-circle-linear"}"></iconify-icon>
    <span>${escapeHtml(message)}</span>
  `;
  els.toastLayer.append(toast);
  window.setTimeout(() => toast.classList.add("show"), 20);
  window.setTimeout(() => {
    toast.classList.remove("show");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3200);
}

function splitFileName(name) {
  const cleanName = name.replace(/\.[^/.]+$/, "").trim() || "本地音乐";
  const parts = cleanName.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { artist: "本地文件", title: cleanName };
}

function getFileExtension(fileName, fallback = "mp3") {
  return fileName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || fallback;
}

function makeSafePathPart(value) {
  return (value || "untitled")
    .trim()
    .replace(/[\\/#?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80) || "untitled";
}

function makeUploadCover(index) {
  return coverPalette[index % coverPalette.length];
}

function normalizeTrack(track, index) {
  return {
    title: track.title || "未命名歌曲",
    artist: track.artist || "未知歌手",
    album: track.album || "公开歌曲库",
    mood: track.mood || "公开歌曲",
    tag: track.tag || "Audio",
    duration: Number(track.duration) || 0,
    src: track.src,
    fileName: track.fileName || track.src,
    uploadedAt: track.uploadedAt || "",
    cover: track.cover || makeUploadCover(index),
    source: track.source || "static",
    published: true
  };
}

function rebuildCloudIndexes() {
  cloudTrackIndexes = tracks
    .map((track, index) => ({ track, index }))
    .filter(({ track }) => track.source === "cloud")
    .map(({ index }) => index);
}

async function loadPublishedTracks() {
  const loadedTracks = [];

  try {
    const response = await fetch("./songs/manifest.json", { cache: "no-store" });
    if (!response.ok) throw new Error("manifest missing");
    const data = await response.json();
    const publishedTracks = Array.isArray(data.tracks) ? data.tracks : [];
    publishedTracks
      .filter((track) => track.src)
      .map((track, index) => normalizeTrack({ ...track, source: "static" }, index))
      .forEach((track) => loadedTracks.push(track));
  } catch {
    // No repository songs yet. Blob songs may still be available.
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/tracks`, { cache: "no-store" });
    if (!response.ok) throw new Error("cloud tracks unavailable");
    const data = await response.json();
    const cloudTracks = Array.isArray(data.tracks) ? data.tracks : [];
    cloudTracks
      .filter((track) => track.src)
      .map((track, index) => normalizeTrack({ ...track, source: "cloud" }, loadedTracks.length + index))
      .forEach((track) => loadedTracks.push(track));
  } catch {
    // Local preview or missing Blob configuration. The static library still works.
  }

  tracks.splice(0, tracks.length, ...loadedTracks);
  rebuildCloudIndexes();
}

function getMoods() {
  return ["全部", ...Array.from(new Set(tracks.map((track) => track.mood)))];
}

function getVisibleTracks() {
  const query = state.query.trim().toLowerCase();
  return tracks
    .map((track, index) => ({ ...track, index }))
    .filter((track) => state.mood === "全部" || track.mood === state.mood)
    .filter((track) => {
      const haystack = `${track.title} ${track.artist} ${track.album} ${track.tag}`.toLowerCase();
      return haystack.includes(query);
    });
}

function renderMoods() {
  els.moodTabs.innerHTML = getMoods()
    .map((mood) => `<button class="mood-tab ${mood === state.mood ? "active" : ""}" data-mood="${mood}">${mood}</button>`)
    .join("");

  els.moodTabs.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.mood = button.dataset.mood;
      render();
    });
  });
}

function renderTrackList() {
  const visibleTracks = getVisibleTracks();
  els.trackCount.textContent = `${visibleTracks.length} 首歌曲`;

  if (!visibleTracks.length) {
    const hasQuery = state.query || state.mood !== "全部";
    els.trackList.innerHTML = hasQuery
      ? `<div class="empty-list">没有找到匹配的歌曲</div>`
      : `<div class="empty-list">
          <strong>还没有公开歌曲</strong>
          <span>用左侧“管理员上传”发布歌曲，或把文件放入 <code>songs/</code> 后部署。</span>
        </div>`;
    return;
  }

  els.trackList.innerHTML = visibleTracks.map((track) => `
    <button class="track-row ${track.index === state.current ? "active" : ""}" data-index="${track.index}">
      <span class="cover" style="--cover:${track.cover}"></span>
      <span class="track-copy">
        <strong>${escapeHtml(track.title)}</strong>
        <span>${escapeHtml(track.artist)} · ${escapeHtml(track.album)}</span>
      </span>
      <span class="track-duration">${track.duration ? formatTime(track.duration) : "读取中"}</span>
    </button>
  `).join("");

  els.trackList.querySelectorAll(".track-row").forEach((button) => {
    button.addEventListener("click", () => selectTrack(Number(button.dataset.index), true));
  });
}

function renderCloudTrackList() {
  els.cloudTrackCount.textContent = `${cloudTrackIndexes.length} 首`;

  if (!cloudTrackIndexes.length) {
    els.cloudTrackList.innerHTML = `<div class="empty-list compact">
      <strong>暂无管理员上传歌曲</strong>
      <span>上传成功后会自动出现在这里。</span>
    </div>`;
    return;
  }

  els.cloudTrackList.innerHTML = cloudTrackIndexes.map((trackIndex) => {
    const track = tracks[trackIndex];
    return `
      <div class="cloud-track-row ${trackIndex === state.current ? "active" : ""}" data-index="${trackIndex}">
        <button class="cloud-play-button" type="button" data-index="${trackIndex}" aria-label="播放 ${escapeHtml(track.title)}">
          <span class="queue-cover" style="--cover:${track.cover}"></span>
          <span class="queue-copy">
            <strong>${escapeHtml(track.title)}</strong>
            <span>${escapeHtml(track.artist)} · ${track.duration ? formatTime(track.duration) : "在线歌曲"}</span>
          </span>
          <iconify-icon icon="solar:play-circle-linear"></iconify-icon>
        </button>
        <span class="cloud-manage-actions" aria-label="管理歌曲">
          <button type="button" class="cloud-manage-button" data-action="rename" data-index="${trackIndex}">
            <iconify-icon icon="solar:pen-2-linear"></iconify-icon>
            改名
          </button>
          <button type="button" class="cloud-manage-button danger" data-action="delete" data-index="${trackIndex}">
            <iconify-icon icon="solar:trash-bin-trash-linear"></iconify-icon>
            删除
          </button>
        </span>
      </div>
    `;
  }).join("");

  els.cloudTrackList.querySelectorAll(".cloud-play-button").forEach((button) => {
    button.addEventListener("click", () => selectTrack(Number(button.dataset.index), true));
  });
  els.cloudTrackList.querySelectorAll(".cloud-manage-button").forEach((button) => {
    button.addEventListener("click", () => manageCloudTrack(button.dataset.action, Number(button.dataset.index)));
  });
}

function renderQueue() {
  if (!tracks.length) {
    els.queueList.innerHTML = `<div class="empty-list compact">暂无播放队列</div>`;
    return;
  }

  els.queueList.innerHTML = tracks.map((track, index) => `
    <button class="queue-row ${index === state.current ? "active" : ""}" data-index="${index}">
      <span class="queue-cover" style="--cover:${track.cover}"></span>
      <span class="queue-copy">
        <strong>${escapeHtml(track.title)}</strong>
        <span>${escapeHtml(track.mood)} · ${track.duration ? formatTime(track.duration) : "读取中"}</span>
      </span>
    </button>
  `).join("");

  els.queueList.querySelectorAll(".queue-row").forEach((button) => {
    button.addEventListener("click", () => {
      selectTrack(Number(button.dataset.index), true);
      els.queuePanel.classList.remove("open");
      els.queueButton.classList.remove("active");
    });
  });
}

function renderNowPlaying() {
  if (!tracks.length) {
    els.albumArt.style.setProperty("--cover", makeUploadCover(0));
    els.albumArt.classList.remove("playing");
    els.title.textContent = "等待添加歌曲";
    els.artist.textContent = "把你的音频文件放进 songs 文件夹，部署后别人也能听";
    els.mood.textContent = "公开歌曲库";
    els.currentTime.textContent = "0:00";
    els.duration.textContent = "0:00";
    els.progress.value = 0;
    els.playIcon.setAttribute("icon", "solar:play-bold");
    els.playStatus.textContent = "No songs";
    els.eq.classList.remove("playing");
    els.queueState.textContent = "暂无歌曲";
    els.sessionMood.textContent = "等待发布歌曲";
    return;
  }

  const track = tracks[state.current];
  const progress = track.duration ? (state.elapsed / track.duration) * 100 : 0;

  els.albumArt.style.setProperty("--cover", track.cover);
  els.albumArt.classList.toggle("playing", state.playing);
  els.title.textContent = track.title;
  els.artist.textContent = `${track.artist} · ${track.album}`;
  els.mood.textContent = track.mood;
  els.currentTime.textContent = formatTime(state.elapsed);
  els.duration.textContent = track.duration ? formatTime(track.duration) : "0:00";
  els.progress.value = Math.min(100, progress);
  els.playIcon.setAttribute("icon", state.playing ? "solar:pause-bold" : "solar:play-bold");
  els.playStatus.textContent = state.playing ? "Playing" : "Ready";
  els.repeatButton.classList.toggle("active", state.repeat);
  els.shuffleButton.classList.toggle("active", state.shuffle);
  els.shuffleListButton.classList.toggle("active", state.shuffle);
  els.likeButton.classList.toggle("active", state.liked.has(state.current));
  els.eq.classList.toggle("playing", state.playing);
  els.queueState.textContent = state.shuffle ? "随机播放" : state.repeat ? "单曲循环" : "顺序播放";
  els.sessionMood.textContent = `${track.mood} / ${track.tag} / ${track.album}`;
}

function render() {
  renderMoods();
  renderCloudTrackList();
  renderTrackList();
  renderQueue();
  renderNowPlaying();
}

function ensureAudio() {
  if (state.audio) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  state.audio = new AudioContext();
  state.gain = state.audio.createGain();
  state.filter = state.audio.createBiquadFilter();
  state.filter.type = "lowpass";
  state.filter.frequency.value = 900;
  state.gain.gain.value = state.volume * 0.08;
  state.filter.connect(state.gain);
  state.gain.connect(state.audio.destination);
}

function startTone() {
  ensureAudio();
  stopTone();
  const track = tracks[state.current];
  const oscillator = state.audio.createOscillator();
  const lfo = state.audio.createOscillator();
  const lfoGain = state.audio.createGain();

  oscillator.type = "triangle";
  oscillator.frequency.value = track.frequency;
  lfo.type = "sine";
  lfo.frequency.value = 0.18;
  lfoGain.gain.value = 8;
  lfo.connect(lfoGain);
  lfoGain.connect(oscillator.frequency);
  oscillator.connect(state.filter);
  oscillator.start();
  lfo.start();

  state.oscillator = oscillator;
  state.lfo = lfo;
}

function ensureMedia() {
  if (state.media) return;

  state.media = new Audio();
  state.media.volume = state.volume;

  state.media.addEventListener("loadedmetadata", () => {
    const track = tracks[state.current];
    if (!track?.src) return;
    track.duration = Number.isFinite(state.media.duration) ? Math.round(state.media.duration) : track.duration;
    render();
  });

  state.media.addEventListener("timeupdate", () => {
    const track = tracks[state.current];
    if (!track?.src) return;
    state.elapsed = state.media.currentTime;
    renderNowPlaying();
  });

  state.media.addEventListener("ended", () => {
    if (state.repeat) {
      state.elapsed = 0;
      state.media.currentTime = 0;
      state.media.play().catch(() => {
        state.playing = false;
        clearInterval(state.timer);
        renderNowPlaying();
      });
    } else {
      nextTrack();
    }
  });
}

function stopTone() {
  [state.oscillator, state.lfo].forEach((node) => {
    if (!node) return;
    try {
      node.stop();
      node.disconnect();
    } catch {
      node.disconnect();
    }
  });
  state.oscillator = null;
  state.lfo = null;
}

function startTimer() {
  clearInterval(state.timer);
  state.timer = setInterval(() => {
    const track = tracks[state.current];
    if (track.src) {
      state.elapsed = state.media?.currentTime || state.elapsed;
      renderNowPlaying();
      return;
    }

    state.elapsed += 1;

    if (state.elapsed >= track.duration) {
      if (state.repeat) {
        state.elapsed = 0;
        startTone();
      } else {
        nextTrack();
      }
    }

    renderNowPlaying();
  }, 1000);
}

function play() {
  if (!tracks.length) return;
  const track = tracks[state.current];
  state.playing = true;

  if (track.src) {
    ensureMedia();
    stopTone();
    if (state.media.src !== track.src) {
      state.media.src = track.src;
    }
    state.media.volume = state.volume;
    state.media.currentTime = Math.min(state.elapsed, track.duration || state.elapsed);
    state.media.play().catch(() => {
      state.playing = false;
      clearInterval(state.timer);
      renderNowPlaying();
    });
    startTimer();
    renderNowPlaying();
    return;
  }

  if (state.media) state.media.pause();
  ensureAudio();
  state.audio.resume();
  state.playing = true;
  startTone();
  startTimer();
  renderNowPlaying();
}

function pause() {
  state.playing = false;
  clearInterval(state.timer);
  stopTone();
  if (state.media) state.media.pause();
  renderNowPlaying();
}

function togglePlay() {
  state.playing ? pause() : play();
}

function selectTrack(index, autoplay = false) {
  if (!tracks.length) return;
  if (state.media) state.media.pause();
  state.current = index;
  state.elapsed = 0;
  if (state.playing || autoplay) {
    play();
  } else {
    render();
  }
}

function getNextIndex(direction = 1) {
  if (!tracks.length) return 0;
  if (state.shuffle && direction > 0) {
    let next = state.current;
    while (next === state.current && tracks.length > 1) {
      next = Math.floor(Math.random() * tracks.length);
    }
    return next;
  }
  return (state.current + direction + tracks.length) % tracks.length;
}

function nextTrack() {
  selectTrack(getNextIndex(1), state.playing);
}

function prevTrack() {
  if (state.elapsed > 4) {
    state.elapsed = 0;
    renderNowPlaying();
    return;
  }
  selectTrack(getNextIndex(-1), state.playing);
}

function addLocalTracks(files) {
  const audioFiles = Array.from(files).filter((file) => file.type.startsWith("audio/"));
  if (!audioFiles.length) return;

  const startIndex = tracks.length;
  audioFiles.forEach((file, offset) => {
    const meta = splitFileName(file.name);
    const track = {
      title: meta.title,
      artist: meta.artist,
      album: "本机临时试听",
      mood: "本机试听",
      tag: file.type.split("/")[1]?.toUpperCase() || "Audio",
      duration: 0,
      src: URL.createObjectURL(file),
      fileName: file.name,
      cover: makeUploadCover(startIndex + offset),
      source: "local"
    };

    tracks.push(track);

    const probe = new Audio(track.src);
    probe.addEventListener("loadedmetadata", () => {
      track.duration = Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0;
      render();
    }, { once: true });
  });

  state.mood = "本机试听";
  state.query = "";
  els.searchInput.value = "";
  els.uploadHint.textContent = `已临时导入 ${audioFiles.length} 首；刷新页面后会消失`;
  showToast(`已临时导入 ${audioFiles.length} 首，本机可试听。`, "success");
  render();
  selectTrack(startIndex, true);
}

function refreshPublishedTracks(autoplayLast = false) {
  const previousLength = tracks.length;
  return loadPublishedTracks().then(() => {
    if (tracks.length) {
      state.current = autoplayLast && tracks.length > previousLength ? tracks.length - 1 : Math.min(state.current, tracks.length - 1);
    }
    render();
  });
}

async function uploadCloudTrack() {
  const file = els.cloudMusicUpload.files?.[0];
  const password = els.adminPassword.value.trim();
  const parsed = file ? splitFileName(file.name) : { artist: "", title: "" };
  const artist = els.adminArtist.value.trim() || parsed.artist;
  const title = els.adminTitle.value.trim() || parsed.title;

  if (!file) {
    showToast("请先选择一首音频文件。", "error");
    return;
  }

  if (!password) {
    showToast("请输入管理员密码。", "error");
    return;
  }

  if (!file.type.startsWith("audio/")) {
    showToast("请选择 MP3、M4A、WAV 等音频文件。", "error");
    return;
  }

  els.cloudUploadButton.disabled = true;
  showToast("正在上传，请不要关闭页面...", "info");

  try {
    const checkResponse = await fetch(`${API_BASE_URL}/api/upload`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "admin.check", password })
    });
    const checkData = await checkResponse.json().catch(() => ({}));

    if (!checkResponse.ok) {
      throw new Error(checkData.error || "管理员密码校验失败。");
    }

    const extension = getFileExtension(file.name);
    const pathname = `songs/uploads/${Date.now()}-${makeSafePathPart(artist)} - ${makeSafePathPart(title)}.${extension}`;
    await upload(pathname, file, {
      access: "public",
      handleUploadUrl: "/api/upload",
      clientPayload: JSON.stringify({ password, artist, title })
    });

    showToast("上传成功，正在刷新公开歌曲库...", "success");
    els.cloudMusicUpload.value = "";
    els.cloudFileName.textContent = "选择要公开上传的歌曲";
    els.adminTitle.value = "";
    await refreshPublishedTracks(true);
    selectTrack(Math.max(0, tracks.length - 1), false);
    showToast("上传成功，已加入管理员上传歌曲列表。", "success");
  } catch (error) {
    const message = error?.message || "上传失败，请检查管理员密码和 Vercel Blob 配置。";
    showToast(message.includes("retrieve the client token")
      ? "上传失败：请确认管理员密码，并刷新页面后重试。"
      : message, "error");
  } finally {
    els.cloudUploadButton.disabled = false;
  }
}

async function requestTrackManagement(action, track, nextMeta = {}) {
  const password = els.adminPassword.value.trim();

  if (!password) {
    throw new Error("请先在管理员上传区域输入管理员密码。");
  }

  const response = await fetch(`${API_BASE_URL}/api/manage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action,
      password,
      fileName: track.fileName,
      ...nextMeta
    })
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "歌曲管理失败，请稍后再试。");
  }

  return data;
}

async function getServerCloudTracks() {
  const response = await fetch(`${API_BASE_URL}/api/tracks?ts=${Date.now()}`, { cache: "no-store" });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "无法确认服务器歌曲列表，请稍后再试。");
  }

  return Array.isArray(data.tracks) ? data.tracks : [];
}

async function manageCloudTrack(action, trackIndex) {
  const track = tracks[trackIndex];
  if (!track || track.source !== "cloud") return;

  try {
    if (action === "delete") {
      const confirmed = window.confirm(`确定删除《${track.title}》吗？删除后所有打开网站的人都听不到这首歌。`);
      if (!confirmed) return;

      showToast("正在删除歌曲...", "info");
      if (trackIndex === state.current) pause();
      await requestTrackManagement("delete", track);
      const serverTracks = await getServerCloudTracks();
      if (serverTracks.some((serverTrack) => serverTrack.fileName === track.fileName)) {
        throw new Error("删除失败：服务器上仍然存在这首歌，请刷新后再试。");
      }
      tracks.splice(trackIndex, 1);
      if (state.current > trackIndex) {
        state.current -= 1;
      } else if (state.current >= tracks.length) {
        state.current = Math.max(0, tracks.length - 1);
      }
      state.elapsed = 0;
      rebuildCloudIndexes();
      render();
      showToast("删除成功，管理员歌曲列表已更新。", "success");
      return;
    }

    if (action === "rename") {
      const nextArtist = window.prompt("请输入新的歌手名：", track.artist);
      if (nextArtist === null) return;
      const nextTitle = window.prompt("请输入新的歌曲名：", track.title);
      if (nextTitle === null) return;

      showToast("正在修改歌曲名称...", "info");
      const data = await requestTrackManagement("rename", track, {
        artist: nextArtist.trim(),
        title: nextTitle.trim()
      });
      if (!data.track?.fileName || !data.track?.src) {
        throw new Error("改名失败：服务器没有返回新的歌曲文件，请稍后再试。");
      }
      const updatedTrack = normalizeTrack({
        ...track,
        ...data.track,
        source: "cloud",
        cover: track.cover
      }, trackIndex);
      tracks[trackIndex] = updatedTrack;
      rebuildCloudIndexes();
      if (state.current === trackIndex && state.media) {
        const wasPlaying = state.playing;
        state.media.pause();
        state.media.src = updatedTrack.src;
        state.elapsed = 0;
        if (wasPlaying) play();
      }
      render();
      showToast("改名成功，管理员歌曲列表已更新。", "success");
    }
  } catch (error) {
    showToast(error?.message || "歌曲管理失败，请稍后再试。", "error");
  }
}

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderTrackList();
});
els.musicUpload.addEventListener("change", (event) => {
  addLocalTracks(event.target.files);
  event.target.value = "";
});
els.cloudMusicUpload.addEventListener("change", () => {
  const file = els.cloudMusicUpload.files?.[0];
  els.cloudFileName.textContent = file ? file.name : "选择要公开上传的歌曲";
  if (file) {
    const meta = splitFileName(file.name);
    if (!els.adminArtist.value) els.adminArtist.value = meta.artist === "本地文件" ? "" : meta.artist;
    if (!els.adminTitle.value) els.adminTitle.value = meta.title;
  }
});
els.cloudUploadButton.addEventListener("click", uploadCloudTrack);
els.refreshCloudButton.addEventListener("click", () => {
  showToast("正在刷新管理员上传歌曲...", "info");
  refreshPublishedTracks(false).then(() => {
    showToast("已刷新管理员上传歌曲列表。", "success");
  });
});

els.playButton.addEventListener("click", togglePlay);
els.nextButton.addEventListener("click", nextTrack);
els.prevButton.addEventListener("click", prevTrack);
els.repeatButton.addEventListener("click", () => {
  state.repeat = !state.repeat;
  renderNowPlaying();
});
els.shuffleButton.addEventListener("click", () => {
  state.shuffle = !state.shuffle;
  renderNowPlaying();
});
els.shuffleListButton.addEventListener("click", () => {
  state.shuffle = !state.shuffle;
  renderNowPlaying();
});
els.likeButton.addEventListener("click", () => {
  if (state.liked.has(state.current)) {
    state.liked.delete(state.current);
  } else {
    state.liked.add(state.current);
  }
  renderNowPlaying();
});
els.progress.addEventListener("input", (event) => {
  const track = tracks[state.current];
  if (!track.duration) return;
  state.elapsed = Math.round((Number(event.target.value) / 100) * track.duration);
  if (track.src && state.media) {
    state.media.currentTime = state.elapsed;
  }
  renderNowPlaying();
});
els.volume.addEventListener("input", (event) => {
  state.volume = Number(event.target.value) / 100;
  els.volumeValue.textContent = `${event.target.value}%`;
  if (state.gain) state.gain.gain.value = state.volume * 0.08;
  if (state.media) state.media.volume = state.volume;
});
els.queueButton.addEventListener("click", () => {
  els.queuePanel.classList.toggle("open");
  els.queueButton.classList.toggle("active", els.queuePanel.classList.contains("open"));
});
els.queueBackButton.addEventListener("click", () => {
  els.queuePanel.classList.remove("open");
  els.queueButton.classList.remove("active");
});
document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && document.activeElement.tagName !== "INPUT") {
    event.preventDefault();
    togglePlay();
  }
  if (event.key === "ArrowRight") nextTrack();
  if (event.key === "ArrowLeft") prevTrack();
  if (event.key === "Escape") {
    els.queuePanel.classList.remove("open");
    els.queueButton.classList.remove("active");
  }
});

refreshPublishedTracks();
