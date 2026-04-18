import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Button from "../../components/ui/button/Button";
import LoadingIndicator from "../../components/common/LoadingIndicator";
import Badge from "../../components/ui/badge/Badge";
import { getResource, updateResourceStatus, addResourceReview, deleteResourceReview, Resource } from "../../lib/resourceService";
import { getStoredAuthSession, isAdminRole } from "../../lib/auth";

export default function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resource, setResource] = useState<Resource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewComment, setReviewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const authSession = getStoredAuthSession();
  const isAdmin = isAdminRole(authSession?.role);

  useEffect(() => {
    const fetchRes = async () => {
      try {
        if (id) {
          const data = await getResource(id);
          setResource(data);
        }
      } catch (err) {
        alert("Failed to access resource.");
        navigate("/resources");
      } finally {
        setIsLoading(false);
      }
    };
    fetchRes();
  }, [id, navigate]);

  const handleToggleStatus = async () => {
    if (!resource || !id) return;
    const newStatus = resource.status === "ACTIVE" ? "OUT_OF_SERVICE" : "ACTIVE";
    try {
      const updated = await updateResourceStatus(id, newStatus);
      setResource(updated);
    } catch (err) {
      alert("Failed to update status");
    }
  };

  const handleSubmitReview = async () => {
    if (!id || reviewRating < 1 || reviewRating > 5) return;
    try {
      setIsSubmittingReview(true);
      const updatedRes = await addResourceReview(id, { rating: reviewRating, comment: reviewComment });
      setResource(updatedRes);
      setReviewComment("");
      setReviewRating(5);
    } catch (err) {
      alert("Failed to submit review. Make sure you are logged in.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!id) return;
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    try {
      const updatedRes = await deleteResourceReview(id, reviewId);
      setResource(updatedRes);
    } catch (err) {
      alert("Failed to delete review");
    }
  };

  if (isLoading) return <div className="p-8"><LoadingIndicator className="mx-auto" /></div>;
  if (!resource) return <div>Resource not found</div>;

  return (
    <>
      <PageBreadcrumb pageTitle="Resource Detail" />
      <ComponentCard title={resource.name} desc={`Details about ${resource.name}`}>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-gray-800 dark:text-white">Status:</span>
            <Badge size="sm" variant="solid" color={resource.status === "ACTIVE" ? "success" : "error"}>{resource.status}</Badge>
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={handleToggleStatus}>
                Toggle Status
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <p><span className="font-semibold dark:text-gray-300">Type:</span> <span className="text-gray-600 dark:text-gray-400">{resource.type}</span></p>
              <p><span className="font-semibold dark:text-gray-300">Location:</span> <span className="text-gray-600 dark:text-gray-400">{resource.location}</span></p>
              <p><span className="font-semibold dark:text-gray-300">Capacity:</span> <span className="text-gray-600 dark:text-gray-400">{resource.capacity || "N/A"}</span></p>
              <p><span className="font-semibold dark:text-gray-300">Availability:</span> <span className="text-gray-600 dark:text-gray-400">{resource.availabilityWindows || "N/A"}</span></p>
              {resource.averageRating !== undefined && resource.averageRating > 0 && (
                <p>
                  <span className="font-semibold dark:text-gray-300">Avg Rating:</span> 
                  <span className="ml-2 inline-flex align-middle">
                    <Badge color="warning" size="sm">★ {resource.averageRating.toFixed(1)} / 5.0</Badge>
                  </span>
                </p>
              )}
            </div>
            
            {resource.imageUrl && (
              <div className="flex justify-start md:justify-end">
                <img 
                  src={resource.imageUrl} 
                  alt={resource.name} 
                  className="max-h-56 max-w-full rounded-xl object-cover shadow-sm border border-gray-200 dark:border-gray-700" 
                />
              </div>
            )}
          </div>
          {/* <p><span className="font-semibold dark:text-gray-300">Description:</span> {resource.description || "N/A"}</p> */}

          <div className="mt-6 flex gap-4">
            <Link to="/resources">
              <Button variant="outline">Back to List</Button>
            </Link>
            {!isAdmin && (
              resource.status === "ACTIVE" ? (
                <Link to={`/bookings?resourceId=${resource.id}`}>
                  <Button>
                    Book Resource
                  </Button>
                </Link>
              ) : (
                <Button disabled>
                  Book Resource (Out of Service)
                </Button>
              )
            )}
            {isAdmin && (
              <Link to={`/resources/${resource.id}/edit`}>
                <Button>Edit Resource</Button>
              </Link>
            )}
          </div>
        </div>
      </ComponentCard>

      <div className="mt-8">
        <ComponentCard title="Reviews & Ratings" desc="See what others think of this resource">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 p-4 border border-gray-100 rounded-lg dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="font-semibold text-gray-800 dark:text-white">Leave a Review</h3>
              <div>
                <label className="block text-sm mb-1 dark:text-gray-300">Rating (1-5)</label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setReviewRating(star)}
                      className={`text-2xl transition-colors ${star <= reviewRating ? "text-yellow-400" : "text-gray-300 dark:text-gray-600"} hover:text-yellow-500 hover:scale-110`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm mb-1 dark:text-gray-300">Comment</label>
                <textarea 
                  className="w-full p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-brand-500"
                  rows={3}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Share your experience..."
                />
              </div>
              <div className="flex justify-end mt-2">
                <Button onClick={handleSubmitReview} disabled={isSubmittingReview}>
                  {isSubmittingReview ? "Submitting..." : "Submit Review"}
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              {resource.reviews && resource.reviews.length > 0 ? (
                resource.reviews.map((rev, idx) => (
                  <div key={idx} className="p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex text-yellow-400 text-sm">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <span key={i} className={i < rev.rating ? "text-yellow-400" : "text-gray-200 dark:text-gray-700"}>★</span>
                        ))}
                      </div>
                      <span className="text-xs text-gray-500 ml-auto">
                        {rev.createdAt ? new Date(rev.createdAt).toLocaleDateString() : "Just now"}
                      </span>
                    </div>
                    {rev.comment && <p className="text-gray-700 dark:text-gray-300 text-sm mt-1">{rev.comment}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500 font-medium">{rev.userName || "Anonymous User"}</p>
                      {authSession?.userId === rev.userId && rev.id && (
                        <button 
                          onClick={() => handleDeleteReview(rev.id!)}
                          className="text-xs text-red-500 hover:text-red-700 font-medium"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm text-center italic py-4">No reviews yet. Be the first to review!</p>
              )}
            </div>
          </div>
        </ComponentCard>
      </div>
    </>
  );
}
