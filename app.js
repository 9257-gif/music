const tracks = [
  {
    title: "Midnight Signal",
    artist: "Noir District",
    album: "After Hours",
    mood: "夜间律动",
    tag: "Synth",
    duration: 214,
    frequency: 164.81,
    cover: "linear-gradient(135deg, #10100f 0%, #3b3027 38%, #efc45a 100%)"
  },
  {
    title: "Soft Static",
    artist: "Mira Vale",
    album: "Warm Lines",
    mood: "放松",
    tag: "Chill",
    duration: 188,
    frequency: 220,
    cover: "linear-gradient(135deg, #24312d 0%, #4fc3a6 46%, #f2d47a 100%)"
  },
  {
    title: "Glass Arcade",
    artist: "Pixel Harbor",
    album: "Neon Walk",
    mood: "通勤",
    tag: "Electronic",
    duration: 236,
    frequency: 246.94,
    cover: "linear-gradient(135deg, #1d2027 0%, #3d6d8a 45%, #e66f58 100%)"
  },
  {
    title: "Amber Rain",
    artist: "Luna Field",
    album: "Window Seat",
    mood: "专注",
    tag: "Lo-fi",
    duration: 201,
    frequency: 196,
    cover: "linear-gradient(135deg, #141412 0%, #735a3a 45%, #eab95a 100%)"
  },
  {
    title: "City Bloom",
    artist: "The Low Suns",
    album: "Rooftop Season",
    mood: "晴朗",
    tag: "Indie",
    duration: 225,
    frequency: 293.66,
    cover: "linear-gradient(135deg, #10201b 0%, #4fc3a6 42%, #f7f4ea 100%)"
  },
  {
    title: "Velvet Engine",
    artist: "Cassette Atlas",
    album: "Drive Home",
    mood: "能量",
    tag: "Retro",
    duration: 242,
    frequency: 329.63,
    cover: "linear-gradient(135deg, #201616 0%, #874033 44%, #efc45a 100%)"
  }
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
  queuePanel: document.querySelector("#queuePanel"),
  queueState: document.querySelector("#queueState"),
  sessionMood: document.querySelector("#sessionMood"),
  eq: document.querySelector(".mini-eq")
};

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function splitFileName(name) {
  const cleanName = name.replace(/\.[^/.]+$/, "").trim() || "本地音乐";
  const parts = cleanName.split(/\s+-\s+/);
  if (parts.length >= 2) {
    return { artist: parts[0].trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { artist: "本地文件", title: cleanName };
}

function makeUploadCover(index) {
  const covers = [
    "linear-gradient(135deg, #211f1a 0%, #4fc3a6 44%, #efc45a 100%)",
    "linear-gradient(135deg, #1d2027 0%, #7b6bd6 45%, #e66f58 100%)",
    "linear-gradient(135deg, #1e1714 0%, #b66a48 45%, #f2d47a 100%)",
    "linear-gradient(135deg, #111d1b 0%, #2c8f79 45%, #f7f4ea 100%)"
  ];
  return covers[index % covers.length];
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
    els.trackList.innerHTML = `<div class="empty-list">没有找到匹配的歌曲</div>`;
    return;
  }

  els.trackList.innerHTML = visibleTracks.map((track) => `
    <button class="track-row ${track.index === state.current ? "active" : ""}" data-index="${track.index}">
      <span class="cover" style="--cover:${track.cover}"></span>
      <span class="track-copy">
        <strong>${track.title}</strong>
        <span>${track.artist} · ${track.album}</span>
      </span>
      <span class="track-duration">${track.duration ? formatTime(track.duration) : "读取中"}</span>
    </button>
  `).join("");

  els.trackList.querySelectorAll(".track-row").forEach((button) => {
    button.addEventListener("click", () => selectTrack(Number(button.dataset.index), true));
  });
}

function renderQueue() {
  els.queueList.innerHTML = tracks.map((track, index) => `
    <button class="queue-row ${index === state.current ? "active" : ""}" data-index="${index}">
      <span class="queue-cover" style="--cover:${track.cover}"></span>
      <span class="queue-copy">
        <strong>${track.title}</strong>
        <span>${track.mood} · ${track.duration ? formatTime(track.duration) : "读取中"}</span>
      </span>
    </button>
  `).join("");

  els.queueList.querySelectorAll(".queue-row").forEach((button) => {
    button.addEventListener("click", () => {
      selectTrack(Number(button.dataset.index), true);
      els.queuePanel.classList.remove("open");
    });
  });
}

function renderNowPlaying() {
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
      album: "本地音乐",
      mood: "本地音乐",
      tag: file.type.split("/")[1]?.toUpperCase() || "Audio",
      duration: 0,
      src: URL.createObjectURL(file),
      fileName: file.name,
      cover: makeUploadCover(startIndex + offset)
    };

    tracks.push(track);

    const probe = new Audio(track.src);
    probe.addEventListener("loadedmetadata", () => {
      track.duration = Number.isFinite(probe.duration) ? Math.round(probe.duration) : 0;
      render();
    }, { once: true });
  });

  state.mood = "本地音乐";
  state.query = "";
  els.searchInput.value = "";
  els.uploadHint.textContent = `已导入 ${audioFiles.length} 首本地音乐`;
  render();
  selectTrack(startIndex, true);
}

els.searchInput.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderTrackList();
});
els.musicUpload.addEventListener("change", (event) => {
  addLocalTracks(event.target.files);
  event.target.value = "";
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
});
document.addEventListener("keydown", (event) => {
  if (event.code === "Space" && document.activeElement.tagName !== "INPUT") {
    event.preventDefault();
    togglePlay();
  }
  if (event.key === "ArrowRight") nextTrack();
  if (event.key === "ArrowLeft") prevTrack();
  if (event.key === "Escape") els.queuePanel.classList.remove("open");
});

render();
