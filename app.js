// ==========================================
// 1. FIREBASE INITIALIZATION & AUTH ENGINE
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyD3bYmSa-CPLFus9Z4ifycZur4tY6wSRTg",
  authDomain: "nexsound.firebaseapp.com",
  projectId: "nexsound",
  storageBucket: "nexsound.firebasestorage.app",
  messagingSenderId: "337026441135",
  appId: "1:337026441135:web:98a58c58fb1a72da29995a",
  measurementId: "G-MWE1C9V1CC"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = (typeof firebase !== 'undefined') ? firebase.auth() : null;

// ==========================================
// 2. PWA SERVICE WORKER REGISTRATION
// ==========================================
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW error:', err));
}

// ==========================================
// 3. INDEXEDDB OFFLINE STORAGE ENGINE
// ==========================================
let db;
const dbRequest = indexedDB.open('NexSoundsDB', 1);

dbRequest.onupgradeneeded = (e) => {
  db = e.target.result;
  if (!db.objectStoreNames.contains('downloaded_tracks')) {
    db.createObjectStore('downloaded_tracks', { keyPath: 'id' });
  }
};

dbRequest.onsuccess = (e) => { 
  db = e.target.result; 
};

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

// ==========================================
// 4. AUDIO STATE & PLAYERS (NATIVE + YOUTUBE)
// ==========================================
let currentTrack = null;
let isPlaying = false;
const nativeAudio = new Audio();
let ytPlayer = null;
let isYouTubeTrack = false;

// YouTube IFrame API Loader (Hidden background player)
const ytTag = document.createElement('script');
ytTag.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(ytTag);

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

// ==========================================
// 5. DEFAULT FEED
// ==========================================
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

// ==========================================
// 6. UI LOGIC & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  const feedGrid = document.getElementById('musicGrid');
  const searchInput = document.getElementById('searchInput');
  const nowPlayingThumb = document.getElementById('nowPlayingThumb');
  const nowPlayingTitle = document.getElementById('nowPlayingTitle');
  const nowPlayingArtist = document.getElementById('nowPlayingArtist');
  const playBtn = document.getElementById('playBtn');
  const downloadBtn = document.getElementById('downloadBtn');
  const authBtn = document.getElementById('authBtn');

  const settingsModal = document.getElementById('settingsModal');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const closeSettingsBtn = document.getElementById('closeSettingsBtn');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const apiKeyInput = document.getElementById('apiKeyInput');

  // Firebase Auth State Handling
  if (auth && authBtn) {
    auth.onAuthStateChanged((user) => {
      if (user) {
        authBtn.textContent = user.displayName ? user.displayName.split(' ')[0] : 'Profile';
        authBtn.title = "Click to Logout";
        authBtn.style.background = "#27272a";
        authBtn.style.color = "#ffffff";
      } else {
        authBtn.textContent = 'Login';
        authBtn.style.background = "var(--primary-emerald)";
        authBtn.style.color = "var(--bg-black)";
      }
    });

    authBtn.addEventListener('click', () => {
      if (auth.currentUser) {
        if (confirm("Log out karna chahte ho?")) {
          auth.signOut();
        }
      } else {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch((error) => {
          console.error("Login Error:", error);
          alert("Login error: " + error.message);
        });
      }
    });
  }

  // Render Music Cards
  function renderCards(tracks) {
    if (!feedGrid) return;
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

  // Play Logic
  async function playTrack(track) {
    currentTrack = track;
    if (nowPlayingTitle) nowPlayingTitle.textContent = track.title;
    if (nowPlayingArtist) nowPlayingArtist.textContent = track.artist;
    if (nowPlayingThumb) nowPlayingThumb.src = track.cover;

    if (track.type === 'youtube') {
      isYouTubeTrack = true;
      nativeAudio.pause();
      if (downloadBtn) {
        downloadBtn.style.opacity = '0.3';
        downloadBtn.style.pointerEvents = 'none';
      }

      if (ytPlayer && ytPlayer.loadVideoById) {
        ytPlayer.loadVideoById(track.youtubeId);
        ytPlayer.playVideo();
        isPlaying = true;
        updatePlayButtonIcon();
      }
    } else {
      isYouTubeTrack = false;
      if (downloadBtn) {
        downloadBtn.style.opacity = '1';
        downloadBtn.style.pointerEvents = 'auto';
      }

      if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();

      const cachedBlob = await getOfflineBlob(track.id);
      if (cachedBlob) {
        nativeAudio.src = URL.createObjectURL(cachedBlob);
        if (downloadBtn) downloadBtn.classList.add('downloaded');
      } else {
        nativeAudio.src = track.streamUrl;
        if (downloadBtn) downloadBtn.classList.remove('downloaded');
      }

      nativeAudio.play().catch(e => console.log('Playback error:', e));
      isPlaying = true;
      updatePlayButtonIcon();
    }
  }

  // Play/Pause Action
  if (playBtn) {
    playBtn.addEventListener('click', () => {
      if (!currentTrack) {
        if (DEFAULT_FEED.length > 0) playTrack(DEFAULT_FEED[0]);
        return;
      }

      if (isYouTubeTrack) {
        if (isPlaying) {
          if (ytPlayer && ytPlayer.pauseVideo) ytPlayer.pauseVideo();
          isPlaying = false;
        } else {
          if (ytPlayer && ytPlayer.playVideo) ytPlayer.playVideo();
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
  }

  function updatePlayButtonIcon() {
    if (!playBtn) return;
    playBtn.innerHTML = isPlaying 
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
  }

  nativeAudio.onplay = () => { isPlaying = true; updatePlayButtonIcon(); };
  nativeAudio.onpause = () => { isPlaying = false; updatePlayButtonIcon(); };

  // Search Engine (JioSaavn + YouTube)
  let searchTimeout;
  if (searchInput) {
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
  }

  async function executeUniversalSearch(query) {
    let combinedResults = [];
    const ytKey = localStorage.getItem('nexsounds_api_key');

    // 1. JioSaavn Direct API (Free MP3 + Covers)
    try {
      const saavnRes = await fetch(`https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=10`);
      if (saavnRes.ok) {
        const saavnData = await saavnRes.json();
        if (saavnData.data && saavnData.data.results) {
          const parsedSaavn = saavnData.data.results.map(item => {
            const imageObj = item.image ? (item.image[2] || item.image[1] || item.image[0]) : null;
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

    // 2. YouTube Search (If key is present)
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
        console.log("YouTube search error:", err);
      }
    }

    if (combinedResults.length > 0) {
      renderCards(combinedResults);
    } else {
      const localFiltered = DEFAULT_FEED.filter(i => 
        i.title.toLowerCase().includes(query.toLowerCase()) || 
        i.artist.toLowerCase().includes(query.toLowerCase())
      );
      renderCards(localFiltered);
    }
  }

  // Offline Download Handler (IndexedDB)
  if (downloadBtn) {
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
  }

  // Settings Modal Controls
  if (openSettingsBtn && settingsModal) {
    openSettingsBtn.addEventListener('click', () => {
      if (apiKeyInput) apiKeyInput.value = localStorage.getItem('nexsounds_api_key') || '';
      settingsModal.style.display = 'flex';
    });
  }

  if (closeSettingsBtn && settingsModal) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });
  }

  if (saveSettingsBtn && settingsModal) {
    saveSettingsBtn.addEventListener('click', () => {
      const key = apiKeyInput ? apiKeyInput.value.trim() : '';
      localStorage.setItem('nexsounds_api_key', key);
      settingsModal.style.display = 'none';
      alert('YouTube API Key saved! Ab podcasts search active ho gaya.');
    });
  }

  // Initial Boot
  renderCards(DEFAULT_FEED);
});
