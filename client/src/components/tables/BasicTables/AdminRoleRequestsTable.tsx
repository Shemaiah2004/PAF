import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import Badge from "../../ui/badge/Badge";
import Button from "../../ui/button/Button";
import { Modal } from "../../ui/modal";
import Label from "../../form/Label";
import TextArea from "../../form/input/TextArea";
import LoadingIndicator from "../../common/LoadingIndicator";
import { useNotification } from "../../common/NotificationProvider";
import { CheckLineIcon, CloseIcon } from "../../../icons";
import {
  apiFetch,
  formatRoleLabel,
  getApiMessage,
  getStoredAuthSession,
  parseResponsePayload,
  replaceStoredAuthSession,
} from "../../../lib/auth";
import {
  formatRoleRequestStatus,
  getRequestedRoleBadgeColor,
  getRoleRequestStatusColor,
  isRoleRequestApiItem,
  isRoleRequestMutationApiResponse,
  normalizeRoleRequest,
  sortAdminRoleRequests,
  type RoleRequestApiItem,
  type RoleRequestItem,
  type RoleRequestMutationApiResponse,
  upsertRoleRequest,
} from "../../../lib/roleRequests";
import {
  formatTimestamp,
  getUserInitials,
  normalizeRole,
} from "../../../lib/userRoles";
import { useRoleRequestStream } from "../../../hooks/useRoleRequestStream";

type AdminRoleRequestsTableProps = {
  refreshVersion: number;
  onRequestApproved: () => void;
};

const tableColumnCount = 7;

export default function AdminRoleRequestsTable({
  refreshVersion,
  onRequestApproved,
}: AdminRoleRequestsTableProps) {
  const { showNotification } = useNotification();
  const [requests, setRequests] = useState<RoleRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(
    null
  );
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(
    null
  );
  const [requestToConfirm, setRequestToConfirm] = useState<RoleRequestItem | null>(
    null
  );
  const [requestToReject, setRequestToReject] = useState<RoleRequestItem | null>(
    null
  );
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState("");

  useRoleRequestStream({
    includeAdminEvents: true,
    onEvent: (event) => {
      const currentUserId = getStoredAuthSession()?.userId ?? null;
      const requestId = event.request?.id ?? event.requestId;

      if (!requestId) {
        return;
      }

      if (event.eventType === "DELETED") {
        setRequests((currentRequests) =>
          currentRequests.filter((currentRequest) => currentRequest.id !== requestId)
        );

        if (requestToConfirm?.id === requestId) {
          setRequestToConfirm(null);
        }

        if (requestToReject?.id === requestId) {
          setRequestToReject(null);
          setRejectionReason("");
          setRejectionError("");
        }

        if (event.actorUserId && event.actorUserId !== currentUserId) {
          showNotification({
            variant: "info",
            title: "Request deleted",
            message:
              event.message ||
              "A role request was deleted and removed from the approval list.",
          });
        }

        return;
      }

      const liveRequest = event.request;
      if (!liveRequest) {
        return;
      }

      setRequests((currentRequests) =>
        upsertRoleRequest(currentRequests, liveRequest, sortAdminRoleRequests)
      );

      if (liveRequest.status !== "PENDING") {
        if (requestToConfirm?.id === liveRequest.id) {
          setRequestToConfirm(null);
        }

        if (requestToReject?.id === liveRequest.id) {
          setRequestToReject(null);
          setRejectionReason("");
          setRejectionError("");
        }
      }

      if (!event.actorUserId || event.actorUserId === currentUserId) {
        return;
      }

      switch (event.eventType) {
        case "CREATED":
          showNotification({
            variant: "info",
            title: "New request received",
            message:
              event.message ||
              `${liveRequest.requesterDisplayName} submitted a new role request.`,
          });
          break;
        case "UPDATED":
          showNotification({
            variant: "info",
            title: "Request updated",
            message:
              event.message ||
              `${liveRequest.requesterDisplayName} updated a role request.`,
          });
          break;
        case "APPROVED":
          showNotification({
            variant: "success",
            title: "Request approved",
            message:
              event.message ||
              `${liveRequest.requesterDisplayName}'s request was approved.`,
          });
          break;
        case "REJECTED":
          showNotification({
            variant: "warning",
            title: "Request rejected",
            message:
              event.message ||
              `${liveRequest.requesterDisplayName}'s request was rejected.`,
          });
          break;
        default:
          break;
      }
    },
  });

  useEffect(() => {
    const abortController = new AbortController();

    const loadRequests = async () => {
      const shouldRefreshInPlace = requests.length > 0;

      try {
        if (shouldRefreshInPlace) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }
        setError("");

        const authSession = getStoredAuthSession();
        if (!authSession?.userId) {
          setError("You must be signed in as an admin to review role requests.");
          return;
        }

        const response = await apiFetch("/api/role-requests", {
          signal: abortController.signal,
        });

        const rawResponse = await response.text();
        const payload = parseResponsePayload<
          RoleRequestApiItem[] | { message?: string }
        >(rawResponse);

        if (!response.ok) {
          setError(
            getApiMessage(payload, "Unable to load admin role requests right now.")
          );
          return;
        }

        if (
          !Array.isArray(payload) ||
          !payload.every((item) => isRoleRequestApiItem(item))
        ) {
          setError("The server returned an invalid admin requests response.");
          return;
        }

        setRequests(sortAdminRoleRequests(payload.map(normalizeRoleRequest)));
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setError("Cannot reach the server to load admin role requests.");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    };

    void loadRequests();

    return () => {
      abortController.abort();
    };
  }, [refreshVersion]);

  const handleOpenApproveModal = (roleRequest: RoleRequestItem) => {
    if (
      roleRequest.status !== "PENDING" ||
      approvingRequestId ||
      rejectingRequestId
    ) {
      return;
    }

    setRequestToReject(null);
    setRejectionReason("");
    setRejectionError("");
    setRequestToConfirm(roleRequest);
  };

  const handleCloseApproveModal = () => {
    if (approvingRequestId) {
      return;
    }

    setRequestToConfirm(null);
  };

  const handleOpenRejectModal = (roleRequest: RoleRequestItem) => {
    if (
      roleRequest.status !== "PENDING" ||
      approvingRequestId ||
      rejectingRequestId
    ) {
      return;
    }

    setRequestToConfirm(null);
    setRequestToReject(roleRequest);
    setRejectionReason("");
    setRejectionError("");
  };

  const handleCloseRejectModal = () => {
    if (rejectingRequestId) {
      return;
    }

    setRequestToReject(null);
    setRejectionReason("");
    setRejectionError("");
  };

  const handleApproveRequest = async (roleRequest: RoleRequestItem) => {
    const authSession = getStoredAuthSession();
    if (!authSession?.userId) {
      showNotification({
        variant: "error",
        title: "Approval failed",
        message: "You must be signed in as an admin to approve requests.",
      });
      setRequestToConfirm(null);
      return;
    }

    setApprovingRequestId(roleRequest.id);

    try {
      const response = await apiFetch(
        `/api/role-requests/${roleRequest.id}/approve`,
        {
          method: "PATCH",
        }
      );

      const rawResponse = await response.text();
      const payload = parseResponsePayload<
        RoleRequestMutationApiResponse | { message?: string }
      >(rawResponse);

      if (!response.ok) {
        showNotification({
          variant: "error",
          title: "Approval failed",
          message: getApiMessage(
            payload,
            "Unable to approve this role request right now."
          ),
        });
        setApprovingRequestId(null);
        return;
      }

      if (!isRoleRequestMutationApiResponse(payload)) {
        showNotification({
          variant: "error",
          title: "Approval failed",
          message: "The server returned an invalid approval response.",
        });
        setApprovingRequestId(null);
        return;
      }

      const updatedRequest = normalizeRoleRequest(payload.request);
      setRequests((currentRequests) =>
        upsertRoleRequest(currentRequests, updatedRequest, sortAdminRoleRequests)
      );
      setRequestToConfirm(null);

      if (payload.user?.id === authSession.userId) {
        replaceStoredAuthSession({
          ...authSession,
          role: normalizeRole(payload.user.role),
        });
      }

      onRequestApproved();
      showNotification({
        variant: "success",
        title: "Request approved",
        message: getApiMessage(
          payload,
          `The ${formatRoleLabel(updatedRequest.requestedRole)} role was approved.`
        ),
      });
    } catch {
      showNotification({
        variant: "error",
        title: "Approval failed",
        message: "Cannot reach the server to approve the role request.",
      });
    } finally {
      setApprovingRequestId(null);
    }
  };

  const handleRejectRequest = async (roleRequest: RoleRequestItem) => {
    const trimmedRejectionReason = rejectionReason.trim();
    if (!trimmedRejectionReason) {
      setRejectionError("Please tell the requester why this role request was rejected.");
      return;
    }

    const authSession = getStoredAuthSession();
    if (!authSession?.userId) {
      showNotification({
        variant: "error",
        title: "Rejection failed",
        message: "You must be signed in as an admin to reject requests.",
      });
      setRequestToReject(null);
      return;
    }

    setRejectingRequestId(roleRequest.id);
    setRejectionError("");

    try {
      const response = await apiFetch(
        `/api/role-requests/${roleRequest.id}/reject`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            rejectionReason: trimmedRejectionReason,
          }),
        }
      );

      const rawResponse = await response.text();
      const payload = parseResponsePayload<
        RoleRequestMutationApiResponse | { message?: string }
      >(rawResponse);

      if (!response.ok) {
        const message = getApiMessage(
          payload,
          "Unable to reject this role request right now."
        );
        setRejectionError(message);
        showNotification({
          variant: "error",
          title: "Rejection failed",
          message,
        });
        setRejectingRequestId(null);
        return;
      }

      if (!isRoleRequestMutationApiResponse(payload)) {
        const message = "The server returned an invalid rejection response.";
        setRejectionError(message);
        showNotification({
          variant: "error",
          title: "Rejection failed",
          message,
        });
        setRejectingRequestId(null);
        return;
      }

      const updatedRequest = normalizeRoleRequest(payload.request);
      setRequests((currentRequests) =>
        upsertRoleRequest(currentRequests, updatedRequest, sortAdminRoleRequests)
      );
      setRequestToReject(null);
      setRejectionReason("");
      setRejectionError("");
      showNotification({
        variant: "success",
        title: "Request rejected",
        message: getApiMessage(
          payload,
          `The request for ${formatRoleLabel(updatedRequest.requestedRole)} was rejected.`
        ),
      });
    } catch {
      showNotification({
        variant: "error",
        title: "Rejection failed",
        message: "Cannot reach the server to reject the role request.",
      });
    } finally {
      setRejectingRequestId(null);
    }
  };

  return (
    <div className="space-y-4">
      {isRefreshing ? (
        <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3 dark:border-brand-500/20 dark:bg-brand-500/10">
          <LoadingIndicator
            size="sm"
            label="Refreshing approval requests"
            description="Loading the latest approval request updates."
          />
        </div>
      ) : null}

      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[1040px]">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <TableCell
                  isHeader
                  className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Requester
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Current Role
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Requested Role
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Description
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Status
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Submitted
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400"
                >
                  Action
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={tableColumnCount} className="px-5 py-10">
                    <LoadingIndicator
                      layout="stacked"
                      size="md"
                      label="Loading approval requests"
                      description="Please wait while all submitted role requests are fetched."
                      className="mx-auto"
                    />
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading && error ? (
                <TableRow>
                  <TableCell
                    colSpan={tableColumnCount}
                    className="px-5 py-6 text-center text-theme-sm text-error-600 dark:text-error-400"
                  >
                    {error}
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading && !error && requests.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={tableColumnCount}
                    className="px-5 py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400"
                  >
                    No role requests have been submitted yet.
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading &&
                !error &&
                requests.map((roleRequest) => {
                  const isApproving = approvingRequestId === roleRequest.id;
                  const isRejecting = rejectingRequestId === roleRequest.id;
                  const isPending = roleRequest.status === "PENDING";
                  const isApproved = roleRequest.status === "APPROVED";
                  const isRejected = roleRequest.status === "REJECTED";

                  return (
                    <TableRow key={roleRequest.id}>
                      <TableCell className="px-5 py-4 text-start">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 text-theme-sm font-semibold text-brand-500 dark:bg-brand-500/20 dark:text-brand-400">
                            {getUserInitials(
                              roleRequest.requesterDisplayName,
                              roleRequest.requesterEmail
                            )}
                          </div>
                          <div>
                            <span className="block text-theme-sm font-medium text-gray-800 dark:text-white/90">
                              {roleRequest.requesterDisplayName}
                            </span>
                            <span className="block text-theme-xs text-gray-500 dark:text-gray-400">
                              {roleRequest.requesterEmail}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        {formatRoleLabel(roleRequest.currentRole)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        <Badge
                          size="sm"
                          variant="solid"
                          color={getRequestedRoleBadgeColor(roleRequest.requestedRole)}
                        >
                          {formatRoleLabel(roleRequest.requestedRole)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        <div className="max-w-xl space-y-3">
                          <div className="whitespace-pre-wrap">
                            {roleRequest.description || "No description provided."}
                          </div>
                          {roleRequest.rejectionReason ? (
                            <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-3 text-xs text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
                              <span className="font-semibold">
                                Reason shared with requester:
                              </span>{" "}
                              <span className="whitespace-pre-wrap">
                                {roleRequest.rejectionReason}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        <Badge
                          size="sm"
                          variant="light"
                          color={getRoleRequestStatusColor(roleRequest.status)}
                        >
                          {formatRoleRequestStatus(roleRequest.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        {formatTimestamp(roleRequest.createdAt)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant={isApproved ? "outline" : "primary"}
                            onClick={() => handleOpenApproveModal(roleRequest)}
                            disabled={!isPending || isApproving || isRejecting}
                            startIcon={
                              isApproving ? (
                                <LoadingIndicator size="sm" tone="inverse" />
                              ) : !isApproved ? (
                                <CheckLineIcon className="h-4 w-4" />
                              ) : undefined
                            }
                            className="whitespace-nowrap"
                          >
                            {isApproving
                              ? "Approving"
                              : isApproved
                              ? "Approved"
                              : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleOpenRejectModal(roleRequest)}
                            disabled={!isPending || isApproving || isRejecting}
                            startIcon={
                              isRejecting ? (
                                <LoadingIndicator size="sm" tone="inverse" />
                              ) : (
                                <CloseIcon className="h-4 w-4" />
                              )
                            }
                            className="whitespace-nowrap"
                          >
                            {isRejecting
                              ? "Rejecting"
                              : isRejected
                              ? "Rejected"
                              : "Reject"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </div>
      <Modal
        isOpen={Boolean(requestToConfirm)}
        onClose={handleCloseApproveModal}
        className="m-4 max-w-[520px]"
      >
        <div className="px-6 py-7 sm:px-8">
          <div className="mb-5">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Approve Role Request
            </h3>
            {requestToConfirm ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Are you sure you want to approve{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {requestToConfirm.requesterDisplayName}
                </span>
                {"'s"} request for{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {formatRoleLabel(requestToConfirm.requestedRole)}
                </span>
                ?
              </p>
            ) : null}
          </div>

          {requestToConfirm ? (
            <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900/50">
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                <p>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Current role:
                  </span>{" "}
                  {formatRoleLabel(requestToConfirm.currentRole)}
                </p>
                <p>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Requested role:
                  </span>{" "}
                  {formatRoleLabel(requestToConfirm.requestedRole)}
                </p>
                <p className="whitespace-pre-wrap">
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    Reason:
                  </span>{" "}
                  {requestToConfirm.description || "No description provided."}
                </p>
              </div>
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCloseApproveModal}
              disabled={Boolean(approvingRequestId)}
            >
              No, Leave It
            </Button>
            <Button
              size="sm"
              onClick={() =>
                requestToConfirm
                  ? handleApproveRequest(requestToConfirm)
                  : undefined
              }
              disabled={!requestToConfirm || Boolean(approvingRequestId)}
              startIcon={
                approvingRequestId ? (
                  <LoadingIndicator size="sm" tone="inverse" />
                ) : (
                  <CheckLineIcon className="h-4 w-4" />
                )
              }
            >
              {approvingRequestId ? "Approving" : "Yes, Approve It"}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={Boolean(requestToReject)}
        onClose={handleCloseRejectModal}
        className="m-4 max-w-[520px]"
      >
        <div className="px-6 py-7 sm:px-8">
          <div className="mb-5">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Reject Role Request
            </h3>
            {requestToReject ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Send a short note explaining why{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {requestToReject.requesterDisplayName}
                </span>
                {"'s"} request for{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {formatRoleLabel(requestToReject.requestedRole)}
                </span>
                was rejected. This message will be shown to the requester.
              </p>
            ) : null}
          </div>

          <div>
            <Label htmlFor="rejection-reason" className="mb-2">
              Reason shown to requester
            </Label>
            <TextArea
              rows={5}
              value={rejectionReason}
              onChange={setRejectionReason}
              placeholder="Example: Please add a bit more detail about the work that requires this access."
              error={Boolean(rejectionError)}
            />
          </div>

          {rejectionError ? (
            <div className="mt-5 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
              {rejectionError}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCloseRejectModal}
              disabled={Boolean(rejectingRequestId)}
            >
              No, Leave It
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() =>
                requestToReject
                  ? handleRejectRequest(requestToReject)
                  : undefined
              }
              disabled={!requestToReject || Boolean(rejectingRequestId)}
              startIcon={
                rejectingRequestId ? (
                  <LoadingIndicator size="sm" tone="inverse" />
                ) : (
                  <CloseIcon className="h-4 w-4" />
                )
              }
            >
              {rejectingRequestId ? "Rejecting" : "Send Rejection"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
