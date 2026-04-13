const CHANNEL_COUNT = 1600;
const POLL_INTERVAL_MS = 4000;

// NJUPT Xianlin Campus approximate center
const MAP_CENTER = [32.11534, 118.92501];

// Approximate demo perimeter around campus.
// Replace this later with exact campus GeoJSON / exact perimeter coordinates.
const DEMO_PERIMETER = [
    [32.119864, 118.919406],
    [32.123901, 118.927817],
    [32.119784, 118.930360],
    [32.118156, 118.930596],
    [32.116375, 118.930183],
    [32.113528, 118.929266],
    [32.111879, 118.929260],
    [32.111017, 118.929545],
    [32.110190, 118.930027],
    [32.109208, 118.930639],
    [32.106821, 118.922984],
    [32.112828, 118.923161],
    [32.114137, 118.922775],
    [32.116765, 118.921219],
];

const MOCK_PAYLOAD = {
    status: "ok",
    acknowledged: false,
    data: {
        snapshot_idx: 12,
        timestamp: "2026-04-13T08:15:00Z",
        n_events_detected: 3,
        has_threat: true,
        events: [
            {
                event_id: 0,
                class: "fence",
                class_idx: 1,
                confidence: 0.91,
                channel_start: 110,
                channel_end: 220,
                channel_width: 110,
                is_threat: true,
                mean_class_probs: {
                    no_threat: 0.05,
                    fence: 0.90,
                    manipulation: 0.05
                }
            },
            {
                event_id: 1,
                class: "manipulation",
                class_idx: 2,
                confidence: 0.87,
                channel_start: 720,
                channel_end: 810,
                channel_width: 90,
                is_threat: true,
                mean_class_probs: {
                    no_threat: 0.08,
                    fence: 0.07,
                    manipulation: 0.85
                }
            },
            {
                event_id: 2,
                class: "fence",
                class_idx: 1,
                confidence: 0.94,
                channel_start: 1300,
                channel_end: 1385,
                channel_width: 85,
                is_threat: true,
                mean_class_probs: {
                    no_threat: 0.03,
                    fence: 0.92,
                    manipulation: 0.05
                }
            }
        ]
    }
};

let map;
let perimeterPolyline;
let zoneMarkers = [];
let activeThreatLayers = [];
let perimeterChannelPoints = [];
let useBackend = true;
let currentPayload = null;

function getColorByClass(eventClass) {
    if (eventClass === "fence") return "#ef4444";
    if (eventClass === "manipulation") return "#f59e0b";
    return "#22c55e";
}

function initMap() {
    map = L.map("map", {
        zoomControl: true
    }).setView(MAP_CENTER, 16);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    perimeterPolyline = L.polygon(DEMO_PERIMETER, {
        color: "#60a5fa",
        weight: 3,
        fillOpacity: 0.05
    }).addTo(map);

    map.fitBounds(perimeterPolyline.getBounds(), { padding: [30, 30] });

    perimeterChannelPoints = interpolatePerimeter(DEMO_PERIMETER, CHANNEL_COUNT);
    addZoneLabels();
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

function clearThreatLayers() {
    activeThreatLayers.forEach(layer => map.removeLayer(layer));
    activeThreatLayers = [];
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
            opacity: 0.95
        }).addTo(map);

        polyline.bindPopup(`
      <b>${event.class.toUpperCase()}</b><br/>
      Event ID: ${event.event_id}<br/>
      Channels: ${event.channel_start} - ${event.channel_end}<br/>
      Confidence: ${(event.confidence * 100).toFixed(1)}%
    `);

        activeThreatLayers.push(polyline);
    });
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

function updateSidebar(payloadWrapper) {
    const snapshotValue = document.getElementById("snapshotValue");
    const timestampValue = document.getElementById("timestampValue");
    const threatValue = document.getElementById("threatValue");
    const eventsContainer = document.getElementById("eventsContainer");
    const modeValue = document.getElementById("modeValue");

    modeValue.textContent = useBackend ? "Live API" : "Mock UI";

    if (!payloadWrapper || payloadWrapper.status !== "ok" || !payloadWrapper.data) {
        snapshotValue.textContent = "-";
        timestampValue.textContent = "-";
        threatValue.textContent = "No Data";
        threatValue.className = "value badge neutral";
        eventsContainer.innerHTML = `<div class="empty-state">No active events.</div>`;
        clearThreatLayers();
        return;
    }

    const payload = payloadWrapper.data;
    snapshotValue.textContent = payload.snapshot_idx;
    timestampValue.textContent = payload.timestamp;

    if (payload.has_threat) {
        threatValue.textContent = "Threat Active";
        threatValue.className = "value badge danger";
    } else {
        threatValue.textContent = "No Threat";
        threatValue.className = "value badge safe";
    }

    const events = (payload.events || []).filter(e => e.is_threat);

    if (!events.length) {
        eventsContainer.innerHTML = `<div class="empty-state">No active threat events.</div>`;
    } else {
        eventsContainer.innerHTML = events.map(event => `
      <div class="event-card ${event.class}">
        <div class="event-title">${event.class.toUpperCase()} · Event ${event.event_id}</div>
        <div class="event-meta">
          Channel range: ${event.channel_start} - ${event.channel_end}<br/>
          Width: ${event.channel_width}<br/>
          Confidence: ${(event.confidence * 100).toFixed(1)}%<br/>
          Threat: ${event.is_threat ? "Yes" : "No"}
        </div>
      </div>
    `).join("");
    }

    drawThreatSegments(events);
}

async function fetchLatestData() {
    if (!useBackend) {
        currentPayload = MOCK_PAYLOAD;
        updateSidebar(currentPayload);
        return;
    }

    try {
        const response = await fetch("/api/events/latest");
        const data = await response.json();
        currentPayload = data;
        updateSidebar(data);
    } catch (error) {
        console.error("Failed to load latest data:", error);
    }
}

async function markChecked() {
    if (!useBackend) {
        currentPayload = null;
        updateSidebar(null);
        return;
    }

    try {
        await fetch("/api/events/checked", {
            method: "POST"
        });
        currentPayload = null;
        updateSidebar(null);
    } catch (error) {
        console.error("Failed to clear events:", error);
    }
}

function wireButtons() {
    document.getElementById("checkedBtn").addEventListener("click", markChecked);

    document.getElementById("reloadMockBtn").addEventListener("click", () => {
        useBackend = false;
        fetchLatestData();
    });
}

function startPolling() {
    fetchLatestData();
    setInterval(fetchLatestData, POLL_INTERVAL_MS);
}

window.addEventListener("DOMContentLoaded", () => {
    initMap();
    wireButtons();
    startPolling();
});