import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDTZb-IQNGMVajNYlWml_P8-O674TVLmI8",
  authDomain: "ourspace-4b1ff.firebaseapp.com",
  projectId: "ourspace-4b1ff",
  storageBucket: "ourspace-4b1ff.firebasestorage.app",
  messagingSenderId: "578961374103",
  appId: "1:578961374103:web:2f16f05eb9b17b1246e2d2"
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

const session = { userName: "", pairCode: "", myId: "" };
let liveSyncUnsubscribe = null;
let lastPulseTimestamp = 0;
let myLocation = null;

// ── HELPERS ──────────────────────────────────────────────────────────────

function otherId() {
  return session.myId === "user1" ? "user2" : "user1";
}

function show(screenId) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  document.getElementById(screenId).classList.add("active");
  window.scrollTo(0, 0);
}

function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 3000);
}

function saveSessionToDevice() {
  localStorage.setItem("tf_pairCode", session.pairCode);
  localStorage.setItem("tf_myId", session.myId);
  localStorage.setItem("tf_userName", session.userName);
}

function loadSessionFromDevice() {
  session.pairCode = localStorage.getItem("tf_pairCode") || "";
  session.myId     = localStorage.getItem("tf_myId") || "";
  session.userName = localStorage.getItem("tf_userName") || "";
}

function floatingHearts() {
  for (let i = 0; i < 6; i++) {
    setTimeout(() => {
      const h = document.createElement("div");
      h.className = "floating-heart";
      h.textContent = ["💕","💗","💓","❤️","💖"][Math.floor(Math.random() * 5)];
      h.style.left = Math.random() * 90 + "vw";
      h.style.animationDuration = (2 + Math.random() * 2) + "s";
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 4000);
    }, i * 200);
  }
}

function updateDaysCounter(anniversaryDate) {
  if (!anniversaryDate) return;
  const start = new Date(anniversaryDate);
  if (isNaN(start)) return;
  const days = Math.floor((Date.now() - start.getTime()) / (1000 * 60 * 60 * 24));
  document.getElementById("days-count").textContent = days + " ZILE";
}

function updateBatteryUI(elementId, barId, level) {
  if (level === null || level === undefined) return;
  document.getElementById(elementId).textContent = level + "%";
  document.getElementById(barId).style.width = level + "%";
}

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function startLocationTracking() {
  if (!navigator.geolocation) return;
  navigator.geolocation.watchPosition(pos => {
    myLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    if (session.pairCode) {
      updateDoc(doc(db, "perechi", session.pairCode), {
        [`${session.myId}_lat`]: myLocation.lat,
        [`${session.myId}_lng`]: myLocation.lng
      }).catch(() => {});
    }
  }, null, { enableHighAccuracy: true, maximumAge: 30000 });
}

function syncBattery() {
  if (!navigator.getBattery) return;
  navigator.getBattery().then(bat => {
    const push = () => {
      const level = Math.round(bat.level * 100);
      updateBatteryUI("my-battery-level", "my-battery-bar", level);
      if (session.pairCode) {
        updateDoc(doc(db, "perechi", session.pairCode), {
          [`${session.myId}_battery`]: level
        }).catch(() => {});
      }
    };
    bat.addEventListener("levelchange", push);
    push();
  });
}

// ── SCREENS ──────────────────────────────────────────────────────────────

window.startApp = () => {
  const name = document.getElementById("intro-name").value.trim();
  if (!name) { toast("Introdu un nume! 🥺"); return; }
  session.userName = name;
  document.getElementById("pair-welcome").textContent = "Bun venit, " + name + "! 💕";
  show("screen-pair");
};

window.generateCode = async () => {
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  try {
    await setDoc(doc(db, "perechi", code), {
      user1_name: session.userName,
      created: true,
      anniversary_date: ""
    });
    session.pairCode = code;
    session.myId = "user1";
    saveSessionToDevice();
    document.getElementById("display-code").textContent = code;
    show("screen-code");
  } catch (e) {
    toast("Eroare la creare. Încearcă din nou!");
    console.error(e);
  }
};

window.joinCode = async () => {
  const code = document.getElementById("join-code-input").value.trim().toUpperCase();
  if (code.length < 4) { toast("Cod prea scurt!"); return; }
  try {
    const snap = await getDoc(doc(db, "perechi", code));
    if (!snap.exists()) { toast("Cod invalid! ❌"); return; }
    await updateDoc(doc(db, "perechi", code), { user2_name: session.userName });
    session.pairCode = code;
    session.myId = "user2";
    saveSessionToDevice();
    showMain();
  } catch (e) {
    toast("Eroare de conexiune.");
    console.error(e);
  }
};

window.copyCode = () => {
  const code = document.getElementById("display-code").textContent;
  navigator.clipboard.writeText(code).then(() => toast("Cod copiat! 📋")).catch(() => {
    const el = document.createElement("textarea");
    el.value = code;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
    toast("Cod copiat! 📋");
  });
};

window.showMain = () => {
  show("screen-main");
  showNavBar();
  initCal();
  startLiveSync();
  syncBattery();
  startLocationTracking();

  if (session.pairCode) {
    const heartbeat = () => {
      updateDoc(doc(db, "perechi", session.pairCode), {
        [`${session.myId}_lastActive`]: Date.now()
      }).catch(() => {});
    };
    heartbeat();
    setInterval(heartbeat, 20000);
  }
};

// ── LIVE SYNC ─────────────────────────────────────────────────────────────

window.startLiveSync = () => {
  if (liveSyncUnsubscribe) liveSyncUnsubscribe();
  if (!session.pairCode) return;

  liveSyncUnsubscribe = onSnapshot(doc(db, "perechi", session.pairCode), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const o = otherId();

    updateDaysCounter(data.anniversary_date);

    if (data[`${o}_battery`] !== undefined) {
      updateBatteryUI("partner-battery-level", "partner-battery-bar", data[`${o}_battery`]);
    }

    if (data[`${session.myId}_photo`]) {
      document.getElementById("my-photo").src = data[`${session.myId}_photo`];
    }
    if (data[`${o}_photo`]) {
      document.getElementById("partner-photo").src = data[`${o}_photo`];
    }

    const pPulse = data[`${o}_pulse`];
    if (pPulse && pPulse > lastPulseTimestamp) {
      lastPulseTimestamp = pPulse;
      if (navigator.vibrate) navigator.vibrate([100, 50, 100, 50, 100]);
      triggerPulseUI();
    }

    const partnerName = data[`${o}_name`] || data[o === "user1" ? "user1_name" : "user2_name"] || "Partener";
    document.getElementById("partner-status").textContent = partnerName;
    document.getElementById("partner-message").textContent = data[`${o}_message`] || "...";

    const mood = data[`${o}_mood`];
    if (mood) document.getElementById("partner-mood").textContent = mood;

    const lastActive = data[`${o}_lastActive`] || 0;
    const isOnline = (Date.now() - lastActive) < 45000;
    document.getElementById("partner-online").textContent = isOnline ? "🟢 Online" : "⚪ Offline";

    const oLat = data[`${o}_lat`];
    const oLng = data[`${o}_lng`];
    if (myLocation && oLat && oLng) {
      const km = haversineKm(myLocation.lat, myLocation.lng, oLat, oLng);
      const label = km < 1 ? Math.round(km * 1000) + " m distanță 💕" : km.toFixed(1) + " km distanță 💕";
      document.getElementById("distance-display").textContent = "📍 " + label;
    } else if (oLat && oLng) {
      document.getElementById("distance-display").textContent = "📍 Locația partenerului disponibilă";
    } else {
      document.getElementById("distance-display").textContent = "📍 Locația partenerului indisponibilă";
    }

    if (data[`${o}_song`]) {
      document.getElementById("partner-song").textContent = data[`${o}_song`];
      document.getElementById("partner-play-icon").textContent = "⏸";
    }
    if (data[`${session.myId}_song`]) {
      document.getElementById("my-song").textContent = data[`${session.myId}_song`];
    }

    syncCalendarFromFirestore(data);
    syncJournalFromFirestore(data);
    syncChallengesFromFirestore(data);
  });
};

// ── ACTIONS ──────────────────────────────────────────────────────────────

window.sendMessage = async () => {
  const msg = document.getElementById("msg-input").value.trim();
  if (!msg || !session.pairCode) return;
  try {
    await updateDoc(doc(db, "perechi", session.pairCode), {
      [`${session.myId}_message`]: msg,
      [`${session.myId}_name`]: session.userName
    });
    document.getElementById("msg-input").value = "";
    toast("Mesaj trimis 💌");
  } catch (e) {
    toast("Eroare la trimitere!");
  }
};

window.handleMsgKey = (e) => {
  if (e.key === "Enter") sendMessage();
};

window.setMood = async (emoji) => {
  if (!session.pairCode) return;
  document.querySelectorAll(".mood-btn").forEach(btn => {
    btn.classList.toggle("active", btn.textContent === emoji);
  });
  try {
    await updateDoc(doc(db, "perechi", session.pairCode), {
      [`${session.myId}_mood`]: emoji
    });
    toast("Mood actualizat " + emoji);
  } catch (e) {
    console.error(e);
  }
};

window.sendPulse = async () => {
  if (!session.pairCode) return;
  try {
    await updateDoc(doc(db, "perechi", session.pairCode), {
      [`${session.myId}_pulse`]: Date.now()
    });
    floatingHearts();
    toast("Pulse trimis 💓");
    if (navigator.vibrate) navigator.vibrate(200);
  } catch (e) {
    toast("Eroare la pulse!");
  }
};

window.triggerPulseUI = () => {
  floatingHearts();
  toast("💓 Pulse primit de la jumătatea ta!");
};

window.openPartnerMap = async () => {
  if (!session.pairCode) return;
  try {
    const snap = await getDoc(doc(db, "perechi", session.pairCode));
    if (!snap.exists()) return;
    const data = snap.data();
    const o = otherId();
    const lat = data[`${o}_lat`];
    const lng = data[`${o}_lng`];
    if (lat && lng) {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
    } else {
      toast("Partenerul nu a activat locația 📍");
    }
  } catch (e) {
    toast("Nu s-a putut deschide harta.");
  }
};

window.syncSpotify = async () => {
  const song = prompt("Ce asculți acum? (artist - melodie)");
  if (song && session.pairCode) {
    try {
      await updateDoc(doc(db, "perechi", session.pairCode), {
        [`${session.myId}_song`]: song
      });
      document.getElementById("my-song").textContent = song;
      toast("Muzică actualizată 🎵");
    } catch (e) {
      toast("Eroare la sync muzică.");
    }
  }
};

window.changePhoto = () => document.getElementById("file-input").click();

window.handleFileSelect = (event) => {
  const file = event.target.files[0];
  if (!file) return;
  if (file.size > 1.5 * 1024 * 1024) {
    toast("Poza e prea mare! Alege una sub 1.5MB. 📸");
    return;
  }
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64Image = e.target.result;
    document.getElementById("my-photo").src = base64Image;
    try {
      await updateDoc(doc(db, "perechi", session.pairCode), {
        [`${session.myId}_photo`]: base64Image
      });
      toast("Poză actualizată! 📸");
    } catch (err) {
      toast("Eroare la salvarea pozei.");
    }
  };
  reader.readAsDataURL(file);
  event.target.value = "";
};

window.setAnniversaryDate = async () => {
  const current = localStorage.getItem("tf_anniversary") || "";
  const newDate = prompt("Data aniversării (AAAA-LL-ZZ):", current || "2024-01-01");
  if (!newDate) return;
  if (isNaN(Date.parse(newDate))) { toast("Dată invalidă!"); return; }
  localStorage.setItem("tf_anniversary", newDate);
  try {
    await updateDoc(doc(db, "perechi", session.pairCode), { anniversary_date: newDate });
    updateDaysCounter(newDate);
    toast("Dată salvată! ❤️");
  } catch (e) {
    toast("Eroare la salvare.");
  }
};

// ── NAV ──────────────────────────────────────────────────────────────────

window.navTo = (tab) => {
  ['main', 'calendar', 'journal', 'challenges'].forEach(t => {
    document.getElementById('screen-' + t).classList.remove('active');
    const btn = document.getElementById('nav-' + t);
    if (btn) btn.classList.remove('active');
  });
  document.getElementById('screen-' + tab).classList.add('active');
  const active = document.getElementById('nav-' + tab);
  if (active) active.classList.add('active');
  window.scrollTo(0, 0);
  if (tab === 'calendar') renderCalendar();
  if (tab === 'journal') renderJournal();
  if (tab === 'challenges') renderChallenges();
};

function showNavBar() {
  document.getElementById('bottom-nav').classList.add('visible');
}

// ── CALENDAR ─────────────────────────────────────────────────────────────

let calYear, calMonth;

function initCal() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
}

window.calPrev = () => { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } renderCalendar(); };
window.calNext = () => { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } renderCalendar(); };

function renderCalendar() {
  const monthNames = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie',
                      'Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie'];
  document.getElementById('cal-month-label').textContent = monthNames[calMonth] + ' ' + calYear;

  const namesEl = document.getElementById('cal-day-names');
  namesEl.innerHTML = ['Lu','Ma','Mi','Jo','Vi','Sâ','Du'].map(d => `<div class="cal-day-name">${d}</div>`).join('');

  const grid = document.getElementById('cal-grid');
  grid.innerHTML = '';
  const first = new Date(calYear, calMonth, 1).getDay();
  const offset = (first === 0 ? 6 : first - 1);
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const today = new Date();

  const events = getEvents();
  const eventDays = new Set(events
    .filter(e => { const d = new Date(e.date); return d.getFullYear() === calYear && d.getMonth() === calMonth; })
    .map(e => new Date(e.date).getDate()));

  for (let i = 0; i < offset; i++) grid.innerHTML += `<div class="cal-day empty"></div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
    const hasEv = eventDays.has(d);
    grid.innerHTML += `<div class="cal-day${isToday ? ' today' : ''}${hasEv ? ' has-event' : ''}" onclick="calDayClick(${d})">${d}</div>`;
  }

  renderEventList();
}

window.calDayClick = (day) => {
  const dateStr = calYear + '-' + String(calMonth + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
  document.getElementById('event-date-input').value = dateStr;
  document.getElementById('event-title-input').focus();
};

function getEvents() {
  try { return JSON.parse(localStorage.getItem('tf_events_' + session.pairCode) || '[]'); }
  catch { return []; }
}

function saveEvents(evs) {
  localStorage.setItem('tf_events_' + session.pairCode, JSON.stringify(evs));
  if (session.pairCode) {
    updateDoc(doc(db, "perechi", session.pairCode), { calendar_events: evs }).catch(() => {});
  }
}

window.addEvent = () => {
  const title = document.getElementById('event-title-input').value.trim();
  const date  = document.getElementById('event-date-input').value.trim();
  if (!title || !date) { toast('Completează titlul și data! 📅'); return; }
  if (isNaN(Date.parse(date))) { toast('Dată invalidă!'); return; }
  const evs = getEvents();
  evs.push({ id: Date.now(), title, date, author: session.userName });
  evs.sort((a, b) => new Date(a.date) - new Date(b.date));
  saveEvents(evs);
  document.getElementById('event-title-input').value = '';
  document.getElementById('event-date-input').value = '';
  renderCalendar();
  toast('Eveniment adăugat! 📅');
};

window.deleteEvent = (id) => {
  const evs = getEvents().filter(e => e.id !== id);
  saveEvents(evs);
  renderCalendar();
};

function renderEventList() {
  const evs = getEvents();
  const el = document.getElementById('event-list');
  if (!evs.length) { el.innerHTML = '<p style="color:var(--grey);font-size:13px;">Niciun eveniment încă.</p>'; return; }
  el.innerHTML = evs.map(e => `
    <div class="event-item">
      <div class="event-info">
        <span class="event-title">${e.title}</span>
        <span class="event-date">📅 ${formatDateRo(e.date)} · ${e.author || ''}</span>
      </div>
      <button class="event-delete" onclick="deleteEvent(${e.id})">🗑️</button>
    </div>`).join('');
}

function formatDateRo(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' });
}

function syncCalendarFromFirestore(data) {
  if (data.calendar_events && Array.isArray(data.calendar_events)) {
    localStorage.setItem('tf_events_' + session.pairCode, JSON.stringify(data.calendar_events));
    if (document.getElementById('screen-calendar').classList.contains('active')) renderCalendar();
  }
}

// ── JOURNAL ───────────────────────────────────────────────────────────────

function getJournalEntries() {
  try { return JSON.parse(localStorage.getItem('tf_journal_' + session.pairCode) || '[]'); }
  catch { return []; }
}

function saveJournalEntries(entries) {
  localStorage.setItem('tf_journal_' + session.pairCode, JSON.stringify(entries));
  if (session.pairCode) {
    updateDoc(doc(db, "perechi", session.pairCode), { journal_entries: entries }).catch(() => {});
  }
}

window.addJournalEntry = () => {
  const text = document.getElementById('journal-input').value.trim();
  if (!text) { toast('Scrie ceva mai întâi! 📓'); return; }
  const entries = getJournalEntries();
  entries.unshift({ id: Date.now(), text, author: session.userName, date: new Date().toISOString() });
  saveJournalEntries(entries);
  document.getElementById('journal-input').value = '';
  renderJournal();
  toast('Intrare salvată 📓');
};

window.deleteJournalEntry = (id) => {
  const entries = getJournalEntries().filter(e => e.id !== id);
  saveJournalEntries(entries);
  renderJournal();
};

function renderJournal() {
  const entries = getJournalEntries();
  const el = document.getElementById('journal-list');
  if (!entries.length) {
    el.innerHTML = '<p style="text-align:center;color:var(--grey);font-size:14px;">Jurnalul vostru e gol. Fiți primii care scriu! ✨</p>';
    return;
  }
  el.innerHTML = entries.map(e => {
    const d = new Date(e.date);
    const dateStr = d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' }) + ' · ' + d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    const isMine = e.author === session.userName;
    return `<div class="journal-entry">
      <div class="entry-header">
        <span class="entry-author">${e.author || 'Anonim'}</span>
        <span class="entry-date">${dateStr}</span>
      </div>
      <div class="entry-text">${e.text.replace(/\n/g, '<br>')}</div>
      ${isMine ? `<button class="entry-delete" onclick="deleteJournalEntry(${e.id})">🗑 șterge</button>` : ''}
    </div>`;
  }).join('');
}

function syncJournalFromFirestore(data) {
  if (data.journal_entries && Array.isArray(data.journal_entries)) {
    localStorage.setItem('tf_journal_' + session.pairCode, JSON.stringify(data.journal_entries));
    if (document.getElementById('screen-journal').classList.contains('active')) renderJournal();
  }
}

// ── CHALLENGES ────────────────────────────────────────────────────────────

const CHALLENGE_POOL = [
  { emoji: '🌅', title: 'Răsărit împreună', desc: 'Treziți-vă amândoi înainte de răsărit și trimiteți o poză cu cerul.' },
  { emoji: '💌', title: 'Scrisoare de dragoste', desc: 'Scrieți câte o scrisoare de dragoste și citiți-o celuilalt.' },
  { emoji: '🍳', title: 'Micul dejun surpriză', desc: 'Pregătește micul dejun preferat al partenerului tău.' },
  { emoji: '📸', title: 'Selfie de cuplu', desc: 'Faceți un selfie împreună și stabiliți-l ca wallpaper.' },
  { emoji: '🎬', title: 'Film nou', desc: 'Alegeți un film pe care niciunul nu l-a văzut și urmăriți-l împreună.' },
  { emoji: '🌙', title: 'Apus de soare', desc: 'Urmăriți apusul de soare împreună (live sau pe video call).' },
  { emoji: '🎵', title: 'Playlist comun', desc: 'Creați împreună un playlist cu 10 melodii care vă reprezintă.' },
  { emoji: '🍕', title: 'Data culinară', desc: 'Gătiti împreună o rețetă nouă pe care nu ați mai încercat-o.' },
  { emoji: '🚶', title: 'Plimbare surpriză', desc: 'Organizați o plimbare în locul vostru preferat din oraș.' },
  { emoji: '💐', title: 'Gest mic, impact mare', desc: 'Lasă un bilet/mesaj surpriză în locul unde știi că îl/o va găsi.' },
  { emoji: '🎮', title: 'Gaming împreună', desc: 'Jucați un joc online sau board game timp de o oră.' },
  { emoji: '📖', title: 'Citiți împreună', desc: 'Alegeți o carte și citiți același capitol, apoi discutați.' },
  { emoji: '🌟', title: '3 lucruri frumoase', desc: 'Spuneți-vă 3 lucruri pe care le apreciați la celălalt în această săptămână.' },
  { emoji: '🧘', title: 'Meditație în doi', desc: 'Meditați 10 minute împreună pe video call sau fizic.' },
  { emoji: '🗺️', title: 'Loc nou', desc: 'Descoperiți un loc din orașul vostru pe care nu l-ați mai vizitat.' },
];

function getChallengeState() {
  try { return JSON.parse(localStorage.getItem('tf_challenges_' + session.pairCode) || 'null'); }
  catch { return null; }
}

function saveChallengeState(state) {
  localStorage.setItem('tf_challenges_' + session.pairCode, JSON.stringify(state));
  if (session.pairCode) {
    updateDoc(doc(db, "perechi", session.pairCode), { challenge_state: state }).catch(() => {});
  }
}

window.refreshChallenges = () => {
  const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5).slice(0, 5);
  const state = { challenges: shuffled.map((c, i) => ({ ...c, id: i, myDone: false, partnerDone: false })), myScore: 0, partnerScore: 0 };
  saveChallengeState(state);
  renderChallenges();
  toast('Challenguri noi! 🎲');
};

window.toggleChallenge = (id) => {
  const state = getChallengeState();
  if (!state) return;
  const ch = state.challenges.find(c => c.id === id);
  if (!ch) return;
  ch.myDone = !ch.myDone;
  state.myScore = state.challenges.filter(c => c.myDone).length;
  saveChallengeState(state);
  renderChallenges();
  if (ch.myDone) { toast('Challenge completat! 🎯'); floatingHearts(); }
};

function renderChallenges() {
  let state = getChallengeState();
  if (!state) {
    const shuffled = [...CHALLENGE_POOL].sort(() => Math.random() - 0.5).slice(0, 5);
    state = { challenges: shuffled.map((c, i) => ({ ...c, id: i, myDone: false, partnerDone: false })), myScore: 0, partnerScore: 0 };
    saveChallengeState(state);
  }
  document.getElementById('my-score').textContent = state.myScore || 0;
  document.getElementById('partner-score').textContent = state.partnerScore || 0;
  document.getElementById('my-score-label').textContent = session.userName || 'TU';

  const el = document.getElementById('challenges-list');
  el.innerHTML = state.challenges.map(ch => {
    const progress = ((ch.myDone ? 1 : 0) + (ch.partnerDone ? 1 : 0)) / 2 * 100;
    return `<div class="challenge-card">
      <span class="ch-emoji">${ch.emoji}</span>
      <div class="ch-title">${ch.title}</div>
      <div class="ch-desc">${ch.desc}</div>
      <div class="ch-status">
        <button class="ch-check ${ch.myDone ? 'done' : ''}" onclick="toggleChallenge(${ch.id})">
          ${ch.myDone ? '✅ Tu: Gata!' : '⬜ Tu: Marchează'}
        </button>
        <button class="ch-check ${ch.partnerDone ? 'done-partner' : ''}" disabled>
          ${ch.partnerDone ? '💕 Partener: Gata!' : '⏳ Partener'}
        </button>
      </div>
      <div class="challenge-progress"><div class="challenge-progress-fill" style="width:${progress}%"></div></div>
    </div>`;
  }).join('');
}

function syncChallengesFromFirestore(data) {
  if (data.challenge_state) {
    const state = data.challenge_state;
    const local = getChallengeState();
    if (local && state.challenges) {
      state.challenges.forEach((ch, i) => {
        if (local.challenges[i]) {
          local.challenges[i].partnerDone = ch.myDone;
        }
      });
      local.partnerScore = state.myScore || 0;
      localStorage.setItem('tf_challenges_' + session.pairCode, JSON.stringify(local));
    } else {
      localStorage.setItem('tf_challenges_' + session.pairCode, JSON.stringify(state));
    }
    if (document.getElementById('screen-challenges').classList.contains('active')) renderChallenges();
  }
}

// ── INIT ──────────────────────────────────────────────────────────────────

loadSessionFromDevice();
if (session.pairCode && session.myId && session.userName) {
  document.getElementById("intro-name").value = session.userName;
  showMain();
}