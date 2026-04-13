package com.example.intrusion.service;

import com.example.intrusion.dto.EventPayload;
import org.springframework.stereotype.Service;

@Service
public class EventStoreService {

    private EventPayload latestPayload;
    private boolean acknowledged = false;

    public synchronized void save(EventPayload payload) {
        this.latestPayload = payload;
        this.acknowledged = false;
    }

    public synchronized EventPayload getLatestPayload() {
        return latestPayload;
    }

    public synchronized boolean isAcknowledged() {
        return acknowledged;
    }

    public synchronized void markChecked() {
        this.acknowledged = true;
    }

    public synchronized void clear() {
        this.latestPayload = null;
        this.acknowledged = true;
    }
}