// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error:', err));
}

// Database Engine (IndexedDB for Persistent Offline Storage)
let db;
const dbRequest = indexedDB.open('NexSoundsDB', 1);
dbRequest.onupgradeneeded = (e) => {
  db = e.target.result;
  if (!db.objectStoreNames.contains('downloaded_tracks')) {
    db.createObjectStore('downloaded_tracks', { keyPath: 'id' });
  }
};
dbRequest.onsuccess = (e) => { db = e.target.result; };

// Audio State & Players
let currentTrack = null;
let isPlaying = false;
const nativeAudio = new Audio();
let ytPlayer = null;
let isYouTubeTrack = false;

// YouTube IFrame API Setup (Hidden for seamless background playback)
const tag = document.createElement('script');
tag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(tag);

window.onYouTubeIframeAPIReady = function() {
  const ytDiv = document.createElement('div');
  ytDiv.id = 'yt-hidden-player';
  ytDiv.style.cssText = 'position:fixed;bottom:-9999px;opacity:0;pointer-events:none;';
  document.body.appendChild(ytDiv);

  ytPlayer = new YT.Player('yt-hidden-player', {
    height: '0',
    width: '0',
    playerVars: { playsinline: 1, controls: 0, disablekb: 1 },
    events: {
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.PLAYING) {
          isPlaying = true;
          updatePlayButtonIcon();
        } else if (event.data === YT.PlayerState.PAUSED || event.data === YT.PlayerState.ENDED) {
          isPlaying = false;
          updatePlayButtonIcon();
        }
      }
    }
  });
};

// DOM Elements
const feedGrid = document.getElementById('musicGrid');
const searchInput = document.getElementById('searchInput');
const nowPlayingThumb = document.getElementById('nowPlayingThumb');
const nowPlayingTitle = document.getElementById('nowPlayingTitle');
const nowPlayingArtist = document.getElementById('nowPlayingArtist');
const playBtn = document.getElementById('playBtn');
const downloadBtn = document.getElementById('downloadBtn');

const settingsModal = document.getElementById('settingsModal');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const apiKeyInput = document.getElementById('apiKeyInput');

// Default Popular Feed
const DEFAULT_FEED = [
  {
    id: "yt_beerbiceps_1",
    title: "Ranveer Allahbadia ft. Mystery Guest",
    artist: "BeerBiceps Podcast",
    type: "youtube",
    youtubeId: "V-_O7nl0Ii0",
    cover: "https://i.ytimg.com/vi/V-_O7nl0Ii0/hqdefault.jpg"
  },
  {
    id: "yt_raj_1",
    title: "Building Startups & Wealth",
    artist: "Raj Shamani Figuring Out",
    type: "youtube",
    youtubeId: "kJQP7kiw5Fk",
    cover: "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg"
  },
  {
    id: "saavn_starboy",
    title: "Starboy",
    artist: "The Weeknd, Daft Punk",
    type: "audio",
    streamUrl: "https://actions.google.com/sounds/v1/science_fiction/ambient_hum.ogg",
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop"
  }
];

// Unified Card Renderer (Exact Posters Loaded)
function renderCards(tracks) {
  feedGrid.innerHTML = '';
  tracks.forEach(track => {
    const card = document.createElement('div');
    card.className = 'media-card';
    card.innerHTML = `
      <img src="${track.cover}" class="card-poster" alt="${track.title}" onerror="this.src='https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop'" loading="lazy">
      <div class="card-name">${track.title}</div>
      <div class="card-artist">${track.artist}</div>
    `;
    card.addEventListener('click', () => playTrack(track));
    feedGrid.appendChild(card);
  });
}

// Master Play Engine
async function playTrack(track) {
  currentTrack = track;
  nowPlayingTitle.textContent = track.title;
  nowPlayingArtist.textContent = track.artist;
  nowPlayingThumb.src = track.cover;

  if (track.type === 'youtube') {
    isYouTubeTrack = true;
    nativeAudio.pause();
    downloadBtn.style.opacity = '0.3'; // YouTube stream terms
    downloadBtn.style.pointerEvents = 'none';

    if (ytPlayer && ytPlayer.loadVideoById) {
      ytPlayer.loadVideoById(track.youtubeId);
      ytPlayer.playVideo();
      isPlaying = true;
      updatePlayButtonIcon();
    }
  } else {
    isYouTubeTrack = false;
    downloadBtn.style.opacity = '1';
    downloadBtn.style.pointerEvents = 'auto';

    if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();

    // Check offline cache first
    const cachedBlob = await getOfflineBlob(track.id);
    if (cachedBlob) {
      nativeAudio.src = URL.createObjectURL(cachedBlob);
      downloadBtn.classList.add('downloaded');
    } else {
      nativeAudio.src = track.streamUrl;
      downloadBtn.classList.remove('downloaded');
    }

    nativeAudio.play();
    isPlaying = true;
    updatePlayButtonIcon();
  }
}

// Play / Pause Toggle
playBtn.addEventListener('click', () => {
  if (!currentTrack) {
    if (DEFAULT_FEED.length > 0) playTrack(DEFAULT_FEED[0]);
    return;
  }

  if (isYouTubeTrack) {
    if (isPlaying) {
      ytPlayer.pauseVideo();
      isPlaying = false;
    } else {
      ytPlayer.playVideo();
      isPlaying = true;
    }
  } else {
    if (isPlaying) {
      nativeAudio.pause();
      isPlaying = false;
    } else {
      nativeAudio.play();
      isPlaying = true;
    }
  }
  updatePlayButtonIcon();
});

function updatePlayButtonIcon() {
  playBtn.innerHTML = isPlaying 
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
}

// Native Audio State Sync
nativeAudio.onplay = () => { isPlaying = true; updatePlayButtonIcon(); };
nativeAudio.onpause = () => { isPlaying = false; updatePlayButtonIcon(); };

// Search Orchestrator (Debounced Universal Query)
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  if (!query) {
    renderCards(DEFAULT_FEED);
    return;
  }

  searchTimeout = setTimeout(() => {
    executeUniversalSearch(query);
  }, 500);
});

async function executeUniversalSearch(query) {
  let combinedResults = [];
  const ytKey = localStorage.getItem('nexsounds_api_key');

  // 1. Fetch from JioSaavn Open API (Direct Audio + Posters, No Key Required)
  try {
    const saavnRes = await fetch(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=10`);
    if (saavnRes.ok) {
      const saavnData = await saavnRes.json();
      if (saavnData.data && saavnData.data.results) {
        const parsedSaavn = saavnData.data.results.map(item => {
          // Best resolution poster selection
          const imageObj = item.image ? (item.image[2] || item.image[1] || item.image[0]) : null;
          // 320kbps or best audio url
          const streamObj = item.downloadUrl ? (item.downloadUrl[4] || item.downloadUrl[3] || item.downloadUrl[0]) : null;

          return {
            id: `saavn_${item.id}`,
            title: item.name,
            artist: item.primaryArtists || 'Unknown Artist',
            type: 'audio',
            cover: imageObj ? imageObj.url : 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop',
            streamUrl: streamObj ? streamObj.url : ''
          };
        }).filter(song => song.streamUrl !== '');
        combinedResults.push(...parsedSaavn);
      }
    }
  } catch (err) {
    console.log("Saavn search skipped/error:", err);
  }

  // 2. Fetch from YouTube Data API v3 (If Key is Saved in Settings)
  if (ytKey) {
    try {
      const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=8&q=${encodeURIComponent(query)}&type=video&key=${ytKey}`);
      if (ytRes.ok) {
        const ytData = await ytRes.json();
        if (ytData.items) {
          const parsedYT = ytData.items.map(item => ({
            id: `yt_${item.id.videoId}`,
            title: item.snippet.title,
            artist: item.snippet.channelTitle,
            type: 'youtube',
            youtubeId: item.id.videoId,
            cover: item.snippet.thumbnails.high ? item.snippet.thumbnails.high.url : item.snippet.thumbnails.default.url
          }));
          combinedResults.push(...parsedYT);
        }
      }
    } catch (err) {
      console.log("YouTube API search error:", err);
    }
  }

  if (combinedResults.length > 0) {
    renderCards(combinedResults);
  } else {
    // Local filter fallback
    const localFiltered = DEFAULT_FEED.filter(i => 
      i.title.toLowerCase().includes(query.toLowerCase()) || 
      i.artist.toLowerCase().includes(query.toLowerCase())
    );
    renderCards(localFiltered);
  }
}

// Offline Download Handler (IndexedDB)
downloadBtn.addEventListener('click', async () => {
  if (!currentTrack || currentTrack.type === 'youtube') return;
  try {
    const res = await fetch(currentTrack.streamUrl);
    const blob = await res.blob();
    const tx = db.transaction('downloaded_tracks', 'readwrite');
    const store = tx.objectStore('downloaded_tracks');
    store.put({ id: currentTrack.id, data: blob, meta: currentTrack });
    downloadBtn.classList.add('downloaded');
    alert(`"${currentTrack.title}" offline save ho gaya!`);
  } catch (err) {
    console.error('Offline storage error:', err);
  }
});

function getOfflineBlob(id) {
  return new Promise((resolve) => {
    if (!db) return resolve(null);
    const tx = db.transaction('downloaded_tracks', 'readonly');
    const store = tx.objectStore('downloaded_tracks');
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result ? req.result.data : null);
    req.onerror = () => resolve(null);
  });
}

// In-App Settings & Key Storage
openSettingsBtn.addEventListener('click', () => {
  apiKeyInput.value = localStorage.getItem('nexsounds_api_key') || '';
  settingsModal.style.display = 'flex';
});

closeSettingsBtn.addEventListener('click', () => {
  settingsModal.style.display = 'none';
});

saveSettingsBtn.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  localStorage.setItem('nexsounds_api_key', key);
  settingsModal.style.display = 'none';
  alert('YouTube API Key saved! Ab podcasts aur YouTube tracks bhi search honge.');
});

// Boot Initial Feed
renderCards(DEFAULT_FEED);
