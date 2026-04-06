import { useEffect, useMemo, useState } from "react";
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
import { useModal } from "../../../hooks/useModal";
import Label from "../../form/Label";
import TextArea from "../../form/input/TextArea";
import LoadingIndicator from "../../common/LoadingIndicator";
import { useNotification } from "../../common/NotificationProvider";
import {
  ChevronDownIcon,
  PencilIcon,
  PlusIcon,
  TrashBinIcon,
} from "../../../icons";
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
  sortRoleRequestsByNewest,
  type RoleRequestDeleteApiResponse,
  type RoleRequestApiItem,
  type RoleRequestItem,
  type RoleRequestMutationApiResponse,
  upsertRoleRequest,
} from "../../../lib/roleRequests";
import {
  formatTimestamp,
  getRequestableRoles,
  getRoleBadgeColor,
  normalizeRole,
  roleDescriptions,
  type UserRoleValue,
} from "../../../lib/userRoles";
import { useRoleRequestStream } from "../../../hooks/useRoleRequestStream";

type MyRoleRequestsTableProps = {
  refreshVersion: number;
  currentUserRole?: string | null;
  onRequestCreated: () => void;
};

const tableColumnCount = 6;

export default function MyRoleRequestsTable({
  refreshVersion,
  currentUserRole,
  onRequestCreated,
}: MyRoleRequestsTableProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const { showNotification } = useNotification();
  const [requests, setRequests] = useState<RoleRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [requestToEdit, setRequestToEdit] = useState<RoleRequestItem | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<RoleRequestItem | null>(
    null
  );

  const currentRole = normalizeRole(currentUserRole);
  const requestableRoles = useMemo(
    () => getRequestableRoles(currentRole),
    [currentRole]
  );
  const [selectedRole, setSelectedRole] = useState<UserRoleValue>(
    requestableRoles[0] ?? "MANAGER"
  );

  useRoleRequestStream({
    onEvent: (event) => {
      const currentSession = getStoredAuthSession();
      const currentUserId = currentSession?.userId ?? null;
      const requestId = event.request?.id ?? event.requestId;

      if (!currentUserId || !requestId) {
        return;
      }

      if (event.request && event.request.requesterUserId !== currentUserId) {
        return;
      }

      if (event.eventType === "DELETED") {
        setRequests((currentRequests) =>
          currentRequests.filter((currentRequest) => currentRequest.id !== requestId)
        );

        if (requestToEdit?.id === requestId) {
          resetModalState();
        }

        if (requestToDelete?.id === requestId) {
          setRequestToDelete(null);
        }

        if (event.actorUserId && event.actorUserId !== currentUserId) {
          showNotification({
            variant: "info",
            title: "Request deleted",
            message: event.message || "One of your role requests was deleted.",
          });
        }

        return;
      }

      const liveRequest = event.request;
      if (!liveRequest) {
        return;
      }

      setRequests((currentRequests) =>
        upsertRoleRequest(currentRequests, liveRequest, sortRoleRequestsByNewest)
      );

      if (requestToEdit?.id === liveRequest.id && liveRequest.status !== "PENDING") {
        resetModalState();
      }

      if (requestToDelete?.id === liveRequest.id && liveRequest.status !== "PENDING") {
        setRequestToDelete(null);
      }

      if (
        event.eventType === "APPROVED" &&
        event.user?.id === currentUserId &&
        currentSession
      ) {
        replaceStoredAuthSession({
          ...currentSession,
          role: event.user.role,
        });
      }

      if (!event.actorUserId || event.actorUserId === currentUserId) {
        return;
      }

      switch (event.eventType) {
        case "APPROVED":
          showNotification({
            variant: "success",
            title: "Role approved",
            message:
              event.message ||
              `Your ${formatRoleLabel(liveRequest.requestedRole)} request was approved.`,
          });
          break;
        case "REJECTED":
          showNotification({
            variant: "warning",
            title: "Role request rejected",
            message:
              liveRequest.rejectionReason ||
              event.message ||
              "An admin rejected your role request.",
          });
          break;
        case "UPDATED":
          showNotification({
            variant: "info",
            title: "Request updated",
            message: event.message || "One of your role requests was updated.",
          });
          break;
        default:
          break;
      }
    },
  });

  useEffect(() => {
    setSelectedRole((currentSelectedRole) =>
      requestableRoles.includes(currentSelectedRole)
        ? currentSelectedRole
        : requestableRoles[0] ?? "MANAGER"
    );
  }, [requestableRoles]);

  useEffect(() => {
    const abortController = new AbortController();

    const loadRequests = async () => {
      try {
        setIsLoading(true);
        setError("");

        const authSession = getStoredAuthSession();
        if (!authSession?.userId) {
          setError("You must be signed in to view your role requests.");
          return;
        }

        const response = await apiFetch("/api/role-requests/my", {
          signal: abortController.signal,
        });

        const rawResponse = await response.text();
        const payload = parseResponsePayload<
          RoleRequestApiItem[] | { message?: string }
        >(rawResponse);

        if (!response.ok) {
          setError(
            getApiMessage(payload, "Unable to load your role requests right now.")
          );
          return;
        }

        if (
          !Array.isArray(payload) ||
          !payload.every((item) => isRoleRequestApiItem(item))
        ) {
          setError("The server returned an invalid role requests response.");
          return;
        }

        setRequests(sortRoleRequestsByNewest(payload.map(normalizeRoleRequest)));
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setError("Cannot reach the server to load your role requests.");
      } finally {
        setIsLoading(false);
      }
    };

    void loadRequests();

    return () => {
      abortController.abort();
    };
  }, [refreshVersion]);

  const resetModalState = () => {
    closeModal();
    setRequestToEdit(null);
    setDescription("");
    setSubmitError("");
    setIsSubmitting(false);
    setSelectedRole(requestableRoles[0] ?? "MANAGER");
  };

  const handleCloseModal = () => {
    if (isSubmitting) {
      return;
    }

    resetModalState();
  };

  const handleOpenDeleteModal = (roleRequest: RoleRequestItem) => {
    if (deletingRequestId) {
      return;
    }

    setRequestToDelete(roleRequest);
  };

  const handleOpenCreateModal = () => {
    if (requestableRoles.length === 0 || deletingRequestId) {
      return;
    }

    setRequestToDelete(null);
    setRequestToEdit(null);
    setDescription("");
    setSubmitError("");
    setSelectedRole(requestableRoles[0] ?? "MANAGER");
    openModal();
  };

  const handleOpenEditModal = (roleRequest: RoleRequestItem) => {
    if (deletingRequestId || roleRequest.status !== "PENDING") {
      return;
    }

    setRequestToDelete(null);
    setRequestToEdit(roleRequest);
    setSelectedRole(roleRequest.requestedRole);
    setDescription(roleRequest.description);
    setSubmitError("");
    openModal();
  };

  const handleCloseDeleteModal = () => {
    if (deletingRequestId) {
      return;
    }

    setRequestToDelete(null);
  };

  const handleSubmitRequest = async () => {
    if (requestableRoles.length === 0) {
      setSubmitError("Your account already has the highest available role.");
      return;
    }

    const isEditingRequest = Boolean(requestToEdit);

    const trimmedDescription = description.trim();
    if (!trimmedDescription) {
      setSubmitError("Description is required.");
      return;
    }

    const authSession = getStoredAuthSession();
    if (!authSession?.userId) {
      const message = isEditingRequest
        ? "You must be signed in to edit your role request."
        : "You must be signed in to submit a role request.";
      setSubmitError(message);
      showNotification({
        variant: "error",
        title: isEditingRequest ? "Update failed" : "Request failed",
        message,
      });
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    try {
      const response = await apiFetch(
        isEditingRequest
          ? `/api/role-requests/${requestToEdit?.id ?? ""}`
          : "/api/role-requests",
        {
          method: isEditingRequest ? "PATCH" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requestedRole: selectedRole,
            description: trimmedDescription,
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
          isEditingRequest
            ? "Unable to update your role request right now."
            : "Unable to submit your role request right now."
        );
        setSubmitError(message);
        showNotification({
          variant: "error",
          title: isEditingRequest ? "Update failed" : "Request failed",
          message,
        });
        setIsSubmitting(false);
        return;
      }

      if (!isRoleRequestMutationApiResponse(payload)) {
        const message = "The server returned an invalid role request response.";
        setSubmitError(message);
        showNotification({
          variant: "error",
          title: isEditingRequest ? "Update failed" : "Request failed",
          message,
        });
        setIsSubmitting(false);
        return;
      }

      const savedRequest = normalizeRoleRequest(payload.request);

      if (isEditingRequest) {
        setRequests((currentRequests) =>
          upsertRoleRequest(currentRequests, savedRequest, sortRoleRequestsByNewest)
        );
      } else {
        setRequests((currentRequests) =>
          upsertRoleRequest(currentRequests, savedRequest, sortRoleRequestsByNewest)
        );
      }

      resetModalState();
      onRequestCreated();
      showNotification({
        variant: "success",
        title: isEditingRequest ? "Request updated" : "Role request sent",
        message: getApiMessage(
          payload,
          isEditingRequest
            ? `Your request for ${formatRoleLabel(savedRequest.requestedRole)} access was updated successfully.`
            : `Your request for ${formatRoleLabel(savedRequest.requestedRole)} access was sent to admins.`
        ),
      });
    } catch {
      const message = isEditingRequest
        ? "Cannot reach the server to update your role request."
        : "Cannot reach the server to submit your role request.";
      setSubmitError(message);
      showNotification({
        variant: "error",
        title: requestToEdit ? "Update failed" : "Request failed",
        message,
      });
      setIsSubmitting(false);
    }
  };

  const handleDeleteRequest = async (roleRequest: RoleRequestItem) => {
    const authSession = getStoredAuthSession();
    if (!authSession?.userId) {
      showNotification({
        variant: "error",
        title: "Delete failed",
        message: "You must be signed in to delete a role request.",
      });
      setRequestToDelete(null);
      return;
    }

    setDeletingRequestId(roleRequest.id);

    try {
      const response = await apiFetch(`/api/role-requests/${roleRequest.id}`, {
        method: "DELETE",
      });

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
            "Unable to delete your role request right now."
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
        message: "Cannot reach the server to delete your role request.",
      });
    } finally {
      setDeletingRequestId(null);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 dark:border-gray-800 dark:bg-gray-900/40 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Current role
            </span>
            <Badge
              size="sm"
              variant="solid"
              color={getRoleBadgeColor(currentRole)}
            >
              {formatRoleLabel(currentRole)}
            </Badge>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Submit a request when you need higher application access. Admins can
            review it and either approve or reject it with feedback.
          </p>
        </div>

        <Button
          size="sm"
          startIcon={<PlusIcon className="h-4 w-4" />}
          onClick={handleOpenCreateModal}
          disabled={requestableRoles.length === 0}
          className="whitespace-nowrap"
        >
          Request Role
        </Button>
      </div>

      {requestableRoles.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          You already have the highest application role, so there are no higher
          roles to request.
        </p>
      ) : null}

      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[760px]">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
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
                  Current Role
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
                      label="Loading your role requests"
                      description="Please wait while your latest requests are fetched."
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
                    You have not sent any role requests yet.
                  </TableCell>
                </TableRow>
              ) : null}

              {!isLoading &&
                !error &&
                requests.map((request) => {
                  const isDeleting = deletingRequestId === request.id;
                  const isPending = request.status === "PENDING";

                  return (
                    <TableRow key={request.id}>
                      <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-700 dark:text-gray-300">
                        <Badge
                          size="sm"
                          variant="solid"
                          color={getRequestedRoleBadgeColor(request.requestedRole)}
                        >
                          {formatRoleLabel(request.requestedRole)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        {formatRoleLabel(request.currentRole)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        <div className="max-w-xl space-y-3">
                          <div className="whitespace-pre-wrap">
                            {request.description || "No description provided."}
                          </div>
                          {request.rejectionReason ? (
                            <div className="rounded-lg border border-error-200 bg-error-50 px-3 py-3 text-xs text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
                              <span className="font-semibold">
                                Why this request was rejected:
                              </span>{" "}
                              <span className="whitespace-pre-wrap">
                                {request.rejectionReason}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        <Badge
                          size="sm"
                          variant="light"
                          color={getRoleRequestStatusColor(request.status)}
                        >
                          {formatRoleRequestStatus(request.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        {formatTimestamp(request.createdAt)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenEditModal(request)}
                            disabled={!isPending || isDeleting}
                            startIcon={<PencilIcon className="h-4 w-4" />}
                            className="whitespace-nowrap"
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleOpenDeleteModal(request)}
                            disabled={isDeleting}
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
        isOpen={isOpen}
        onClose={handleCloseModal}
        className="m-4 max-w-[560px]"
      >
        <div className="px-6 py-7 sm:px-8">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              {requestToEdit ? "Edit Role Request" : "Request Role"}
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {requestToEdit
                ? "Update the role and description before admins review your request."
                : "Choose the role you want and tell admins why you need that access."}
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <Label htmlFor="requested-role" className="mb-2">
                Role Type
              </Label>
              <div className="relative">
                <select
                  id="requested-role"
                  name="requested-role"
                  value={selectedRole}
                  onChange={(event) =>
                    setSelectedRole(event.target.value as UserRoleValue)
                  }
                  className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                >
                  {requestableRoles.map((roleOption) => (
                    <option
                      key={roleOption}
                      value={roleOption}
                      className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
                    >
                      {formatRoleLabel(roleOption)}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <ChevronDownIcon className="h-4 w-4" />
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {roleDescriptions[selectedRole]}
              </p>
            </div>

            <div>
              <Label htmlFor="request-description" className="mb-2">
                Description
              </Label>
              <TextArea
                rows={5}
                value={description}
                onChange={setDescription}
                placeholder="Explain why you need this role and what work you will do with it."
                error={Boolean(submitError)}
              />
            </div>
          </div>

          {submitError ? (
            <div className="mt-5 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
              {submitError}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCloseModal}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmitRequest}
              disabled={isSubmitting}
              startIcon={
                isSubmitting ? (
                  <LoadingIndicator size="sm" tone="inverse" />
                ) : undefined
              }
            >
              {isSubmitting
                ? requestToEdit
                  ? "Saving Changes"
                  : "Sending Request"
                : requestToEdit
                ? "Save Changes"
                : "Submit Request"}
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
                Are you sure you want to delete your request for{" "}
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
    </>
  );
}
