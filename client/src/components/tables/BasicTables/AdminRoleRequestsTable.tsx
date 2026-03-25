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
import LoadingIndicator from "../../common/LoadingIndicator";
import { useNotification } from "../../common/NotificationProvider";
import { CheckLineIcon, TrashBinIcon } from "../../../icons";
import {
  authApiBaseUrl,
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
  type RoleRequestApiItem,
  type RoleRequestItem,
  type RoleRequestMutationApiResponse,
} from "../../../lib/roleRequests";
import {
  formatTimestamp,
  getUserInitials,
  normalizeRole,
} from "../../../lib/userRoles";

type AdminRoleRequestsTableProps = {
  refreshVersion: number;
  onRequestApproved: () => void;
};

const tableColumnCount = 7;

type RoleRequestDeleteApiResponse = {
  message?: string;
  requestId?: string;
};

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
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [requestToConfirm, setRequestToConfirm] = useState<RoleRequestItem | null>(
    null
  );
  const [requestToDelete, setRequestToDelete] = useState<RoleRequestItem | null>(
    null
  );

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

        const response = await fetch(`${authApiBaseUrl}/api/role-requests`, {
          signal: abortController.signal,
          headers: {
            "X-Auth-User-Id": authSession.userId,
          },
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

        setRequests(payload.map(normalizeRoleRequest));
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
    if (roleRequest.status === "APPROVED" || approvingRequestId || deletingRequestId) {
      return;
    }

    setRequestToDelete(null);
    setRequestToConfirm(roleRequest);
  };

  const handleCloseApproveModal = () => {
    if (approvingRequestId) {
      return;
    }

    setRequestToConfirm(null);
  };

  const handleOpenDeleteModal = (roleRequest: RoleRequestItem) => {
    if (approvingRequestId || deletingRequestId) {
      return;
    }

    setRequestToConfirm(null);
    setRequestToDelete(roleRequest);
  };

  const handleCloseDeleteModal = () => {
    if (deletingRequestId) {
      return;
    }

    setRequestToDelete(null);
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
      const response = await fetch(
        `${authApiBaseUrl}/api/role-requests/${roleRequest.id}/approve`,
        {
          method: "PATCH",
          headers: {
            "X-Auth-User-Id": authSession.userId,
          },
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
        currentRequests.map((currentRequest) =>
          currentRequest.id === updatedRequest.id ? updatedRequest : currentRequest
        )
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

  const handleDeleteRequest = async (roleRequest: RoleRequestItem) => {
    const authSession = getStoredAuthSession();
    if (!authSession?.userId) {
      showNotification({
        variant: "error",
        title: "Delete failed",
        message: "You must be signed in as an admin to delete requests.",
      });
      setRequestToDelete(null);
      return;
    }

    setDeletingRequestId(roleRequest.id);

    try {
      const response = await fetch(
        `${authApiBaseUrl}/api/role-requests/${roleRequest.id}`,
        {
          method: "DELETE",
          headers: {
            "X-Auth-User-Id": authSession.userId,
          },
        }
      );

      const rawResponse = await response.text();
      const payload = parseResponsePayload<
        RoleRequestDeleteApiResponse | { message?: string }
      >(rawResponse);

      if (!response.ok) {
        showNotification({
          variant: "error",
          title: "Delete failed",
          message: getApiMessage(
            payload,
            "Unable to delete this role request right now."
          ),
        });
        setDeletingRequestId(null);
        return;
      }

      setRequests((currentRequests) =>
        currentRequests.filter((currentRequest) => currentRequest.id !== roleRequest.id)
      );
      setRequestToDelete(null);
      showNotification({
        variant: "success",
        title: "Request deleted",
        message: getApiMessage(payload, "Role request deleted successfully."),
      });
    } catch {
      showNotification({
        variant: "error",
        title: "Delete failed",
        message: "Cannot reach the server to delete the role request.",
      });
    } finally {
      setDeletingRequestId(null);
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
                  const isDeleting = deletingRequestId === roleRequest.id;
                  const isApproved = roleRequest.status === "APPROVED";

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
                        <div className="max-w-xl whitespace-pre-wrap">
                          {roleRequest.description || "No description provided."}
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
                            disabled={isApproved || isApproving || isDeleting}
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
                            onClick={() => handleOpenDeleteModal(roleRequest)}
                            disabled={isApproving || isDeleting}
                            startIcon={
                              isDeleting ? (
                                <LoadingIndicator size="sm" tone="inverse" />
                              ) : (
                                <TrashBinIcon className="h-4 w-4" />
                              )
                            }
                            className="whitespace-nowrap"
                          >
                            {isDeleting ? "Deleting" : "Delete"}
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
        isOpen={Boolean(requestToDelete)}
        onClose={handleCloseDeleteModal}
        className="m-4 max-w-[520px]"
      >
        <div className="px-6 py-7 sm:px-8">
          <div className="mb-5">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Delete Role Request
            </h3>
            {requestToDelete ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Are you sure you want to delete{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {requestToDelete.requesterDisplayName}
                </span>
                {"'s"} request for{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {formatRoleLabel(requestToDelete.requestedRole)}
                </span>
                ?
              </p>
            ) : null}
          </div>

         

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCloseDeleteModal}
              disabled={Boolean(deletingRequestId)}
            >
              No, Leave It
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={() =>
                requestToDelete
                  ? handleDeleteRequest(requestToDelete)
                  : undefined
              }
              disabled={!requestToDelete || Boolean(deletingRequestId)}
              startIcon={
                deletingRequestId ? (
                  <LoadingIndicator size="sm" tone="inverse" />
                ) : (
                  <TrashBinIcon className="h-4 w-4" />
                )
              }
            >
              {deletingRequestId ? "Deleting" : "Yes, Delete It"}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
