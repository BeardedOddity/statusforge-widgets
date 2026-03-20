/* === WebSocket Receiver & State-Guarded Engine (v2.4.0) === */
let lastGame = "";
let lastCoverBase = ""; 
let sessionInterval;
let widgetFadeTimer = null; 
let startTime = 0;
let lastKnownPulse = 0;
let ws; 

const urlParams = new URLSearchParams(window.location.search);
const widgetToken = urlParams.get('token');

const w = document.getElementById("w"); 
const offlineBadge = document.getElementById('offline-badge');
const mainWidget = document.getElementById('main-widget-container');

function showOffline(message) {
    if(offlineBadge) {
        offlineBadge.innerHTML = `⚠️ ${message}<span style="display: block; font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 5px;">App must be active.</span>`;
        offlineBadge.style.display = 'flex';
    }
    if(w) w.style.opacity = "0"; 
}

function connectWebSocket() {
    if (!widgetToken) { showOffline("No Token"); return; }

    ws = new WebSocket(`ws://127.0.0.1:5050/ws?token=${widgetToken}`);

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.event === "error") { showOffline("Security Lockout"); ws.close(); return; }

            if (data.event === "init" || data.event === "update") {
                const scoutData = data.payload;
                const fadeSecs = parseInt(scoutData.fade_timer, 10) || 0;
                const incomingCoverBase = (scoutData.cover_url || "").split('?')[0];

                // 1. Session Timer (Always update the numbers, but don't reset the fade)
                if (scoutData.is_playing) {
                    startTime = scoutData.start_time;
                    if (!sessionInterval) sessionInterval = setInterval(updateTimer, 1000);
                } else {
                    startTime = 0;
                    clearInterval(sessionInterval);
                    sessionInterval = null;
                }

                // 2. THE BOUNCER: Decide if we actually need to "Wake Up" the widget
                const gameChanged = scoutData.game_title !== lastGame;
                const coverChanged = incomingCoverBase !== lastCoverBase;
                const pulseTriggered = scoutData.last_pulse > lastKnownPulse;

                if (gameChanged || coverChanged || pulseTriggered) {
                    console.log(`[WAKE] Reason: Game(${gameChanged}) Cover(${coverChanged}) Pulse(${pulseTriggered})`);
                    
                    // Update state trackers
                    lastGame = scoutData.game_title;
                    lastCoverBase = incomingCoverBase;
                    lastKnownPulse = scoutData.last_pulse;

                    // Trigger the UI Reveal & Timer Reset
                    wakeWidget(scoutData, fadeSecs);
                } else {
                    // Logic is idling. Data is the same, so we let the timer continue its countdown.
                }
            }
        } catch (err) { console.error("Data Parse Error", err); }
    };

    ws.onclose = () => { setTimeout(connectWebSocket, 5000); };
}

function wakeWidget(scoutData, fadeSecs) {
    if (!w) return;

    // Clear existing timer immediately to prevent overlaps
    if (widgetFadeTimer) {
        clearTimeout(widgetFadeTimer);
        widgetFadeTimer = null;
    }

    // Update Visuals
    smoothTextUpdate("t", scoutData.game_title);
    smoothTextUpdate("r", scoutData.release_date || "UNKNOWN");
    smoothTextUpdate("g", scoutData.genre || "GAMING");
    let studioText = (scoutData.developer || "INDIE") + (scoutData.publisher && scoutData.publisher !== scoutData.developer ? ` / ${scoutData.publisher}` : "");
    smoothTextUpdate("p", studioText); 
    applyCoverArt(scoutData.cover_url || '');

    // Reveal Widget
    w.style.opacity = "1";
    if (offlineBadge) offlineBadge.style.display = 'none';

    // Set the Sleep Timer
    if (fadeSecs > 0) {
        console.log(`[SLEEP] Initialized: Fading in ${fadeSecs} seconds.`);
        widgetFadeTimer = setTimeout(() => {
            w.style.opacity = "0";
            console.log("[SLEEP] Target reached. Widget faded out.");
        }, fadeSecs * 1000);
    }
}

function smoothTextUpdate(id, text) {
    const el = document.getElementById(id);
    if(!el || el.innerText === text) return;
    el.style.opacity = 0;
    setTimeout(() => { el.innerText = text; el.style.opacity = 1; }, 400); 
}

function applyCoverArt(url) {
    const cover = document.getElementById('a');
    if(!cover) return;
    cover.style.opacity = 0;
    setTimeout(() => {
        cover.style.backgroundImage = url ? `url('${url}')` : 'none';
        cover.style.backgroundColor = url ? '#111' : '#050505';
        cover.style.opacity = 1;
    }, 400);
}

function updateTimer() {
    if (!startTime) return;
    const diff = Math.floor(Date.now() / 1000) - Math.floor(startTime);
    if (diff < 0) return;
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    const el = document.getElementById("s"); 
    if (el) el.innerText = `⏱️ ${h}:${m}:${s}`;
}

connectWebSocket();
