/* === WebSocket Receiver & Offline Engine (v2.3.0) === */
let lastGame = "";
let lastCover = ""; 
let sessionInterval;
let widgetFadeTimer = null; 
let startTime = 0;
let lastKnownPulse = 0;
let ws; 

const urlParams = new URLSearchParams(window.location.search);
const widgetToken = urlParams.get('token');

const offlineBadge = document.getElementById('offline-badge');
const mainWidget = document.getElementById('main-widget-container');
const w = document.getElementById("w"); 

function showOffline(message) {
    if(offlineBadge) {
        offlineBadge.innerHTML = `⚠️ ${message}<span style="display: block; font-size: 10px; color: rgba(255,255,255,0.5); margin-top: 5px;">App must be active to use widget.</span>`;
        offlineBadge.style.display = 'flex';
    }
    if(mainWidget) mainWidget.style.display = 'none';
    if(w) w.style.opacity = "0"; 
}

function showOnline() {
    if(offlineBadge) offlineBadge.style.display = 'none';
    if(mainWidget) mainWidget.style.display = 'block'; 
}

function connectWebSocket() {
    if (!widgetToken) {
        showOffline("No Widget Token Provided");
        return;
    }

    ws = new WebSocket(`ws://127.0.0.1:5050/ws?token=${widgetToken}`);

    ws.onopen = () => { showOnline(); };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.event === "error") {
                showOffline("Security Lockout");
                ws.close();
                return;
            }

            if (data.event === "init" || data.event === "update") {
                const scoutData = data.payload;
                
                // STRICT TYPE PARSING: Force the timer to be a real number
                const fadeSecs = parseInt(scoutData.fade_timer, 10) || 0;

                // 1. Session Timer
                if (scoutData.is_playing) {
                    startTime = scoutData.start_time;
                    if (!sessionInterval) sessionInterval = setInterval(updateTimer, 1000);
                } else {
                    startTime = 0;
                    clearInterval(sessionInterval);
                    sessionInterval = null;
                    const el = document.getElementById("s"); 
                    if (el) el.innerText = `⏱️ 00:00:00`;
                }
                
                const currentCoverBase = (scoutData.cover_url || "").split('?')[0];
                const lastCoverBase = (lastCover || "").split('?')[0];
                
                // 2. Trigger updates ONLY if the title or raw image changes
                if (scoutData.game_title !== lastGame || currentCoverBase !== lastCoverBase) {
                    lastGame = scoutData.game_title;
                    lastCover = scoutData.cover_url; 
                    
                    if (widgetFadeTimer) clearTimeout(widgetFadeTimer);
                    
                    if (w) w.style.opacity = "1";
                    
                    smoothTextUpdate("t", scoutData.game_title); 
                    smoothTextUpdate("r", scoutData.release_date || "UNKNOWN");
                    smoothTextUpdate("g", scoutData.genre || "GAMING");
                    
                    let studioText = scoutData.developer || "INDIE";
                    if (scoutData.publisher && scoutData.publisher !== scoutData.developer) {
                        studioText += ` / ${scoutData.publisher}`;
                    }
                    smoothTextUpdate("p", studioText); 
                    
                    applyCoverArt(scoutData.cover_url || '');
                    
                    // Send strictly parsed number to the fade function
                    if (w) resetFadeTimer(w, fadeSecs);
                }
                
                // 3. Pulse check (Ignores minor millisecond changes to prevent runaway loops)
                if (scoutData.last_pulse && (scoutData.last_pulse - lastKnownPulse > 1)) {
                    lastKnownPulse = scoutData.last_pulse;
                    if (widgetFadeTimer) clearTimeout(widgetFadeTimer);
                    if (w) w.style.opacity = "1";
                    if (w) resetFadeTimer(w, fadeSecs);
                }
            }
        } catch (err) {
            console.error("Failed to parse", err);
        }
    };

    ws.onclose = () => {
        showOffline("StatusForge Offline");
        lastGame = ""; 
        lastCover = ""; 
        clearInterval(sessionInterval);
        sessionInterval = null;
        setTimeout(connectWebSocket, 5000);
    };
}

function resetFadeTimer(widgetElement, fadeTimerSettings) {
    if (fadeTimerSettings > 0) {
        widgetFadeTimer = setTimeout(() => {
            widgetElement.style.opacity = "0";
        }, fadeTimerSettings * 1000);
    } 
}

function smoothTextUpdate(id, text) {
    const el = document.getElementById(id);
    if(!el) return;
    if(el.innerText === text) return; 
    el.style.opacity = 0;
    setTimeout(() => { el.innerText = text; el.style.opacity = 1; }, 500); 
}

function applyCoverArt(url) {
    const cover = document.getElementById('a');
    if(!cover) return;
    cover.style.opacity = 0;
    setTimeout(() => {
        if(url) {
            cover.style.backgroundImage = `url('${url}')`;
            cover.style.backgroundColor = '#111';
        } else {
            cover.style.backgroundImage = 'none';
            cover.style.backgroundColor = '#050505'; 
        }
        cover.style.opacity = 1;
    }, 500);
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
