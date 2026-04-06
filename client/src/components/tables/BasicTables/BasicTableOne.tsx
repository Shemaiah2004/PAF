import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../ui/table";
import { ChevronDownIcon, PencilIcon } from "../../../icons";
import Badge from "../../ui/badge/Badge";
import Button from "../../ui/button/Button";
import { Modal } from "../../ui/modal";
import { useModal } from "../../../hooks/useModal";
import Label from "../../form/Label";
import Input from "../../form/input/InputField";
import LoadingIndicator from "../../common/LoadingIndicator";
import { useNotification } from "../../common/NotificationProvider";
import {
  apiFetch,
  formatRoleLabel,
  getApiMessage,
  getStoredAuthSession,
  isAdminRole,
  parseResponsePayload,
  replaceStoredAuthSession,
} from "../../../lib/auth";
import {
  availableRoles,
  formatTimestamp,
  getRoleBadgeColor,
  getUserInitials,
  normalizeRole,
  roleDescriptions,
  type UserRoleValue,
} from "../../../lib/userRoles";

type UserTableApiItem = {
  id: string;
  email: string;
  displayName: string;
  photoUrl?: string | null;
  provider?: string | null;
  role?: string | null;
  createdAt?: string | null;
};

type UserRoleUpdateApiResponse = {
  message?: string;
  user: UserTableApiItem;
};

type UserTableItem = {
  id: string;
  email: string;
  displayName: string;
  photoUrl: string | null;
  provider: string;
  role: UserRoleValue;
  createdAt: string | null;
};

type UserFilters = {
  displayName: string;
  email: string;
  role: "" | UserRoleValue;
};

const initialFilters: UserFilters = {
  displayName: "",
  email: "",
  role: "",
};

const tableColumnCount = 6;
const maxSearchSuggestions = 6;

const normalizeUser = (user: UserTableApiItem): UserTableItem => ({
  id: user.id,
  email: user.email,
  displayName:
    typeof user.displayName === "string" && user.displayName.trim()
      ? user.displayName.trim()
      : user.email,
  photoUrl:
    typeof user.photoUrl === "string" && user.photoUrl.trim()
      ? user.photoUrl
      : null,
  provider:
    typeof user.provider === "string" && user.provider.trim()
      ? user.provider.toUpperCase()
      : "LOCAL",
  role: normalizeRole(user.role),
  createdAt: user.createdAt ?? null,
});

const isUserTableApiItem = (value: unknown): value is UserTableApiItem => {
  return Boolean(
    value &&
      typeof value === "object" &&
      "id" in value &&
      typeof value.id === "string" &&
      "email" in value &&
      typeof value.email === "string"
  );
};

const isUserRoleUpdateApiResponse = (
  value: unknown
): value is UserRoleUpdateApiResponse => {
  return Boolean(
    value &&
      typeof value === "object" &&
      "user" in value &&
      isUserTableApiItem((value as { user?: unknown }).user)
  );
};

export default function BasicTableOne() {
  const { isOpen, openModal, closeModal } = useModal();
  const { showNotification } = useNotification();
  const [users, setUsers] = useState<UserTableItem[]>([]);
  const [searchSourceUsers, setSearchSourceUsers] = useState<UserTableItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState<UserFilters>(initialFilters);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [selectedUser, setSelectedUser] = useState<UserTableItem | null>(null);
  const [selectedRole, setSelectedRole] = useState<UserRoleValue>("USER");
  const [roleError, setRoleError] = useState("");
  const [isUpdatingRole, setIsUpdatingRole] = useState(false);
  const [activeSuggestionField, setActiveSuggestionField] = useState<
    "displayName" | "email" | null
  >(null);

  const hasActiveFilters = Boolean(
    filters.displayName.trim() || filters.email.trim() || filters.role
  );

  const resetRoleModal = () => {
    closeModal();
    setSelectedUser(null);
    setSelectedRole("USER");
    setRoleError("");
    setIsUpdatingRole(false);
  };

  const handleCloseRoleModal = () => {
    if (isUpdatingRole) {
      return;
    }

    resetRoleModal();
  };

  const handleOpenRoleModal = (user: UserTableItem) => {
    setSelectedUser(user);
    setSelectedRole(user.role);
    setRoleError("");
    openModal();
  };

  const handleFilterChange = (
    field: keyof UserFilters,
    value: UserFilters[keyof UserFilters]
  ) => {
    setFilters((currentFilters) => ({
      ...currentFilters,
      [field]: value,
    }));
  };

  const handleSuggestionSelect = (
    field: "displayName" | "email",
    value: string
  ) => {
    handleFilterChange(field, value);
    setActiveSuggestionField(null);
  };

  const getSuggestions = (field: "displayName" | "email") => {
    const query = filters[field].trim().toLowerCase();

    if (!query) {
      return [];
    }

    const seenValues = new Set<string>();

    return searchSourceUsers
      .map((user) => (field === "displayName" ? user.displayName : user.email))
      .filter((value) => {
        const trimmedValue = value.trim();

        if (!trimmedValue) {
          return false;
        }

        const normalizedValue = trimmedValue.toLowerCase();
        if (!normalizedValue.includes(query) || seenValues.has(normalizedValue)) {
          return false;
        }

        seenValues.add(normalizedValue);
        return true;
      })
      .slice(0, maxSearchSuggestions);
  };

  const displayNameSuggestions = getSuggestions("displayName");
  const emailSuggestions = getSuggestions("email");
  const showDisplayNameSuggestions =
    activeSuggestionField === "displayName" &&
    displayNameSuggestions.length > 0;
  const showEmailSuggestions =
    activeSuggestionField === "email" && emailSuggestions.length > 0;
  const loadingUsersLabel = hasActiveFilters
    ? "Filtering signed-in users"
    : "Loading signed-in users";

  useEffect(() => {
    const abortController = new AbortController();

    const loadSearchSourceUsers = async () => {
      try {
        const authSession = getStoredAuthSession();
        if (!authSession?.userId) {
          setSearchSourceUsers([]);
          return;
        }

        const response = await apiFetch("/api/users", {
          signal: abortController.signal,
        });
        const rawResponse = await response.text();
        const payload = parseResponsePayload<
          UserTableApiItem[] | { message?: string }
        >(rawResponse);

        if (!response.ok || !Array.isArray(payload)) {
          setSearchSourceUsers([]);
          return;
        }

        setSearchSourceUsers(payload.map(normalizeUser));
      } catch (fetchError) {
        if (
          fetchError instanceof DOMException &&
          fetchError.name === "AbortError"
        ) {
          return;
        }

        setSearchSourceUsers([]);
      }
    };

    void loadSearchSourceUsers();

    return () => {
      abortController.abort();
    };
  }, [refreshVersion]);

  useEffect(() => {
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void loadUsers();
    }, 250);

    const loadUsers = async () => {
      try {
        setIsLoading(true);
        setError("");

        const authSession = getStoredAuthSession();
        if (!authSession?.userId) {
          setError("You must be signed in as an admin to view users.");
          return;
        }

        const searchParams = new URLSearchParams();
        if (filters.displayName.trim()) {
          searchParams.set("displayName", filters.displayName.trim());
        }
        if (filters.email.trim()) {
          searchParams.set("email", filters.email.trim());
        }
        if (filters.role) {
          searchParams.set("role", filters.role);
        }

        const requestUrl = searchParams.toString()
          ? `/api/users?${searchParams.toString()}`
          : "/api/users";

        const response = await apiFetch(requestUrl, {
          signal: abortController.signal,
        });
        const rawResponse = await response.text();
        const payload = parseResponsePayload<
          UserTableApiItem[] | { message?: string }
        >(rawResponse);

        if (!response.ok) {
          const message =
            typeof payload === "object" &&
            payload !== null &&
            "message" in payload &&
            typeof payload.message === "string"
              ? payload.message
              : "Unable to load users right now.";
          setError(message);
          return;
        }

        if (!Array.isArray(payload)) {
          setError("The server returned an invalid users response.");
          return;
        }

        setUsers(payload.map(normalizeUser));
      } catch (fetchError) {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
          return;
        }

        setError("Cannot reach the server to load users.");
      } finally {
        setIsLoading(false);
      }
    };

    return () => {
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [filters.displayName, filters.email, filters.role, refreshVersion]);

  const handleAssignRole = async () => {
    if (!selectedUser) {
      return;
    }

    const authSession = getStoredAuthSession();
    if (!authSession?.userId) {
      const message = "You must be signed in as an admin to update roles.";
      setRoleError(message);
      showNotification({
        variant: "error",
        title: "Role update failed",
        message,
      });
      return;
    }

    setIsUpdatingRole(true);
    setRoleError("");

    try {
      const response = await apiFetch(`/api/users/${selectedUser.id}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: selectedRole,
        }),
      });

      const rawResponse = await response.text();
      const payload = parseResponsePayload<
        UserRoleUpdateApiResponse | { message?: string }
      >(rawResponse);

      if (!response.ok) {
        const message = getApiMessage(
          payload,
          "Unable to update the user role right now."
        );
        setRoleError(message);
        showNotification({
          variant: "error",
          title: "Role update failed",
          message,
        });
        setIsUpdatingRole(false);
        return;
      }

      if (!isUserRoleUpdateApiResponse(payload)) {
        const message = "The server returned an invalid role update response.";
        setRoleError(message);
        showNotification({
          variant: "error",
          title: "Role update failed",
          message,
        });
        setIsUpdatingRole(false);
        return;
      }

      const updatedUser = normalizeUser(payload.user);
      const roleChanged = selectedUser.role !== updatedUser.role;
      const responseMessage = getApiMessage(
        payload,
        roleChanged
          ? `User role updated to ${formatRoleLabel(updatedUser.role)} successfully.`
          : `User already has the ${formatRoleLabel(updatedUser.role)} role.`
      );

      if (authSession.userId === updatedUser.id) {
        replaceStoredAuthSession({
          ...authSession,
          role: updatedUser.role,
        });

        if (!isAdminRole(updatedUser.role)) {
          resetRoleModal();
          showNotification({
            variant: "warning",
            title: "Admin access removed",
            message: responseMessage,
          });
          return;
        }
      }

      setRefreshVersion((currentValue) => currentValue + 1);
      resetRoleModal();
      showNotification({
        variant: roleChanged ? "success" : "info",
        title: roleChanged ? "Role updated" : "Role unchanged",
        message: responseMessage,
      });
    } catch {
      const message = "Cannot reach the server to update the role.";
      setRoleError(message);
      showNotification({
        variant: "error",
        title: "Role update failed",
        message,
      });
      setIsUpdatingRole(false);
    }
  };

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 px-5 py-5 dark:border-white/[0.05] sm:px-6">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_auto]">
            <div>
              <Label htmlFor="user-filter" className="mb-2">
                User
              </Label>
              <div className="relative">
                <Input
                  id="user-filter"
                  name="user-filter"
                  value={filters.displayName}
                  onChange={(event) =>
                    handleFilterChange("displayName", event.target.value)
                  }
                  onFocus={() => setActiveSuggestionField("displayName")}
                  onBlur={() => setActiveSuggestionField(null)}
                  autoComplete="off"
                  placeholder="Search by display name"
                />
                {showDisplayNameSuggestions ? (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
                    {displayNameSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleSuggestionSelect("displayName", suggestion);
                        }}
                      >
                        <span>{suggestion}</span>
                        <span className="text-xs text-gray-400">
                          Display name
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <Label htmlFor="email-filter" className="mb-2">
                Email
              </Label>
              <div className="relative">
                <Input
                  type="email"
                  id="email-filter"
                  name="email-filter"
                  value={filters.email}
                  onChange={(event) =>
                    handleFilterChange("email", event.target.value)
                  }
                  onFocus={() => setActiveSuggestionField("email")}
                  onBlur={() => setActiveSuggestionField(null)}
                  autoComplete="off"
                  placeholder="Search by email"
                />
                {showEmailSuggestions ? (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
                    {emailSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          handleSuggestionSelect("email", suggestion);
                        }}
                      >
                        <span className="truncate">{suggestion}</span>
                        <span className="ml-3 shrink-0 text-xs text-gray-400">
                          Email
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div>
              <Label htmlFor="role-filter" className="mb-2">
                Role
              </Label>
              <div className="relative">
                <select
                  id="role-filter"
                  name="role-filter"
                  value={filters.role}
                  onChange={(event) =>
                    handleFilterChange(
                      "role",
                      event.target.value as UserFilters["role"]
                    )
                  }
                  className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
                >
                  <option
                    value=""
                    className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
                  >
                    All roles
                  </option>
                  {availableRoles.map((roleOption) => (
                    <option
                      key={roleOption}
                      value={roleOption}
                      className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
                    >
                      {roleOption}
                    </option>
                  ))}
                </select>
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                  <ChevronDownIcon className="h-4 w-4" />
                </span>
              </div>
            </div>

            <div className="flex items-end">
              <Button
                size="sm"
                variant="outline"
                className="w-full xl:w-auto"
                onClick={() => setFilters(initialFilters)}
                disabled={!hasActiveFilters}
              >
                Clear Filters
              </Button>
            </div>
          </div>

          <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Results update automatically as you type or select a role.
          </p>
        </div>

        <div className="max-w-full overflow-x-auto">
          <div className="min-w-[980px]">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    User
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Email
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Provider
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Role
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Joined
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Action
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={tableColumnCount}
                      className="px-5 py-10"
                    >
                      <LoadingIndicator
                        layout="stacked"
                        size="md"
                        label={loadingUsersLabel}
                        description="Please wait while the latest user accounts are loaded."
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

                {!isLoading && !error && users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={tableColumnCount}
                      className="px-5 py-6 text-center text-theme-sm text-gray-500 dark:text-gray-400"
                    >
                      No users have signed in yet.
                    </TableCell>
                  </TableRow>
                ) : null}

                {!isLoading &&
                  !error &&
                  users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="px-5 py-4 sm:px-6 text-start">
                        <div className="flex items-center gap-3">
                          {user.photoUrl ? (
                            <div className="h-10 w-10 overflow-hidden rounded-full">
                              <img
                                width={40}
                                height={40}
                                src={user.photoUrl}
                                alt={user.displayName}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 text-theme-sm font-semibold text-brand-500 dark:bg-brand-500/20 dark:text-brand-400">
                              {getUserInitials(user.displayName, user.email)}
                            </div>
                          )}
                          <div>
                            <span className="block font-medium text-gray-800 text-theme-sm dark:text-white/90">
                              {user.displayName}
                            </span>
                            <span className="block text-gray-500 text-theme-xs dark:text-gray-400">
                              {user.displayName === user.email
                                ? "Using email as display name"
                                : "Display name available"}
                            </span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        {user.email}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        {user.provider}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-500 dark:text-gray-400">
                        <Badge
                          size="sm"
                          variant="solid"
                          color={getRoleBadgeColor(user.role)}
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-500 dark:text-gray-400">
                        {formatTimestamp(user.createdAt)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-start">
                        <Button
                          size="sm"
                          variant="primary"
                          startIcon={<PencilIcon className="h-4 w-4" />}
                          className="whitespace-nowrap"
                          onClick={() => handleOpenRoleModal(user)}
                        >
                          Assign Role
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isOpen}
        onClose={handleCloseRoleModal}
        className="m-4 max-w-[560px]"
      >
        <div className="px-6 py-7 sm:px-8">
          <div className="mb-6">
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Assign Role
            </h3>
            {selectedUser ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Choose the role for{" "}
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {selectedUser.displayName}
                </span>{" "}
                ({selectedUser.email}).
              </p>
            ) : null}
          </div>

          <div className="space-y-3">
            {availableRoles.map((roleOption) => {
              const isSelected = selectedRole === roleOption;

              return (
                <button
                  key={roleOption}
                  type="button"
                  onClick={() => setSelectedRole(roleOption)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left transition ${
                    isSelected
                      ? "border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-500/10"
                      : "border-gray-200 hover:border-brand-300 hover:bg-gray-50 dark:border-gray-800 dark:hover:border-brand-500/40 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="pr-4">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-gray-800 dark:text-white/90">
                        {roleOption}
                      </span>
                      <Badge
                        size="sm"
                        variant="solid"
                        color={getRoleBadgeColor(roleOption)}
                      >
                        {roleOption}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {roleDescriptions[roleOption]}
                    </p>
                  </div>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full border ${
                      isSelected
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-gray-300 text-transparent dark:border-gray-700"
                    }`}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 14 14"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M11.667 3.5L5.25033 9.91667L2.33366 7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                </button>
              );
            })}
          </div>

          {roleError ? (
            <div className="mt-5 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
              {roleError}
            </div>
          ) : null}

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCloseRoleModal}
              disabled={isUpdatingRole}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleAssignRole}
              disabled={isUpdatingRole}
              startIcon={
                isUpdatingRole ? (
                  <LoadingIndicator size="sm" tone="inverse" />
                ) : undefined
              }
            >
              {isUpdatingRole ? "Saving role" : "Assign Role"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
