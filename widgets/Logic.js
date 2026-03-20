/* === WebSocket Receiver & Forge Architect Sync (v2.9.0) === */
let lastGame = "";
let lastCoverBase = ""; 
let lastKnownPulse = 0; // The Forge Exception Tracker
let sessionInterval;
let widgetFadeTimer = null; 
let startTime = 0;
let ws; 

const urlParams = new URLSearchParams(window.location.search);
const widgetToken = urlParams.get('token');

const w = document.getElementById("w"); 
const offlineBadge = document.getElementById('offline-badge');

function showOffline(message) {
    if(offlineBadge) {
        offlineBadge.innerHTML = `⚠️ StatusForge Offline`;
        offlineBadge.style.display = 'flex';
    }
    if(w) w.style.opacity = "0"; 
}

function connectWebSocket() {
    if (!widgetToken) return;

    ws = new WebSocket(`ws://127.0.0.1:5050/ws?token=${widgetToken}`);

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.event === "error") { ws.close(); return; }

            if (data.event === "init" || data.event === "update") {
                const scoutData = data.payload;
                const fadeSecs = parseInt(scoutData.fade_timer, 10) || 15;
                const idleCategory = scoutData.idle_category || "Just Chatting";
                
                const incomingCoverBase = (scoutData.cover_url || "").split('?')[0];
                const gameChanged = scoutData.game_title !== lastGame;
                const coverChanged = incomingCoverBase !== lastCoverBase;
                
                // --- THE FORGE EXCEPTION ---
                // If last_pulse is higher than what we know, a manual save occurred!
                const pulseTriggered = scoutData.last_pulse > lastKnownPulse;

                if (gameChanged || coverChanged || pulseTriggered) {
                    console.log(`[FORGE] Update Detected. Pulse: ${pulseTriggered}`);
                    
                    // 1. Force visual update
                    updateUI(scoutData);
                    
                    // 2. If it's a new game OR a manual database update, wake the widget up
                    if (gameChanged || pulseTriggered) {
                        handleVisibility(scoutData.game_title, idleCategory, fadeSecs);
                    }

                    // 3. Commit state
                    lastGame = scoutData.game_title;
                    lastCoverBase = incomingCoverBase;
                    lastKnownPulse = scoutData.last_pulse;
                }

                if (scoutData.is_playing) {
                    startTime = scoutData.start_time;
                    if (!sessionInterval) sessionInterval = setInterval(updateTimer, 1000);
                } else {
                    startTime = 0;
                    clearInterval(sessionInterval);
                    sessionInterval = null;
                }
            }
        } catch (err) { console.error("Logic Error", err); }
    };

    ws.onclose = () => { setTimeout(connectWebSocket, 5000); };
}

function handleVisibility(title, idle, fade) {
    if (!w) return;
    if (widgetFadeTimer) { clearTimeout(widgetFadeTimer); widgetFadeTimer = null; }

    if (title === idle) {
        w.style.opacity = "1";
    } else {
        w.style.opacity = "1";
        widgetFadeTimer = setTimeout(() => {
            w.style.opacity = "0";
            console.log("[FORGE] Transition to sleep complete.");
        }, fade * 1000);
    }
}

function updateUI(scoutData) {
    const fields = { t: 'game_title', r: 'release_date', g: 'genre' };
    for (let id in fields) {
        const el = document.getElementById(id);
        if (el) el.innerText = scoutData[fields[id]] || (id === 't' ? "" : "---");
    }
    
    const p = document.getElementById('p');
    if (p) p.innerText = (scoutData.developer || "StatusForge") + (scoutData.publisher ? ` / ${scoutData.publisher}` : "");

    const cover = document.getElementById('a');
    if (cover) {
        if (scoutData.cover_url) {
            // Force browser to ignore cache for the updated database image
            const freshUrl = scoutData.cover_url.split('?')[0] + '?v=' + Date.now();
            cover.style.backgroundImage = `url('${freshUrl}')`;
        } else {
            cover.style.backgroundImage = 'none';
        }
    }
    if (offlineBadge) offlineBadge.style.display = 'none';
}

function updateTimer() {
    const el = document.getElementById("s"); 
    if (!el) return;
    if (!startTime) { el.innerText = `⏱️ 00:00:00`; return; }
    const diff = Math.floor(Date.now() / 1000) - Math.floor(startTime);
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    el.innerText = `⏱️ ${h}:${m}:${s}`;
}

connectWebSocket();
