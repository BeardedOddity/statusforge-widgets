/* === WebSocket Receiver & Sentry Logic (v2.6.0) === */
let lastGame = "";
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
        offlineBadge.innerHTML = `⚠️ ${message}`;
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

                // 1. Session Timer (Purely visual)
                if (scoutData.is_playing) {
                    startTime = scoutData.start_time;
                    if (!sessionInterval) sessionInterval = setInterval(updateTimer, 1000);
                } else {
                    startTime = 0;
                    clearInterval(sessionInterval);
                    sessionInterval = null;
                }

                // 2. THE SENTRY CHECK: Only react if the title is actually DIFFERENT
                if (scoutData.game_title !== lastGame) {
                    console.log(`[SENTRY] State Change: ${lastGame} -> ${scoutData.game_title}`);
                    lastGame = scoutData.game_title;

                    // Update UI immediately
                    updateUI(scoutData);

                    // 3. FADE LOGIC
                    if (scoutData.game_title === idleCategory) {
                        // IDLE STATE: Stay visible forever
                        if (widgetFadeTimer) {
                            clearTimeout(widgetFadeTimer);
                            widgetFadeTimer = null;
                        }
                        if (w) w.style.opacity = "1";
                        console.log("[SENTRY] Idle state detected. Widget locked to VISIBLE.");
                    } 
                    else {
                        // GAME STATE: Show then Fade
                        if (w) w.style.opacity = "1";
                        
                        if (widgetFadeTimer) clearTimeout(widgetFadeTimer);
                        
                        console.log(`[SENTRY] Game detected. Fading in ${fadeSecs}s...`);
                        widgetFadeTimer = setTimeout(() => {
                            if (w) w.style.opacity = "0";
                            console.log("[SENTRY] Fade complete.");
                        }, fadeSecs * 1000);
                    }
                }
            }
        } catch (err) { console.error("Logic Error", err); }
    };

    ws.onclose = () => { setTimeout(connectWebSocket, 5000); };
}

function updateUI(scoutData) {
    const ids = { t: 'game_title', r: 'release_date', g: 'genre' };
    for (let id in ids) {
        const el = document.getElementById(id);
        if (el) el.innerText = scoutData[ids[id]] || (id === 't' ? "" : "---");
    }
    
    const p = document.getElementById('p');
    if (p) p.innerText = (scoutData.developer || "StatusForge") + (scoutData.publisher ? ` / ${scoutData.publisher}` : "");

    const cover = document.getElementById('a');
    if (cover) {
        cover.style.backgroundImage = scoutData.cover_url ? `url('${scoutData.cover_url}')` : 'none';
    }
    if (offlineBadge) offlineBadge.style.display = 'none';
}

function updateTimer() {
    if (!startTime) {
        const el = document.getElementById("s"); 
        if (el) el.innerText = `⏱️ 00:00:00`;
        return;
    }
    const diff = Math.floor(Date.now() / 1000) - Math.floor(startTime);
    const h = String(Math.floor(diff / 3600)).padStart(2, '0');
    const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const s = String(diff % 60).padStart(2, '0');
    const el = document.getElementById("s"); 
    if (el) el.innerText = `⏱️ ${h}:${m}:${s}`;
}

connectWebSocket();
