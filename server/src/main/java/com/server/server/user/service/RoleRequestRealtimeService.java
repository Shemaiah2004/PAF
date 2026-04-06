package com.server.server.user.service;

import com.server.server.user.dto.RoleRequestItemResponse;
import com.server.server.user.dto.RoleRequestRealtimeEventResponse;
import com.server.server.user.dto.RoleRequestRealtimeEventType;
import com.server.server.user.dto.UserTableItemResponse;
import java.io.IOException;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@Service
public class RoleRequestRealtimeService {

    private static final long STREAM_TIMEOUT_MS = TimeUnit.MINUTES.toMillis(30);
    private static final String ROLE_REQUEST_EVENT_NAME = "role-request";

    private final Map<String, CopyOnWriteArrayList<SseEmitter>> userEmitters = new ConcurrentHashMap<>();
    private final CopyOnWriteArrayList<SseEmitter> adminEmitters = new CopyOnWriteArrayList<>();

    public SseEmitter subscribe(String userId, boolean subscribeToAdminEvents) {
        SseEmitter emitter = new SseEmitter(STREAM_TIMEOUT_MS);

        userEmitters.computeIfAbsent(userId, ignored -> new CopyOnWriteArrayList<>()).add(emitter);
        if (subscribeToAdminEvents) {
            adminEmitters.add(emitter);
        }

        emitter.onCompletion(() -> removeEmitter(userId, emitter, subscribeToAdminEvents));
        emitter.onTimeout(() -> {
            removeEmitter(userId, emitter, subscribeToAdminEvents);
            emitter.complete();
        });
        emitter.onError(exception -> {
            removeEmitter(userId, emitter, subscribeToAdminEvents);
            emitter.complete();
        });

        try {
            sendEvent(emitter, "connected", Map.of("status", "connected"));
        } catch (IOException ignored) {
            removeEmitter(userId, emitter, subscribeToAdminEvents);
            emitter.complete();
        }
        return emitter;
    }

    public void publishRequestCreated(String actorUserId, RoleRequestItemResponse request, String message) {
        publishToRequesterAndAdmins(new RoleRequestRealtimeEventResponse(
                RoleRequestRealtimeEventType.CREATED,
                message,
                actorUserId,
                request.id(),
                request,
                null));
    }

    public void publishRequestUpdated(String actorUserId, RoleRequestItemResponse request, String message) {
        publishToRequesterAndAdmins(new RoleRequestRealtimeEventResponse(
                RoleRequestRealtimeEventType.UPDATED,
                message,
                actorUserId,
                request.id(),
                request,
                null));
    }

    public void publishRequestApproved(
            String actorUserId,
            RoleRequestItemResponse request,
            UserTableItemResponse user,
            String message) {
        publishToRequesterAndAdmins(new RoleRequestRealtimeEventResponse(
                RoleRequestRealtimeEventType.APPROVED,
                message,
                actorUserId,
                request.id(),
                request,
                user));
    }

    public void publishRequestRejected(String actorUserId, RoleRequestItemResponse request, String message) {
        publishToRequesterAndAdmins(new RoleRequestRealtimeEventResponse(
                RoleRequestRealtimeEventType.REJECTED,
                message,
                actorUserId,
                request.id(),
                request,
                null));
    }

    public void publishRequestDeleted(String actorUserId, RoleRequestItemResponse request, String message) {
        publishToRequesterAndAdmins(new RoleRequestRealtimeEventResponse(
                RoleRequestRealtimeEventType.DELETED,
                message,
                actorUserId,
                request.id(),
                request,
                null));
    }

    private void publishToRequesterAndAdmins(RoleRequestRealtimeEventResponse event) {
        if (event.request() != null && event.request().requesterUserId() != null) {
            sendToEmitters(userEmitters.get(event.request().requesterUserId()), event);
        }

        sendToEmitters(adminEmitters, event);
    }

    private void sendToEmitters(Iterable<SseEmitter> emitters, RoleRequestRealtimeEventResponse event) {
        if (emitters == null) {
            return;
        }

        for (SseEmitter emitter : emitters) {
            try {
                sendEvent(emitter, ROLE_REQUEST_EVENT_NAME, event);
            } catch (IOException ignored) {
                emitter.complete();
            }
        }
    }

    private void sendEvent(SseEmitter emitter, String eventName, Object payload) throws IOException {
        emitter.send(SseEmitter.event().name(eventName).data(payload));
    }

    private void removeEmitter(String userId, SseEmitter emitter, boolean subscribedToAdminEvents) {
        CopyOnWriteArrayList<SseEmitter> emitters = userEmitters.get(userId);
        if (emitters != null) {
            emitters.remove(emitter);

            if (emitters.isEmpty()) {
                userEmitters.remove(userId, emitters);
            }
        }

        if (subscribedToAdminEvents) {
            adminEmitters.remove(emitter);
        }
    }
}
