import { useState, memo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare, Edit2, Trash2, Send, AlertCircle } from "lucide-react";

interface CommentWithUser {
  id: string;
  userId: string;
  seriesId: string | null;
  chapterId: string | null;
  content: string;
  createdAt: string | null;
  updatedAt: string | null;
  user: {
    id: string;
    username: string | null;
    profilePicture: string | null;
    profileImageUrl: string | null;
  };
}

interface CommentSectionProps {
  seriesId?: string;
  chapterId?: string;
}

// PERFORMANCE: Memoize CommentSection to prevent unnecessary re-renders
function CommentSection({ seriesId, chapterId }: CommentSectionProps) {
  const { user, isStaffOrAbove } = useAuth();
  const { toast } = useToast();
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const maxLength = 1000;

  const queryKey = seriesId 
    ? ['comments', 'series', seriesId]
    : ['comments', 'chapter', chapterId];

  const endpoint = seriesId 
    ? `/api/series/${seriesId}/comments`
    : `/api/chapters/${chapterId}/comments`;

  const { data: comments = [], isLoading, error, isError } = useQuery<CommentWithUser[]>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(endpoint, {
        credentials: "include",
      });
      
      if (!response.ok) {
        throw new Error("Failed to fetch comments");
      }
      
      return response.json();
    },
    retry: false,
  });

  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", endpoint, { content });
      return response.json();
    },
    onMutate: async (content: string) => {
      await queryClient.cancelQueries({ queryKey });
      
      const previousComments = queryClient.getQueryData<CommentWithUser[]>(queryKey);
      
      if (user) {
        const optimisticComment: CommentWithUser = {
          id: `temp-${Date.now()}`,
          userId: user.id,
          seriesId: seriesId || null,
          chapterId: chapterId || null,
          content,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          user: {
            id: user.id,
            username: user.username,
            profilePicture: user.profilePicture || null,
            profileImageUrl: user.profileImageUrl || null,
          },
        };
        
        queryClient.setQueryData<CommentWithUser[]>(
          queryKey,
          (old = []) => [optimisticComment, ...old]
        );
      }
      
      return { previousComments };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setNewComment("");
      toast({
        title: "Comment posted",
        description: "Your comment has been posted successfully.",
      });
    },
    onError: (error: any, _, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(queryKey, context.previousComments);
      }
      
      toast({
        title: "Failed to post comment",
        description: error.message || "Unable to post your comment. Please try again.",
        variant: "error",
      });
    },
  });

  const updateCommentMutation = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const response = await apiRequest("PATCH", `/api/comments/${commentId}`, { content });
      return response.json();
    },
    onMutate: async ({ commentId, content }) => {
      await queryClient.cancelQueries({ queryKey });
      
      const previousComments = queryClient.getQueryData<CommentWithUser[]>(queryKey);
      
      queryClient.setQueryData<CommentWithUser[]>(
        queryKey,
        (old = []) => old.map(comment =>
          comment.id === commentId
            ? { ...comment, content, updatedAt: new Date().toISOString() }
            : comment
        )
      );
      
      return { previousComments };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setEditingId(null);
      setEditContent("");
      toast({
        title: "Comment updated",
        description: "Your comment has been updated successfully.",
      });
    },
    onError: (error: any, _, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(queryKey, context.previousComments);
      }
      
      toast({
        title: "Failed to update comment",
        description: error.message || "Unable to update your comment. Please try again.",
        variant: "error",
      });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      return apiRequest("DELETE", `/api/comments/${commentId}`);
    },
    onMutate: async (commentId: string) => {
      await queryClient.cancelQueries({ queryKey });
      
      const previousComments = queryClient.getQueryData<CommentWithUser[]>(queryKey);
      
      queryClient.setQueryData<CommentWithUser[]>(
        queryKey,
        (old = []) => old.filter(comment => comment.id !== commentId)
      );
      
      return { previousComments };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({
        title: "Comment deleted",
        description: "Your comment has been deleted successfully.",
      });
    },
    onError: (error: any, _, context) => {
      if (context?.previousComments) {
        queryClient.setQueryData(queryKey, context.previousComments);
      }
      
      toast({
        title: "Failed to delete comment",
        description: error.message || "Unable to delete your comment. Please try again.",
        variant: "error",
      });
    },
  });

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || createCommentMutation.isPending) return;
    createCommentMutation.mutate(newComment.trim());
  };

  const handleStartEdit = (comment: CommentWithUser) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim() || updateCommentMutation.isPending) return;
    updateCommentMutation.mutate({ commentId, content: editContent.trim() });
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    deleteCommentMutation.mutate(commentId);
  };

  const getProfileImage = (comment: CommentWithUser) => {
    return comment.user.profileImageUrl || comment.user.profilePicture || undefined;
  };

  const getUserInitials = (comment: CommentWithUser) => {
    const username = comment.user.username || "User";
    return username.substring(0, 2).toUpperCase();
  };

  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return "Just now";
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "Recently";
    }
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 lg:px-6 xl:px-8">
        <div className="bg-gradient-to-br from-[#1e1e76]/30 via-[#0a0e1a]/50 to-[#1e1e76]/30 border border-[#4b4bc3]/20 rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#707ff5] to-[#4b4bc3] rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white">Comments</h3>
          </div>
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-3 border-[#707ff5]"></div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="w-full max-w-5xl mx-auto px-4 lg:px-6 xl:px-8">
        <div className="bg-gradient-to-br from-[#1e1e76]/30 via-[#0a0e1a]/50 to-[#1e1e76]/30 border border-[#4b4bc3]/20 rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#707ff5] to-[#4b4bc3] rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white">Comments</h3>
          </div>
          <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 rounded-xl">
            <AlertCircle className="h-5 w-5" />
            <AlertDescription className="text-sm sm:text-base">
              {error?.message || "Failed to load comments. Please try refreshing the page."}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto px-4 lg:px-6 xl:px-8">
      <div className="bg-gradient-to-br from-[#1e1e76]/30 via-[#0a0e1a]/50 to-[#1e1e76]/30 border border-[#4b4bc3]/20 rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 shadow-2xl shadow-[#4b4bc3]/10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-[#707ff5] to-[#4b4bc3] rounded-lg flex items-center justify-center shadow-lg">
            <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
          <h3 className="text-xl sm:text-2xl font-bold text-white">
            Comments <span className="text-[#a195f9]">({comments.length})</span>
          </h3>
        </div>

        {user ? (
          <form onSubmit={handleSubmitComment} className="mb-8">
            <div className="relative">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value.slice(0, maxLength))}
                placeholder="Share your thoughts..."
                className="min-h-[100px] sm:min-h-[120px] bg-[#0a0e1a]/60 border-[#4b4bc3]/30 text-white placeholder:text-white/40 resize-none rounded-xl focus:border-[#707ff5] focus:ring-2 focus:ring-[#707ff5]/20 transition-all text-sm sm:text-base p-3 sm:p-4"
                disabled={createCommentMutation.isPending}
              />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 mt-3">
                <span className={`text-xs sm:text-sm ${newComment.length > maxLength * 0.9 ? 'text-red-400' : 'text-white/40'}`}>
                  {newComment.length} / {maxLength}
                </span>
                <Button
                  type="submit"
                  disabled={!newComment.trim() || createCommentMutation.isPending}
                  className="w-full sm:w-auto bg-gradient-to-r from-[#707ff5] to-[#4b4bc3] hover:from-[#4b4bc3] hover:to-[#1e1e76] text-white font-semibold shadow-lg shadow-[#707ff5]/25 transition-all hover:shadow-[#707ff5]/40 rounded-xl h-10 sm:h-11 px-4 sm:px-6"
                >
                  {createCommentMutation.isPending ? (
                    <span className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Posting...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4" />
                      Post Comment
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </form>
        ) : (
          <div className="mb-8 p-4 sm:p-6 bg-[#0a0e1a]/60 border border-[#4b4bc3]/30 rounded-xl text-center">
            <p className="text-white/60 text-sm sm:text-base">Please log in to leave a comment</p>
          </div>
        )}

        <div className="space-y-4">
          {comments.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 bg-gradient-to-br from-[#707ff5]/20 to-[#4b4bc3]/20 rounded-2xl flex items-center justify-center">
                <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-[#707ff5]/40" />
              </div>
              <p className="text-lg sm:text-xl font-semibold text-white/60 mb-2">No comments yet</p>
              <p className="text-sm sm:text-base text-white/40">Be the first to share your thoughts!</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div
                key={comment.id}
                className="bg-[#0a0e1a]/40 backdrop-blur-sm border border-[#4b4bc3]/20 rounded-xl p-4 sm:p-5 hover:bg-[#0a0e1a]/60 hover:border-[#4b4bc3]/40 transition-all duration-200 shadow-lg"
              >
                <div className="flex gap-3 sm:gap-4">
                  <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-[#707ff5]/30 flex-shrink-0">
                    <AvatarImage src={getProfileImage(comment)} />
                    <AvatarFallback className="bg-gradient-to-br from-[#707ff5] to-[#4b4bc3] text-white font-semibold text-sm sm:text-base">
                      {getUserInitials(comment)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-0 mb-2 sm:mb-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-0">
                        <span className="font-semibold text-white text-sm sm:text-base">
                          {comment.user.username || "Anonymous"}
                        </span>
                        <span className="text-xs sm:text-sm text-white/40 sm:ml-2">
                          {formatTimestamp(comment.createdAt)}
                          {comment.updatedAt !== comment.createdAt && " (edited)"}
                        </span>
                      </div>

                      {user && (user.id === comment.userId || isStaffOrAbove) && (
                        <div className="flex gap-1 sm:gap-2">
                          {editingId !== comment.id && (
                            <>
                              {user.id === comment.userId && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleStartEdit(comment)}
                                  className="text-white/60 hover:text-white hover:bg-[#707ff5]/20 h-8 w-8 sm:h-9 sm:w-9 p-0"
                                >
                                  <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteComment(comment.id)}
                                disabled={deleteCommentMutation.isPending}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-8 w-8 sm:h-9 sm:w-9 p-0"
                                title={isStaffOrAbove && user.id !== comment.userId ? "Moderate as staff" : "Delete comment"}
                              >
                                <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {editingId === comment.id ? (
                      <div>
                        <Textarea
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value.slice(0, maxLength))}
                          className="min-h-[80px] bg-[#0a0e1a]/60 border-[#4b4bc3]/30 text-white mb-2 resize-none rounded-lg text-sm sm:text-base p-3"
                          disabled={updateCommentMutation.isPending}
                        />
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                          <span className={`text-xs sm:text-sm ${editContent.length > maxLength * 0.9 ? 'text-red-400' : 'text-white/40'}`}>
                            {editContent.length} / {maxLength}
                          </span>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={handleCancelEdit}
                              disabled={updateCommentMutation.isPending}
                              className="flex-1 sm:flex-none text-white/60 hover:text-white text-xs sm:text-sm"
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleSaveEdit(comment.id)}
                              disabled={!editContent.trim() || updateCommentMutation.isPending}
                              className="flex-1 sm:flex-none bg-gradient-to-r from-[#707ff5] to-[#4b4bc3] hover:from-[#4b4bc3] hover:to-[#1e1e76] text-white text-xs sm:text-sm"
                            >
                              {updateCommentMutation.isPending ? "Saving..." : "Save"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-white/80 whitespace-pre-wrap break-words leading-relaxed text-sm sm:text-base">
                        {comment.content}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// PERFORMANCE: Export memoized version to prevent unnecessary re-renders
export default memo(CommentSection);
