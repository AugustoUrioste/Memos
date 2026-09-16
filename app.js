// Memos — record a voice idea, get a markdown (+ audio) file committed to GitHub.

const micBtn = document.getElementById('micBtn');
const micWrap = document.getElementById('micWrap');
const statusEl = document.getElementById('status');
const transcriptEl = document.getElementById('transcript');
const recordView = document.getElementById('recordView');
const reviewView = document.getElementById('reviewView');
const playback = document.getElementById('playback');
const editText = document.getElementById('editText');
const saveBtn = document.getElementById('saveBtn');
const discardBtn = document.getElementById('discardBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsDialog = document.getElementById('settingsDialog');
const settingsSave = document.getElementById('settingsSave');
const settingsCancel = document.getElementById('settingsCancel');
const tokenInput = document.getElementById('tokenInput');
const repoInput = document.getElementById('repoInput');
const branchInput = document.getElementById('branchInput');
const repoLabel = document.getElementById('repoLabel');
const pendingBanner = document.getElementById('pendingBanner');
const pendingText = document.getElementById('pendingText');
const syncBtn = document.getElementById('syncBtn');

const DEFAULT_REPO = 'AugustoUrioste/Memos';
const PENDING_KEY = 'memos_pending';

let mediaRecorder = null;
let chunks = [];
let stream = null;
let isRecording = false;
let mimeType = '';
let currentAudioBlob = null;
let finalTranscript = '';

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SR) {
  recognition = new SR();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = navigator.language || 'en-US';
  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) finalTranscript += t + ' ';
      else interim += t;
    }
    transcriptEl.textContent = (finalTranscript + interim).trim();
  };
  recognition.onerror = (e) => console.warn('speech recognition:', e.error);
  recognition.onend = () => {
    if (isRecording) {
      try { recognition.start(); } catch (e) { /* already running */ }
    }
  };
}

function setStatus(msg) {
  statusEl.textContent = msg;
}

function pickMime() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return '';
}

function extFor(type) {
  if (!type) return 'webm';
  if (type.includes('mp4')) return 'm4a';
  if (type.includes('ogg')) return 'ogg';
  return 'webm';
}

async function startRecording() {
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    setStatus('This browser cannot record audio.');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    setStatus('Microphone permission denied.');
    return;
  }
  chunks = [];
  finalTranscript = '';
  transcriptEl.textContent = '';
  mimeType = pickMime();
  mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  mediaRecorder.onstop = onRecordingStop;
  mediaRecorder.start();
  isRecording = true;
  if (recognition) {
    try { recognition.start(); } catch (e) { /* ignore */ }
  }
  micWrap.classList.add('recording');
  setStatus('Listening… tap to stop');
}

function stopRecording() {
  isRecording = false;
  if (mediaRecorder && mediaRecorder.state !== 'inactive') mediaRecorder.stop();
  if (recognition) {
    try { recognition.stop(); } catch (e) { /* ignore */ }
  }
  if (stream) stream.getTracks().forEach((t) => t.stop());
  micWrap.classList.remove('recording');
  setStatus('Processing…');
}

function onRecordingStop() {
  currentAudioBlob = new Blob(chunks, { type: mimeType || 'audio/webm' });
  if (playback.src) URL.revokeObjectURL(playback.src);
  playback.src = URL.createObjectURL(currentAudioBlob);
  editText.value = finalTranscript.trim();
  recordView.classList.add('hidden');
  reviewView.classList.remove('hidden');
  setStatus('Tap to start');
}

micBtn.addEventListener('click', () => {
  if (isRecording) stopRecording();
  else startRecording();
});

function resetToRecordView() {
  reviewView.classList.add('hidden');
  recordView.classList.remove('hidden');
  transcriptEl.textContent = '';
  editText.value = '';
  if (playback.src) {
    URL.revokeObjectURL(playback.src);
    playback.removeAttribute('src');
  }
  currentAudioBlob = null;
  chunks = [];
}

discardBtn.addEventListener('click', resetToRecordView);

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

async function buildMemoItem(text, audioBlob, blobMimeType) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const rand = Math.random().toString(36).slice(2, 6);
  const stamp = `${yyyy}-${mm}-${dd}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${rand}`;
  const mdPath = `memos/${yyyy}/${mm}/${stamp}.md`;

  let audioPath = null;
  let audioBase64 = null;
  let ext = null;
  if (audioBlob && audioBlob.size > 0) {
    ext = extFor(blobMimeType);
    audioPath = `audio/${yyyy}/${mm}/${stamp}.${ext}`;
    audioBase64 = await blobToBase64(audioBlob);
  }

  let mdContent = `# Memo — ${now.toLocaleString()}\n\n${text || '_(no transcript captured — see audio)_'}\n`;
  if (audioPath) {
    mdContent += `\n---\nAudio: [${stamp}.${ext}](../../../${audioPath})\n`;
  }

  return { stamp, mdPath, mdContent, audioPath, audioBase64 };
}

async function putFile(repo, path, contentBase64, message, branch, token) {
  const res = await fetch(`https://api.github.com/repos/${repo}/contents/${encodeURI(path)}`, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ message, content: contentBase64, branch }),
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j.message) msg = j.message;
    } catch (e) { /* ignore */ }
    const err = new Error(msg);
    err.http = true;
    throw err;
  }
  return res.json();
}

// Returns 'saved', 'queued' (network failure — retry later), or an error message string.
async function trySaveItem(item, token, repo, branch) {
  try {
    if (item.audioBase64) {
      await putFile(repo, item.audioPath, item.audioBase64, `Add memo audio ${item.stamp}`, branch, token);
    }
    await putFile(repo, item.mdPath, utf8ToBase64(item.mdContent), `Add memo ${item.stamp}`, branch, token);
    return 'saved';
  } catch (err) {
    if (err.http) return err.message;
    return 'queued';
  }
}

function getPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); }
  catch (e) { return []; }
}

function setPending(arr) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(arr));
  updatePendingBanner();
}

function addPending(item) {
  const arr = getPending();
  arr.push(item);
  setPending(arr);
}

function updatePendingBanner() {
  const arr = getPending();
  if (arr.length === 0) {
    pendingBanner.classList.add('hidden');
    return;
  }
  pendingBanner.classList.remove('hidden');
  pendingText.textContent = `${arr.length} memo${arr.length > 1 ? 's' : ''} waiting to sync`;
}

async function flushPending() {
  const token = localStorage.getItem('memos_gh_token');
  const repo = localStorage.getItem('memos_gh_repo') || DEFAULT_REPO;
  const branch = localStorage.getItem('memos_gh_branch') || 'main';
  if (!token) return;
  const arr = getPending();
  const remaining = [];
  for (const item of arr) {
    const result = await trySaveItem(item, token, repo, branch);
    if (result !== 'saved') remaining.push(item);
  }
  setPending(remaining);
}

syncBtn.addEventListener('click', flushPending);
window.addEventListener('online', flushPending);

saveBtn.addEventListener('click', async () => {
  const token = localStorage.getItem('memos_gh_token');
  const repo = localStorage.getItem('memos_gh_repo') || DEFAULT_REPO;
  const branch = localStorage.getItem('memos_gh_branch') || 'main';
  if (!token) {
    openSettings();
    return;
  }
  saveBtn.disabled = true;
  discardBtn.disabled = true;
  saveBtn.textContent = 'Saving…';

  const text = editText.value.trim();
  const item = await buildMemoItem(text, currentAudioBlob, mimeType);
  const result = await trySaveItem(item, token, repo, branch);

  if (result === 'saved') {
    resetToRecordView();
    setStatus('Saved ✓');
  } else if (result === 'queued') {
    addPending(item);
    resetToRecordView();
    setStatus('Offline — saved locally, will sync');
  } else {
    alert(`Could not save to GitHub:\n${result}`);
  }

  saveBtn.disabled = false;
  discardBtn.disabled = false;
  saveBtn.textContent = 'Save to GitHub';
});

function openSettings() {
  tokenInput.value = localStorage.getItem('memos_gh_token') || '';
  repoInput.value = localStorage.getItem('memos_gh_repo') || DEFAULT_REPO;
  branchInput.value = localStorage.getItem('memos_gh_branch') || 'main';
  settingsDialog.showModal();
}

settingsBtn.addEventListener('click', openSettings);
settingsCancel.addEventListener('click', () => settingsDialog.close());
settingsSave.addEventListener('click', (e) => {
  e.preventDefault();
  const token = tokenInput.value.trim();
  const repo = repoInput.value.trim() || DEFAULT_REPO;
  const branch = branchInput.value.trim() || 'main';
  if (token) localStorage.setItem('memos_gh_token', token);
  localStorage.setItem('memos_gh_repo', repo);
  localStorage.setItem('memos_gh_branch', branch);
  updateRepoLabel();
  settingsDialog.close();
  flushPending();
});

function updateRepoLabel() {
  const repo = localStorage.getItem('memos_gh_repo') || DEFAULT_REPO;
  const branch = localStorage.getItem('memos_gh_branch') || 'main';
  repoLabel.textContent = `${repo} →`;
  repoLabel.style.cursor = 'pointer';
  repoLabel.onclick = () => window.open(`https://github.com/${repo}/tree/${branch}/memos`, '_blank');
}

// Init
updateRepoLabel();
updatePendingBanner();
if (!localStorage.getItem('memos_gh_token')) {
  openSettings();
} else if (navigator.onLine) {
  flushPending();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  });
}
