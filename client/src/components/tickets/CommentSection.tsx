import { useState } from "react";
import Button from "../ui/button/Button";
import TextArea from "../form/input/TextArea";
import type { TicketComment, UserSummary } from "../../types/ticket";

interface CommentSectionProps {
  comments: TicketComment[];
  currentUser: UserSummary;
  onAddComment: (message: string) => Promise<void>;
  onUpdateComment: (commentId: number, message: string) => Promise<void>;
  onDeleteComment: (commentId: number) => Promise<void>;
}

export default function CommentSection({
  comments,
  currentUser,
  onAddComment,
  onUpdateComment,
  onDeleteComment,
}: CommentSectionProps) {
  const [newMessage, setNewMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingMessage, setEditingMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submitComment = async () => {
    if (!newMessage.trim()) {
      return;
    }
    setBusy(true);
    try {
      await onAddComment(newMessage.trim());
      setNewMessage("");
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async () => {
    if (editingId === null || !editingMessage.trim()) {
      return;
    }
    setBusy(true);
    try {
      await onUpdateComment(editingId, editingMessage.trim());
      setEditingId(null);
      setEditingMessage("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-dashed border-gray-300 p-4 dark:border-gray-700">
        <p className="mb-3 text-sm font-medium text-gray-700 dark:text-white/90">
          Add an update as {currentUser.fullName}
        </p>
        <TextArea
          rows={4}
          value={newMessage}
          onChange={setNewMessage}
          placeholder="Share additional context, progress notes, or questions"
        />
        <div className="mt-4 flex justify-end">
          <Button onClick={submitComment} disabled={busy || !newMessage.trim()}>
            Post comment
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        {comments.map((comment) => {
          const isEditing = editingId === comment.id;
          return (
            <div
              key={comment.id}
              className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                    {comment.author.fullName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {comment.author.role} • {new Date(comment.timestamp).toLocaleString()}
                  </p>
                </div>
                {comment.editable && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(comment.id);
                        setEditingMessage(comment.message);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDeleteComment(comment.id)}
                    >
                      Delete
                    </Button>
                  </div>
                )}
              </div>

              {isEditing ? (
                <div className="mt-4 space-y-3">
                  <TextArea rows={3} value={editingMessage} onChange={setEditingMessage} />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingId(null);
                        setEditingMessage("");
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={submitEdit} disabled={busy}>
                      Save
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                  {comment.message}
                </p>
              )}
            </div>
          );
        })}

        {comments.length === 0 && (
          <div className="rounded-2xl border border-gray-200 border-dashed p-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
            No comments yet. Start the conversation here.
          </div>
        )}
      </div>
    </div>
  );
}
