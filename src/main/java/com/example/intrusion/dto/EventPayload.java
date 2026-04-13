package com.example.intrusion.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;

public class EventPayload {
    private int snapshot_idx;
    private String timestamp;
    private int n_events_detected;
    private boolean has_threat;
    private List<IntrusionEventDto> events;
    private Map<String, Object> pipeline_meta;

    public int getSnapshot_idx() {
        return snapshot_idx;
    }

    public void setSnapshot_idx(int snapshot_idx) {
        this.snapshot_idx = snapshot_idx;
    }

    public String getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(String timestamp) {
        this.timestamp = timestamp;
    }

    public int getN_events_detected() {
        return n_events_detected;
    }

    public void setN_events_detected(int n_events_detected) {
        this.n_events_detected = n_events_detected;
    }

    public boolean isHas_threat() {
        return has_threat;
    }

    public void setHas_threat(boolean has_threat) {
        this.has_threat = has_threat;
    }

    public List<IntrusionEventDto> getEvents() {
        return events;
    }

    public void setEvents(List<IntrusionEventDto> events) {
        this.events = events;
    }

    public Map<String, Object> getPipeline_meta() {
        return pipeline_meta;
    }

    public void setPipeline_meta(Map<String, Object> pipeline_meta) {
        this.pipeline_meta = pipeline_meta;
    }

    @JsonProperty("events")
    public void mapEventClassField(List<IntrusionEventDto> events) {
        if (events != null) {
            for (IntrusionEventDto event : events) {
                // no-op, normal binding
            }
        }
        this.events = events;
    }
}