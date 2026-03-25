import { useState } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import TextArea from "../../components/form/input/TextArea";
import Button from "../../components/ui/button/Button";
import FileInput from "../../components/form/input/FileInput";
import type { TicketPriority } from "../../types/ticket";
import { ticketService } from "../../services/ticketService";

const initialState = {
  title: "",
  category: "",
  description: "",
  priority: "MEDIUM" as TicketPriority,
  preferredContactDetails: "",
};

export default function CreateTicketForm() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialState);
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (
      !form.title.trim() ||
      !form.category.trim() ||
      !form.description.trim() ||
      !form.preferredContactDetails.trim()
    ) {
      setError("Please complete all required fields.");
      return;
    }

    if (files.length > 3) {
      setError("You can upload up to 3 images per ticket.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      const ticket = await ticketService.createTicket({ ...form, files });
      navigate(`/tickets/${ticket.id}`);
    } catch {
      setError("Ticket creation failed. Check the API connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <PageMeta title="Create Ticket" description="Create a maintenance incident ticket" />
      <PageBreadcrumb pageTitle="Create Ticket" />

      <ComponentCard
        title="Report a maintenance issue"
        desc="Capture enough detail for the admin team and assigned technician to act quickly."
      >
        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              placeholder="Water leak in Building A"
            />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Input
              id="category"
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({ ...current, category: event.target.value }))
              }
              placeholder="Plumbing, HVAC, Electrical..."
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <Label htmlFor="priority">Priority</Label>
            <select
              id="priority"
              value={form.priority}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  priority: event.target.value as TicketPriority,
                }))
              }
              className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-none focus:ring focus:ring-brand-500/20 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
            </select>
          </div>
          <div>
            <Label htmlFor="contact">Preferred Contact Details</Label>
            <Input
              id="contact"
              value={form.preferredContactDetails}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  preferredContactDetails: event.target.value,
                }))
              }
              placeholder="Phone number, extension, or email"
            />
          </div>
        </div>

        <div>
          <Label>Description</Label>
          <TextArea
            rows={6}
            value={form.description}
            onChange={(value) =>
              setForm((current) => ({ ...current, description: value }))
            }
            placeholder="Describe the issue, exact location, impact, and any immediate safety concerns"
          />
        </div>

        <div>
          <Label>Image Attachments</Label>
          <FileInput
            onChange={(event) => {
              const selectedFiles = Array.from(event.target.files ?? []).slice(0, 3);
              setFiles(selectedFiles);
            }}
          />
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Up to 3 image files are allowed.
          </p>
          {files.length > 0 && (
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              {files.map((file) => (
                <li key={file.name} className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/60">
                  {file.name}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => navigate("/tickets")}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Submitting..." : "Create ticket"}
          </Button>
        </div>
      </ComponentCard>
    </div>
  );
}
