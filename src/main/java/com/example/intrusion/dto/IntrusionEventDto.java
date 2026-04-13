package com.example.intrusion.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public class IntrusionEventDto {
    private int event_id;

    @JsonProperty("class")
    private String eventClass;

    private int class_idx;
    private double confidence;
    private int channel_start;
    private int channel_end;
    private int channel_width;
    private boolean is_threat;
    private MeanClassProbsDto mean_class_probs;

    public int getEvent_id() {
        return event_id;
    }

    public void setEvent_id(int event_id) {
        this.event_id = event_id;
    }

    public String getEventClass() {
        return eventClass;
    }

    public void setEventClass(String eventClass) {
        this.eventClass = eventClass;
    }

    public int getClass_idx() {
        return class_idx;
    }

    public void setClass_idx(int class_idx) {
        this.class_idx = class_idx;
    }

    public double getConfidence() {
        return confidence;
    }

    public void setConfidence(double confidence) {
        this.confidence = confidence;
    }

    public int getChannel_start() {
        return channel_start;
    }

    public void setChannel_start(int channel_start) {
        this.channel_start = channel_start;
    }

    public int getChannel_end() {
        return channel_end;
    }

    public void setChannel_end(int channel_end) {
        this.channel_end = channel_end;
    }

    public int getChannel_width() {
        return channel_width;
    }

    public void setChannel_width(int channel_width) {
        this.channel_width = channel_width;
    }

    public boolean isIs_threat() {
        return is_threat;
    }

    public void setIs_threat(boolean is_threat) {
        this.is_threat = is_threat;
    }

    public MeanClassProbsDto getMean_class_probs() {
        return mean_class_probs;
    }

    public void setMean_class_probs(MeanClassProbsDto mean_class_probs) {
        this.mean_class_probs = mean_class_probs;
    }
}