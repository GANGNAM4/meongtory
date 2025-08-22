"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getBackendUrl } from "@/lib/api";
import { Edit, Trash2, X, ChevronLeft, Check } from "lucide-react";
import { useRouter, useSearchParams, useParams } from "next/navigation";
import axios from "axios";

interface CommunityPost {
  id: number;
  title: string;
  content: string;
  author: string;
  date: string;
  category: string;
  boardType: "Q&A" | "자유게시판";
  views: number;
  likes: number;
  comments: number;
  tags: string[];
  images?: string[];
  ownerEmail: string;
}

interface Comment {
  id: number;
  postId: number;
  author: string;
  ownerEmail: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export default function CommunityDetailPage({
  post: initialPost,
  onUpdatePost,
  onDeletePost,
}: {
  post?: CommunityPost | null;
  onUpdatePost?: (updatedPost: CommunityPost) => void;
  onDeletePost: (postId: number) => void;
}) {
  const API_BASE_URL = getBackendUrl();
  const router = useRouter();
  const searchParams = useSearchParams();
  const params = useParams();
  const isEditingFromQuery = searchParams.get("edit") === "true";
  const postId = params.id as string;

  const [post, setPost] = useState<CommunityPost | null>(initialPost || null);
  const [isLoading, setIsLoading] = useState(!initialPost);
  const [isEditing, setIsEditing] = useState(isEditingFromQuery);
  const [editedTitle, setEditedTitle] = useState("");
  const [editedContent, setEditedContent] = useState("");
  const [editedImages, setEditedImages] = useState<File[]>([]);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [imagesToDelete, setImagesToDelete] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("accessToken");
    console.log("Access Token:", token);
    return token ? { Access_Token: token } : {};
  };

  const refreshToken = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      console.log("Refresh Token:", refreshToken);
      if (!refreshToken) {
        console.warn("No refresh token found");
        return null;
      }

      const response = await axios.post(`${API_BASE_URL}/api/accounts/refresh`, {
        refreshToken: refreshToken
      });

      console.log("Refresh token response:", response.data);

      if (response.data.data && response.data.data.accessToken) {
        localStorage.setItem("accessToken", response.data.data.accessToken);
        console.log("Token refreshed:", response.data.data.accessToken);
        return response.data.data.accessToken;
      } else {
        console.error("Refresh token error response:", response.data);
        console.warn("Token refresh failed, but keeping existing token");
        return null;
      }
    } catch (err) {
      console.error("Refresh token error:", err);
      console.warn("Token refresh error, but keeping existing token");
      return null;
    }
  };

  useEffect(() => {
    console.log("canEditOrDelete:", {
      postOwnerEmail: post?.ownerEmail,
      currentUserEmail,
      currentUserRole,
    });
    const fetchUserInfo = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        console.log("Access Token for /api/accounts/me:", token);
        
        if (!token) {
          console.warn("No access token found - user not logged in");
          setCurrentUserEmail(null);
          setCurrentUserRole(null);
          return;
        }
        const response = await axios.get(`${API_BASE_URL}/api/accounts/me`, {
          headers: { Access_Token: localStorage.getItem("accessToken") || "" }
        });
        
        
        console.log("User info response:", response.data);

        if (response.data.success && response.data.data) {
          setCurrentUserEmail(response.data.data.email);
          setCurrentUserRole(response.data.data.role);
          localStorage.setItem("email", response.data.data.email);
          console.log("User info set:", { email: response.data.data.email, role: response.data.data.role });
        } else {
          console.error("User info fetch failed:", response.data.error);
          setCurrentUserEmail(null);
          setCurrentUserRole(null);
        }
      } catch (err: any) {
        console.error("Fetch user info error:", err);
        if (err.response?.status === 401) {
          console.warn("Token expired or invalid - attempting to refresh");
          const newToken = await refreshToken();
          if (newToken) {
            try {
                             const retryResponse = await axios.get(`${API_BASE_URL}/api/accounts/me`, {
                 headers: { Access_Token: newToken },
                 withCredentials: true,
               });
              console.log("Retry user info response:", retryResponse.data);
              
              if (retryResponse.data.success && retryResponse.data.data) {
                setCurrentUserEmail(retryResponse.data.data.email);
                setCurrentUserRole(retryResponse.data.data.role);
                localStorage.setItem("email", retryResponse.data.data.email);
                console.log("User info set after refresh:", { email: retryResponse.data.data.email, role: retryResponse.data.data.role });
              } else {
                console.error("Retry failed:", retryResponse.data);
                setCurrentUserEmail(null);
                setCurrentUserRole(null);
              }
            } catch (retryErr) {
              console.error("Retry failed:", retryErr);
              setCurrentUserEmail(null);
              setCurrentUserRole(null);
            }
          } else {
            setCurrentUserEmail(null);
            setCurrentUserRole(null);
          }
        } else {
          setCurrentUserEmail(null);
          setCurrentUserRole(null);
        }
      }
    };

    if (postId) {
      fetchUserInfo();
    }
  }, [API_BASE_URL, postId]);

  useEffect(() => {
    if (!initialPost && postId) {
      const fetchPost = async () => {
        try {
          setIsLoading(true);
          setError(null);
          const response = await axios.get(`${API_BASE_URL}/api/community/posts/${postId}`, {
            headers: getAuthHeaders(),
          });
          setPost(response.data);
          setEditedTitle(response.data.title);
          setEditedContent(response.data.content);
          setPreviewImages(response.data.images || []);
        } catch (err: any) {
          const errorMessage = err.response?.data?.message || err.message || "알 수 없는 오류";
          setError(`게시글 로드 실패: ${errorMessage}`);
          setPost(null);
        } finally {
          setIsLoading(false);
        }
      };
      fetchPost();
    } else if (initialPost) {
      setEditedTitle(initialPost.title);
      setEditedContent(initialPost.content);
      setPreviewImages(initialPost.images || []);
    }
  }, [initialPost, postId, API_BASE_URL]);

  useEffect(() => {
    if (postId && !isEditing) {
      axios.get(`${API_BASE_URL}/api/community/comments/${postId}`, {
        headers: getAuthHeaders(),
      })
        .then((response) => {
          setComments(response.data);
        })
        .catch((err) => console.error("댓글 불러오기 실패:", err));
    }
  }, [postId, API_BASE_URL, isEditing]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const response = await axios.post(`${API_BASE_URL}/api/community/comments/${postId}`, 
        { content: newComment },
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );
      setComments([...comments, response.data]);
      setNewComment("");
    } catch (err: any) {
      console.error("Add comment error:", err);
      const errorMessage = err.response?.data?.message || "댓글 작성 실패";
      alert(errorMessage);
    }
  };

  const handleUpdateComment = async (id: number) => {
    try {
      const response = await axios.put(`${API_BASE_URL}/api/community/comments/${id}`, 
        { content: editContent },
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );
      setComments(comments.map((c) => (c.id === id ? response.data : c)));
      setEditingId(null);
    } catch (err: any) {
      console.error("Update comment error:", err);
      const errorMessage = err.response?.data?.message || "댓글 수정 실패";
      alert(errorMessage);
    }
  };

  const handleDeleteComment = async (id: number) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      await axios.delete(`${API_BASE_URL}/api/community/comments/${id}`, {
        headers: getAuthHeaders(),
      });
      setComments(comments.filter((c) => c.id !== id));
    } catch (err: any) {
      console.error("Delete comment error:", err);
      const errorMessage = err.response?.data?.message || "댓글 삭제 실패";
      alert(errorMessage);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setEditedImages((prev) => [...prev, ...filesArray]);
      const newPreviews = filesArray.map((file) => URL.createObjectURL(file));
      setPreviewImages((prev) => [...prev, ...newPreviews]);
    }
  };

  const handleRemoveImage = (index: number) => {
    const removedImage = previewImages[index];
    if (removedImage.startsWith("http")) {
      const fileName = removedImage.split("/").pop() || "";
      setImagesToDelete((prev) => [...prev, fileName]);
    }
    setPreviewImages((prev) => prev.filter((_, i) => i !== index));
    setEditedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleEditSave = async () => {
    if (!post) return;
    try {
      let token = localStorage.getItem("accessToken");
      console.log("Access Token for Edit:", token);
      if (!token) {
        throw new Error("No access token found");
      }

      const formData = new FormData();
      const dto = {
        title: editedTitle,
        content: editedContent,
        category: post.category,
        boardType: post.boardType,
        tags: post.tags,
        imagesToDelete,
      };
      formData.append("dto", new Blob([JSON.stringify(dto)], { type: "application/json" }));

      editedImages.forEach((file) => {
        formData.append("postImg", file);
      });

      let response;
      try {
        response = await axios.put(`${API_BASE_URL}/api/community/posts/${post.id}`, formData, {
          headers: { 
            Access_Token: token,
            "Content-Type": "multipart/form-data",
          },
        });
      } catch (err: any) {
        if (err.response?.status === 401) {
          console.log("401 Unauthorized, attempting to refresh token");
          token = await refreshToken();
          if (token) {
            response = await axios.put(`${API_BASE_URL}/api/community/posts/${post.id}`, formData, {
              headers: { 
                Access_Token: token,
                "Content-Type": "multipart/form-data",
              },
            });
          } else {
            alert("인증이 만료되었습니다. 다시 로그인해주세요.");
            router.push("/");
            return;
          }
        } else {
          throw err;
        }
      }

      const updatedPost = response.data;
      setPost({
        ...post,
        title: updatedPost.title,
        content: updatedPost.content,
        images: updatedPost.images || [],
      });
      if (onUpdatePost) onUpdatePost(updatedPost);
      setIsEditing(false);
      setImagesToDelete([]);
      router.push(`/community/${post.id}`);
    } catch (err: any) {
      console.error("Edit error:", err.message);
      const errorMessage = err.response?.data?.message || err.message || "게시글 수정 실패";
      alert("게시글 수정 중 오류: " + errorMessage);
    }
  };

  const handleEdit = () => {
    if (!post) return;
    setIsEditing(true);
    router.push(`/community/${post.id}?edit=true`, { scroll: false });
  };

  const handleDelete = async () => {
    if (!post) return;
    try {
      let token = localStorage.getItem("accessToken");
      console.log("Access Token for Delete:", token);
      if (!token) {
        throw new Error("No access token found");
      }

      let response;
      try {
        response = await axios.delete(`${API_BASE_URL}/api/community/posts/${post.id}`, {
          headers: { Access_Token: token },
        });
      } catch (err: any) {
        if (err.response?.status === 401) {
          console.log("401 Unauthorized, attempting to refresh token");
          token = await refreshToken();
          if (token) {
            response = await axios.delete(`${API_BASE_URL}/api/community/posts/${post.id}`, {
              headers: { Access_Token: token },
            });
          } else {
            alert("인증이 만료되었습니다. 다시 로그인해주세요.");
            router.push("/");
            return;
          }
        } else {
          throw err;
        }
      }

      alert("게시글이 삭제되었습니다.");
      if (onDeletePost) onDeletePost(post.id);
      router.push("/community");
    } catch (err: any) {
      console.error("Delete error:", err.message);
      const errorMessage = err.response?.data?.message || err.message || "게시글 삭제 실패";
      alert("게시글 삭제 오류: " + errorMessage);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-center text-gray-500">게시글을 불러오는 중...</div>;
  }

  if (!post || error) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>{error || "게시글을 불러올 수 없습니다."}</p>
        <Button variant="outline" onClick={() => router.push("/community")} className="mt-4">
          <ChevronLeft className="h-4 w-4 mr-2" /> 뒤로가기
        </Button>
      </div>
    );
  }

  const canEditOrDelete =
    post.ownerEmail &&
    currentUserEmail &&
    (currentUserEmail === post.ownerEmail || currentUserRole === "ROLE_ADMIN");

  // 디버깅을 위한 로그
  console.log("canEditOrDelete check:", {
    postOwnerEmail: post.ownerEmail,
    currentUserEmail,
    currentUserRole,
    canEditOrDelete,
    isOwner: currentUserEmail === post.ownerEmail,
    isAdmin: currentUserRole === "ROLE_ADMIN"
  });

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" onClick={() => router.push("/community")}>
          <ChevronLeft className="h-4 w-4 mr-2" /> 뒤로가기
        </Button>

        {canEditOrDelete && (
          <div className="flex gap-2">
            {!isEditing && (
              <Button variant="outline" size="icon" onClick={handleEdit}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="destructive"
              size="icon"
              onClick={() => {
                console.log("Delete button clicked, postId:", post.id);
                setShowDeleteConfirm(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <Input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} />
          <Textarea value={editedContent} onChange={(e) => setEditedContent(e.target.value)} rows={6} />
          <Input type="file" multiple accept="image/*" onChange={handleImageUpload} />
          <div className="flex flex-wrap gap-2 mt-2">
            {previewImages.map((src, idx) => (
              <div key={idx} className="relative w-24 h-24">
                <Image src={src} alt={`preview-${idx}`} fill className="object-cover rounded" />
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1"
                  onClick={() => handleRemoveImage(idx)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleEditSave} className="bg-green-500 text-white">
              <Check className="h-4 w-4 mr-1" /> 저장
            </Button>
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <h1 className="text-2xl font-bold">{post.title}</h1>
          <p className="mt-2">{post.content}</p>
          {post.images && post.images.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {post.images.map((src, idx) => (
                <Image
                  key={idx}
                  src={src}
                  alt={`post-img-${idx}`}
                  width={200}
                  height={150}
                  className="rounded"
                />
              ))}
            </div>
          )}
        </div>
      )}

      {!isEditing && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4">댓글</h3>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="댓글을 입력하세요"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
            />
            <Button onClick={handleAddComment}>등록</Button>
          </div>

          <div className="space-y-4">
            {comments.map((c) => {
              const canModify = currentUserEmail === c.ownerEmail || currentUserRole === "ROLE_ADMIN";
              return (
                <div key={c.id} className="border-b pb-2">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{c.author || "익명"}</p>
                    {canModify && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(c.id);
                            setEditContent(c.content);
                          }}
                        >
                          수정
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDeleteComment(c.id)}>
                          삭제
                        </Button>
                      </div>
                    )}
                  </div>

                  {editingId === c.id ? (
                    <div className="flex gap-2 mt-2">
                      <Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} />
                      <Button size="sm" onClick={() => handleUpdateComment(c.id)}>
                        저장
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditingId(null)}>
                        취소
                      </Button>
                    </div>
                  ) : (
                    <p className="mt-1">{c.content}</p>
                  )}

                  <p className="text-sm text-gray-500">{c.createdAt}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="mt-4 p-4 border rounded bg-red-50">
          <p>정말로 삭제하시겠습니까?</p>
          <div className="flex gap-2 mt-2">
            <Button variant="destructive" onClick={handleDelete}>
              삭제
            </Button>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              취소
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}