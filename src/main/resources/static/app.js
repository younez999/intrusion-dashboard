const CHANNEL_COUNT = 1600;
const POLL_INTERVAL_MS = 4000;

const ZOOM_IN_DURATION_MS = 1200;
const HOLD_DURATION_MS = 900;
const ZOOM_OUT_DURATION_MS = 1000;
const BETWEEN_EVENTS_MS = 200;

const MAP_CENTER = [32.1165, 118.9260];

const DEMO_PERIMETER = [
    [32.119846, 118.919390],
    [32.122692, 118.925006],
    [32.123865, 118.927850],
    [32.119855, 118.930328],
    [32.119433, 118.930521],
    [32.118274, 118.930650],
    [32.117306, 118.930467],
    [32.113418, 118.929255],
    [32.112470, 118.929239],
    [32.111438, 118.929416],
    [32.110379, 118.929958],
    [32.109197, 118.930671],
    [32.106788, 118.922989],
    [32.112825, 118.923166],
    [32.114057, 118.922812]
];

const MOCK_SCENARIOS = [
    {
        status: "ok",
        acknowledged: false,
        data: {
            snapshot_idx: 12,
            timestamp: "2026-04-13T08:15:00Z",
            n_events_detected: 3,
            has_threat: true,
            events: [
                { event_id: 0, class: "fence", class_idx: 1, confidence: 0.91, channel_start: 110, channel_end: 220, channel_width: 110, is_threat: true },
                { event_id: 1, class: "manipulation", class_idx: 2, confidence: 0.87, channel_start: 720, channel_end: 810, channel_width: 90, is_threat: true },
                { event_id: 2, class: "fence", class_idx: 1, confidence: 0.94, channel_start: 1300, channel_end: 1385, channel_width: 85, is_threat: true }
            ]
        }
    },
    {
        status: "ok",
        acknowledged: false,
        data: {
            snapshot_idx: 13,
            timestamp: "2026-04-13T08:17:30Z",
            n_events_detected: 2,
            has_threat: true,
            events: [
                { event_id: 0, class: "fence", class_idx: 1, confidence: 0.89, channel_start: 260, channel_end: 340, channel_width: 80, is_threat: true },
                { event_id: 1, class: "no_threat", class_idx: 0, confidence: 0.95, channel_start: 980, channel_end: 1020, channel_width: 40, is_threat: false }
            ]
        }
    },
    {
        status: "ok",
        acknowledged: false,
        data: {
            snapshot_idx: 14,
            timestamp: "2026-04-13T08:20:10Z",
            n_events_detected: 3,
            has_threat: true,
            events: [
                { event_id: 0, class: "manipulation", class_idx: 2, confidence: 0.84, channel_start: 560, channel_end: 640, channel_width: 80, is_threat: true },
                { event_id: 1, class: "fence", class_idx: 1, confidence: 0.92, channel_start: 1130, channel_end: 1215, channel_width: 85, is_threat: true },
                { event_id: 2, class: "no_threat", class_idx: 0, confidence: 0.97, channel_start: 1450, channel_end: 1480, channel_width: 30, is_threat: false }
            ]
        }
    },
    {
        status: "ok",
        acknowledged: false,
        data: {
            snapshot_idx: 15,
            timestamp: "2026-04-13T08:24:45Z",
            n_events_detected: 1,
            has_threat: false,
            events: [
                { event_id: 0, class: "no_threat", class_idx: 0, confidence: 0.98, channel_start: 400, channel_end: 430, channel_width: 30, is_threat: false }
            ]
        }
    }
];

let map;
let perimeterPolygon;
let zoneMarkers = [];
let activeThreatLayers = [];
let perimeterChannelPoints = [];
let currentPayload = null;
let useBackend = false;
let pollTimer = null;
let focusLoopRunning = false;
let focusLoopToken = 0;
let mockScenarioIndex = 0;
let activityFeed = [];

function getColorByClass(eventClass) {
    if (eventClass === "fence") return "#ef4444";
    if (eventClass === "manipulation") return "#f59e0b";
    return "#22c55e";
}

function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function initMap() {
    map = L.map("map", {
        zoomControl: true
    }).setView(MAP_CENTER, 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    perimeterPolygon = L.polygon(DEMO_PERIMETER, {
        color: "#60a5fa",
        weight: 3,
        fillOpacity: 0.04
    }).addTo(map);

    map.fitBounds(perimeterPolygon.getBounds(), { padding: [30, 30] });

    perimeterChannelPoints = interpolatePerimeter(DEMO_PERIMETER, CHANNEL_COUNT);
    addZoneLabels();
}

function interpolatePerimeter(latlngs, pointCount) {
    const closed = [...latlngs, latlngs[0]];
    const lengths = [];
    let totalLength = 0;

    for (let i = 0; i < closed.length - 1; i++) {
        const a = closed[i];
        const b = closed[i + 1];
        const segmentLength = Math.sqrt(
            Math.pow(b[0] - a[0], 2) + Math.pow(b[1] - a[1], 2)
        );
        lengths.push(segmentLength);
        totalLength += segmentLength;
    }

    const result = [];
    for (let i = 0; i < pointCount; i++) {
        const target = (i / pointCount) * totalLength;
        let accumulated = 0;

        for (let s = 0; s < lengths.length; s++) {
            const segLen = lengths[s];
            if (accumulated + segLen >= target) {
                const ratio = (target - accumulated) / segLen;
                const start = closed[s];
                const end = closed[s + 1];

                result.push([
                    start[0] + ratio * (end[0] - start[0]),
                    start[1] + ratio * (end[1] - start[1])
                ]);
                break;
            }
            accumulated += segLen;
        }
    }

    return result;
}

function addZoneLabels() {
    zoneMarkers.forEach(marker => map.removeLayer(marker));
    zoneMarkers = [];

    const zoneIndexes = [
        { name: "North", idx: 0 },
        { name: "East", idx: Math.floor(CHANNEL_COUNT * 0.25) },
        { name: "South", idx: Math.floor(CHANNEL_COUNT * 0.50) },
        { name: "West", idx: Math.floor(CHANNEL_COUNT * 0.75) }
    ];

    zoneIndexes.forEach(zone => {
        const point = perimeterChannelPoints[zone.idx];
        const marker = L.marker(point, {
            icon: L.divIcon({
                className: "zone-label",
                html: zone.name
            })
        }).addTo(map);
        zoneMarkers.push(marker);
    });
}

function clearThreatLayers() {
    activeThreatLayers.forEach(item => map.removeLayer(item.layer));
    activeThreatLayers = [];
}

function buildChannelSegment(start, end) {
    const safeStart = Math.max(0, Math.min(CHANNEL_COUNT - 1, start));
    const safeEnd = Math.max(0, Math.min(CHANNEL_COUNT - 1, end));
    const points = [];

    if (safeStart <= safeEnd) {
        for (let i = safeStart; i <= safeEnd; i++) {
            points.push(perimeterChannelPoints[i]);
        }
    } else {
        for (let i = safeStart; i < CHANNEL_COUNT; i++) {
            points.push(perimeterChannelPoints[i]);
        }
        for (let i = 0; i <= safeEnd; i++) {
            points.push(perimeterChannelPoints[i]);
        }
    }

    return points;
}

function setAlertMode(isActive) {
    const banner = document.getElementById("alertBanner");
    document.body.classList.toggle("alert-mode", isActive);
    banner.classList.toggle("hidden", !isActive);

    if (!isActive) {
        stopThreatFocusLoop();
        map.flyToBounds(perimeterPolygon.getBounds(), {
            padding: [30, 30],
            duration: 1.5
        });
    }
}

function zoomToLayer(layer) {
    map.flyToBounds(layer.getBounds(), {
        padding: [140, 140],
        maxZoom: 17,
        duration: ZOOM_IN_DURATION_MS / 1000,
        easeLinearity: 0.15
    });
}

function zoomOutToPerimeter() {
    map.flyToBounds(perimeterPolygon.getBounds(), {
        padding: [60, 60],
        maxZoom: 16,
        duration: ZOOM_OUT_DURATION_MS / 1000,
        easeLinearity: 0.1
    });
}

async function startThreatFocusLoop() {
    stopThreatFocusLoop();

    const token = ++focusLoopToken;
    const zoomableLayers = activeThreatLayers.filter(
        item => item.event.class === "fence" || item.event.class === "manipulation"
    );

    if (!zoomableLayers.length) return;

    focusLoopRunning = true;

    while (focusLoopRunning && token === focusLoopToken) {
        for (const item of zoomableLayers) {
            if (!focusLoopRunning || token !== focusLoopToken) return;

            zoomToLayer(item.layer);
            await wait(ZOOM_IN_DURATION_MS + HOLD_DURATION_MS);

            if (!focusLoopRunning || token !== focusLoopToken) return;

            zoomOutToPerimeter();
            await wait(ZOOM_OUT_DURATION_MS + BETWEEN_EVENTS_MS);
        }
    }
}

function stopThreatFocusLoop() {
    focusLoopRunning = false;
    focusLoopToken += 1;
}

function drawThreatSegments(events) {
    clearThreatLayers();

    if (!events || !events.length) return;

    events.forEach(event => {
        const points = buildChannelSegment(event.channel_start, event.channel_end);
        const color = getColorByClass(event.class);

        const polyline = L.polyline(points, {
            color,
            weight: 8,
            opacity: 0.95,
            className: "pulse-threat"
        }).addTo(map);

        polyline.bindPopup(`
      <b>${event.class.toUpperCase()}</b><br/>
      Event ID: ${event.event_id}<br/>
      Channels: ${event.channel_start} - ${event.channel_end}<br/>
      Confidence: ${(event.confidence * 100).toFixed(1)}%
    `);

        activeThreatLayers.push({ layer: polyline, event });
    });

    startThreatFocusLoop();
}

function setModeBadge() {
    const modeValue = document.getElementById("modeValue");

    if (useBackend) {
        modeValue.textContent = "Live API";
        modeValue.className = "value badge live";
    } else {
        modeValue.textContent = "Mock UI";
        modeValue.className = "value badge mock";
    }
}

function formatFeedMessage(event, timestamp) {
    const kind = event.is_threat ? event.class.toUpperCase() : "NO THREAT";
    return {
        time: timestamp || new Date().toISOString(),
        className: event.class || "no_threat",
        text: `${kind} detected at channels ${event.channel_start}-${event.channel_end} with ${(event.confidence * 100).toFixed(1)}% confidence.`
    };
}

function prependFeedItemsFromPayload(payload) {
    if (!payload || !payload.events) return;

    const newItems = payload.events.map(ev => formatFeedMessage(ev, payload.timestamp));
    activityFeed = [...newItems.reverse(), ...activityFeed].slice(0, 12);
    renderFeed();
}

function renderFeed() {
    const container = document.getElementById("liveFeedContainer");

    if (!activityFeed.length) {
        container.innerHTML = `<div class="feed-empty">No activity yet.</div>`;
        return;
    }

    container.innerHTML = activityFeed.map(item => `
    <div class="feed-item ${item.className}">
      <div class="feed-time">${item.time}</div>
      <div class="feed-text">${item.text}</div>
    </div>
  `).join("");
}

function clearSidebarData() {
    document.getElementById("snapshotValue").textContent = "-";
    document.getElementById("timestampValue").textContent = "-";
    document.getElementById("eventsCountValue").textContent = "0";

    const threatValue = document.getElementById("threatValue");
    threatValue.textContent = "No Data";
    threatValue.className = "value badge neutral";

    document.getElementById("eventsContainer").innerHTML =
        `<div class="empty-state">No active events.</div>`;

    clearThreatLayers();
    setAlertMode(false);
}

function updateSidebar(payloadWrapper) {
    setModeBadge();

    if (!payloadWrapper || payloadWrapper.status !== "ok" || !payloadWrapper.data) {
        clearSidebarData();
        return;
    }

    const payload = payloadWrapper.data;
    const threatEvents = (payload.events || []).filter(
        e => e.is_threat && (e.class === "fence" || e.class === "manipulation")
    );

    document.getElementById("snapshotValue").textContent = payload.snapshot_idx ?? "-";
    document.getElementById("timestampValue").textContent = payload.timestamp ?? "-";
    document.getElementById("eventsCountValue").textContent = String(threatEvents.length);

    const threatValue = document.getElementById("threatValue");
    if (payload.has_threat && threatEvents.length > 0) {
        threatValue.textContent = "Threat Active";
        threatValue.className = "value badge danger";
        setAlertMode(true);
    } else {
        threatValue.textContent = "No Threat";
        threatValue.className = "value badge safe";
        setAlertMode(false);
    }

    const eventsContainer = document.getElementById("eventsContainer");
    if (!threatEvents.length) {
        eventsContainer.innerHTML = `<div class="empty-state">No active threat events.</div>`;
    } else {
        eventsContainer.innerHTML = threatEvents.map(event => `
      <div class="event-card ${event.class}">
        <div class="event-title">${event.class.toUpperCase()} · Event ${event.event_id}</div>
        <div class="event-meta">
          Channel range: ${event.channel_start} - ${event.channel_end}<br/>
          Width: ${event.channel_width}<br/>
          Confidence: ${(event.confidence * 100).toFixed(1)}%<br/>
          Class index: ${event.class_idx}
        </div>
      </div>
    `).join("");
    }

    drawThreatSegments(threatEvents);
}

async function fetchMockData() {
    const payload = structuredClone(MOCK_SCENARIOS[mockScenarioIndex]);
    mockScenarioIndex = (mockScenarioIndex + 1) % MOCK_SCENARIOS.length;
    currentPayload = payload;
    prependFeedItemsFromPayload(payload.data);
    updateSidebar(payload);
}

async function fetchLiveData() {
    try {
        const response = await fetch("/api/events/latest");
        const data = await response.json();
        currentPayload = data;
        if (data && data.status === "ok" && data.data) {
            prependFeedItemsFromPayload(data.data);
        }
        updateSidebar(data);
    } catch (error) {
        console.error("Failed to load live data:", error);
        clearSidebarData();
    }
}

async function fetchCurrentSource() {
    if (useBackend) {
        await fetchLiveData();
    } else {
        await fetchMockData();
    }
}

async function markChecked() {
    if (useBackend) {
        try {
            await fetch("/api/events/checked", { method: "POST" });
            currentPayload = null;
            clearSidebarData();
        } catch (error) {
            console.error("Failed to clear live events:", error);
        }
    } else {
        currentPayload = null;
        clearSidebarData();
    }
}

function startPolling() {
    stopPolling();

    pollTimer = setInterval(async () => {
        if (useBackend) {
            await fetchLiveData();
        }
    }, POLL_INTERVAL_MS);
}

function stopPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function handleModeSwitch() {
    const switchEl = document.getElementById("dataModeSwitch");
    useBackend = switchEl.checked;

    localStorage.setItem("intrusionDataMode", useBackend ? "live" : "mock");

    setModeBadge();
    clearSidebarData();
    fetchCurrentSource();
    startPolling();
}

function wireButtons() {
    document.getElementById("checkedBtn").addEventListener("click", markChecked);

    document.getElementById("reloadBtn").addEventListener("click", () => {
        fetchCurrentSource();
    });

    document.getElementById("openPerimeterToolBtn").addEventListener("click", () => {
        window.open("/perimeter-tool.html", "_blank");
    });

    document.getElementById("dataModeSwitch").addEventListener("change", handleModeSwitch);
}

window.addEventListener("DOMContentLoaded", async () => {
    const savedMode = localStorage.getItem("intrusionDataMode");
    useBackend = savedMode === "live";

    initMap();
    wireButtons();
    renderFeed();

    const switchEl = document.getElementById("dataModeSwitch");
    switchEl.checked = useBackend;

    setModeBadge();
    await fetchCurrentSource();
    startPolling();
});