import { useEffect, useRef } from "react";
import {
  authApiBaseUrl,
  getStoredAuthSession,
  parseResponsePayload,
} from "../lib/auth";
import {
  isRoleRequestRealtimeApiEvent,
  normalizeRoleRequestRealtimeEvent,
  type RoleRequestRealtimeEvent,
} from "../lib/roleRequests";

type UseRoleRequestStreamOptions = {
  includeAdminEvents?: boolean;
  onEvent: (event: RoleRequestRealtimeEvent) => void;
};

export const useRoleRequestStream = ({
  includeAdminEvents = false,
  onEvent,
}: UseRoleRequestStreamOptions) => {
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof EventSource === "undefined") {
      return undefined;
    }

    const authSession = getStoredAuthSession();
    if (!authSession?.userId) {
      return undefined;
    }

    const streamUrl = new URL(`${authApiBaseUrl}/api/role-requests/stream`);

    if (includeAdminEvents) {
      streamUrl.searchParams.set("adminEvents", "true");
    }

    const eventSource = new EventSource(streamUrl.toString(), {
      withCredentials: true,
    });
    const handleRoleRequestEvent = (streamEvent: MessageEvent<string>) => {
      const payload = parseResponsePayload<unknown>(streamEvent.data);
      if (!isRoleRequestRealtimeApiEvent(payload)) {
        return;
      }

      onEventRef.current(normalizeRoleRequestRealtimeEvent(payload));
    };

    eventSource.addEventListener(
      "role-request",
      handleRoleRequestEvent as EventListener
    );

    return () => {
      eventSource.removeEventListener(
        "role-request",
        handleRoleRequestEvent as EventListener
      );
      eventSource.close();
    };
  }, [includeAdminEvents]);
};
