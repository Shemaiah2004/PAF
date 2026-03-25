import { useEffect, useState } from "react";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import MyRoleRequestsTable from "../../components/tables/BasicTables/MyRoleRequestsTable";
import {
  AUTH_CHANGE_EVENT,
  formatRoleLabel,
  getStoredAuthSession,
} from "../../lib/auth";

export default function BasicTables() {
  const [authSession, setAuthSession] = useState(() => getStoredAuthSession());
  const [requestRefreshVersion, setRequestRefreshVersion] = useState(0);

  useEffect(() => {
    const syncAuthSession = () => {
      setAuthSession(getStoredAuthSession());
    };

    window.addEventListener(AUTH_CHANGE_EVENT, syncAuthSession);

    return () => {
      window.removeEventListener(AUTH_CHANGE_EVENT, syncAuthSession);
    };
  }, []);

  const handleRequestRefresh = () => {
    setRequestRefreshVersion((currentValue) => currentValue + 1);
  };

  return (
    <>
      <PageMeta
        title="Role Requests | PAF Auth Dashboard"
        description="Submit role requests and track your approval status."
      />
      <PageBreadcrumb pageTitle="Role Requests" />
      <div className="space-y-6">
        <ComponentCard
          title="My Role Requests"
          desc={`Current role: ${formatRoleLabel(authSession?.role ?? "USER")}. Submit a new request and track your approvals here.`}
        >
          <MyRoleRequestsTable
            refreshVersion={requestRefreshVersion}
            currentUserRole={authSession?.role}
            onRequestCreated={handleRequestRefresh}
          />
        </ComponentCard>
      </div>
    </>
  );
}
