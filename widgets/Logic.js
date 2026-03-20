/* === WebSocket Receiver & Offline Engine (v2.1.0) === */
let lastGame = "";
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

    ws.onopen = () => {
        console.log("WebSocket Connected to StatusForge Engine.");
        showOnline();
    };

    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);

            if (data.event === "error") {
                showOffline("Security Lockout (Bad Token)");
                ws.close();
                return;
            }

            if (data.event === "init" || data.event === "update") {
                const scoutData = data.payload;

                // 1. Handle the Session Timer
                if (scoutData.is_playing) {
                    startTime = scoutData.start_time;
                    if (!sessionInterval) sessionInterval = setInterval(updateTimer, 1000);
                } else {
                    // If idle, stop the timer and reset text to zero
                    startTime = 0;
                    clearInterval(sessionInterval);
                    sessionInterval = null;
                    const el = document.getElementById("s"); 
                    if (el) el.innerText = `⏱️ 00:00:00`;
                }
                
                // 2. Treat Idle (Just Chatting) just like a real game to trigger the fade UI
                if (scoutData.game_title !== lastGame) {
                    lastGame = scoutData.game_title;
                    if (widgetFadeTimer) clearTimeout(widgetFadeTimer);
                    
                    // Wake up the widget!
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
                    
                    // Apply the normal fade out timer
                    if (w) resetFadeTimer(w, scoutData.fade_timer);
                }
                
                // 3. Handle manual pulse resets (lights up the widget again)
                if (scoutData.last_pulse > lastKnownPulse) {
                    lastKnownPulse = scoutData.last_pulse;
                    if (widgetFadeTimer) clearTimeout(widgetFadeTimer);
                    if (w) w.style.opacity = "1";
                    if (w) resetFadeTimer(w, scoutData.fade_timer);
                }
            }
        } catch (err) {
            console.error("Failed to parse WebSocket message", err);
        }
    };

    ws.onclose = () => {
        console.log("WebSocket Disconnected. Engine Offline.");
        showOffline("StatusForge Offline");
        lastGame = ""; 
        clearInterval(sessionInterval);
        sessionInterval = null;
        setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => { console.error("WebSocket Error:", error); };
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
