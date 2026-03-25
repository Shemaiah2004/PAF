import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import PageMeta from "../../components/common/PageMeta";
import AdminRoleRequestsTable from "../../components/tables/BasicTables/AdminRoleRequestsTable";
import { useState } from "react";

export default function ApprovalRequests() {
  const [requestRefreshVersion, setRequestRefreshVersion] = useState(0);

  const handleRequestRefresh = () => {
    setRequestRefreshVersion((currentValue) => currentValue + 1);
  };

  return (
    <>
      <PageMeta
        title="Approval Requests | PAF Auth Dashboard"
        description="Review submitted role requests and approve access changes."
      />
      <PageBreadcrumb pageTitle="Approval Requests" />
      <div className="space-y-6">
        <ComponentCard
          title="Approval Requests"
          desc="Review incoming role requests from signed-in users and approve access changes."
        >
          <AdminRoleRequestsTable
            refreshVersion={requestRefreshVersion}
            onRequestApproved={handleRequestRefresh}
          />
        </ComponentCard>
      </div>
    </>
  );
}
