// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration error:', err));
}

// Database Engine (IndexedDB for Persistent Offline Song Storage)
let db;
const request = indexedDB.open('NexSoundsDB', 1);
request.onupgradeneeded = (e) => {
  db = e.target.result;
  if (!db.objectStoreNames.contains('downloaded_tracks')) {
    db.createObjectStore('downloaded_tracks', { keyPath: 'id' });
  }
};
request.onsuccess = (e) => { db = e.target.result; };

// Curated Clean Catalog (Hits only - Zero clutter)
const CATALOG = [
  {
    id: "track-1",
    title: "Starboy",
    artist: "The Weeknd, Daft Punk",
    cover: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=400&h=400&fit=crop",
    streamUrl: "https://actions.google.com/sounds/v1/science_fiction/ambient_hum.ogg"
  },
  {
    id: "track-2",
    title: "Midnight City",
    artist: "M83",
    cover: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&h=400&fit=crop",
    streamUrl: "https://actions.google.com/sounds/v1/ambiences/subway_station_ambience.ogg"
  },
  {
    id: "track-3",
    title: "Blinding Lights",
    artist: "The Weeknd",
    cover: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&h=400&fit=crop",
    streamUrl: "https://actions.google.com/sounds/v1/science_fiction/space_warp.ogg"
  },
  {
    id: "track-4",
    title: "After Dark",
    artist: "Mr.Kitty",
    cover: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop",
    streamUrl: "https://actions.google.com/sounds/v1/transportation/subway_door_open_close.ogg"
  }
];

// Audio State
let currentTrack = null;
let isPlaying = false;
const audioPlayer = new Audio();

// DOM References
const feedGrid = document.getElementById('musicGrid');
const searchInput = document.getElementById('searchInput');
const nowPlayingThumb = document.getElementById('nowPlayingThumb');
const nowPlayingTitle = document.getElementById('nowPlayingTitle');
const nowPlayingArtist = document.getElementById('nowPlayingArtist');
const playBtn = document.getElementById('playBtn');
const downloadBtn = document.getElementById('downloadBtn');

// Modal Elements
const settingsModal = document.getElementById('settingsModal');
const openSettingsBtn = document.getElementById('openSettingsBtn');
const closeSettingsBtn = document.getElementById('closeSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const apiKeyInput = document.getElementById('apiKeyInput');

// Render Cards
function renderCards(tracks) {
  feedGrid.innerHTML = '';
  tracks.forEach(track => {
    const card = document.createElement('div');
    card.className = 'media-card';
    card.innerHTML = `
      <img src="${track.cover}" class="card-poster" alt="${track.title}" loading="lazy">
      <div class="card-name">${track.title}</div>
      <div class="card-artist">${track.artist}</div>
    `;
    card.addEventListener('click', () => playTrack(track));
    feedGrid.appendChild(card);
  });
}

// Play Logic
async function playTrack(track) {
  currentTrack = track;
  nowPlayingTitle.textContent = track.title;
  nowPlayingArtist.textContent = track.artist;
  nowPlayingThumb.src = track.cover;

  // Check if track is cached offline in IndexedDB
  const cachedBlob = await getOfflineBlob(track.id);
  if (cachedBlob) {
    audioPlayer.src = URL.createObjectURL(cachedBlob);
    downloadBtn.classList.add('downloaded');
  } else {
    audioPlayer.src = track.streamUrl;
    downloadBtn.classList.remove('downloaded');
  }

  audioPlayer.play();
  isPlaying = true;
  updatePlayButtonIcon();
}

// Play/Pause Action
playBtn.addEventListener('click', () => {
  if (!currentTrack) {
    if (CATALOG.length > 0) playTrack(CATALOG[0]);
    return;
  }
  if (isPlaying) {
    audioPlayer.pause();
    isPlaying = false;
  } else {
    audioPlayer.play();
    isPlaying = true;
  }
  updatePlayButtonIcon();
});

function updatePlayButtonIcon() {
  playBtn.innerHTML = isPlaying 
    ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
    : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
}

// Download/Cache Track (Offline Playback)
downloadBtn.addEventListener('click', async () => {
  if (!currentTrack) return;
  try {
    const res = await fetch(currentTrack.streamUrl);
    const blob = await res.blob();
    const tx = db.transaction('downloaded_tracks', 'readwrite');
    const store = tx.objectStore('downloaded_tracks');
    store.put({ id: currentTrack.id, data: blob, meta: currentTrack });
    downloadBtn.classList.add('downloaded');
    alert(`"${currentTrack.title}" saved offline!`);
  } catch (err) {
    console.error('Cache save error:', err);
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

// Dynamic Search (Fuzzy Name/Artist Match)
searchInput.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase().trim();
  const filtered = CATALOG.filter(item => 
    item.title.toLowerCase().includes(query) || 
    item.artist.toLowerCase().includes(query)
  );
  renderCards(filtered);
});

// Settings & API Key Storage
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
  alert('API Key configured safely in browser LocalStorage!');
});

// Initial Render
renderCards(CATALOG);
