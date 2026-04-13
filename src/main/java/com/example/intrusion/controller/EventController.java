package com.example.intrusion.controller;

import com.example.intrusion.dto.EventPayload;
import com.example.intrusion.service.EventStoreService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/events")
@CrossOrigin
public class EventController {

    private final EventStoreService eventStoreService;

    public EventController(EventStoreService eventStoreService) {
        this.eventStoreService = eventStoreService;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> receiveEvent(@RequestBody EventPayload payload) {
        eventStoreService.save(payload);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "received");
        response.put("snapshot_idx", payload.getSnapshot_idx());
        response.put("n_events_detected", payload.getN_events_detected());
        response.put("has_threat", payload.isHas_threat());

        return ResponseEntity.ok(response);
    }

    @GetMapping("/latest")
    public ResponseEntity<?> getLatestEvent() {
        EventPayload payload = eventStoreService.getLatestPayload();

        if (payload == null) {
            Map<String, Object> empty = new HashMap<>();
            empty.put("status", "empty");
            empty.put("message", "No event payload received yet.");
            empty.put("acknowledged", eventStoreService.isAcknowledged());
            return ResponseEntity.ok(empty);
        }

        Map<String, Object> response = new HashMap<>();
        response.put("status", "ok");
        response.put("acknowledged", eventStoreService.isAcknowledged());
        response.put("data", payload);

        return ResponseEntity.ok(response);
    }

    @PostMapping("/checked")
    public ResponseEntity<Map<String, Object>> markChecked() {
        eventStoreService.clear();

        Map<String, Object> response = new HashMap<>();
        response.put("status", "cleared");
        response.put("message", "Threats acknowledged and cleared.");

        return ResponseEntity.ok(response);
    }
}