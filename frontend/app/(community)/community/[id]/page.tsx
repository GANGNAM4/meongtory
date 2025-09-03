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
import { toast } from "react-hot-toast";
import { Badge } from "@/components/ui/badge";

interface CommunityPost {
  id: number;
  title: string;
  content: string;
  author: string;
  date: string;
  category: string;
  boardType: "자유게시판" | "멍스타그램" | "꿀팁게시판" | "QNA";
  views: number;
  likes: number;
  comments: number;
  tags: string[];
  images?: string[];
  ownerEmail: string;
  sharedFromDiaryId?: number;
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
  const [editedBoardType, setEditedBoardType] = useState<"자유게시판" | "멍스타그램" | "꿀팁게시판" | "Q&A">("자유게시판");
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
  const [isUploading, setIsUploading] = useState(false);
  const [isCommentUploading, setIsCommentUploading] = useState(false);
  const [isCommentUpdating, setIsCommentUpdating] = useState(false);

  // Q&A -> QNA 변환 함수
  const convertBoardTypeForAPI = (boardType: string): string => {
    return boardType === "Q&A" ? "QNA" : boardType;
  };

  // QNA -> Q&A 변환 함수
  const convertBoardTypeForDisplay = (boardType: string): string => {
    return boardType === "QNA" ? "Q&A" : boardType;
  };

  const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem("accessToken");
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

      const response = await axios.post(`${getBackendUrl()}/api/accounts/refresh`, {
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
        const response = await axios.get(`${getBackendUrl()}/api/accounts/me`, {
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
                             const retryResponse = await axios.get(`${getBackendUrl()}/api/accounts/me`, {
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
  }, [getBackendUrl(), postId]);

  useEffect(() => {
    if (!initialPost && postId) {
      const fetchPost = async () => {
        try {
          setIsLoading(true);
          setError(null);
          const response = await axios.get(`${getBackendUrl()}/api/community/posts/${postId}`, {
            headers: getAuthHeaders(),
          });
          setPost(response.data);
          setEditedTitle(response.data.title);
          setEditedContent(response.data.content);
          setEditedBoardType(convertBoardTypeForDisplay(response.data.boardType) as "자유게시판" | "멍스타그램" | "꿀팁게시판" | "Q&A");
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
      setEditedBoardType(convertBoardTypeForDisplay(initialPost.boardType) as "자유게시판" | "멍스타그램" | "꿀팁게시판" | "Q&A");
      setPreviewImages(initialPost.images || []);
    }
  }, [initialPost, postId, getBackendUrl()]);

  useEffect(() => {
    if (postId && !isEditing) {
      axios.get(`${getBackendUrl()}/api/community/comments/${postId}`, {
        headers: getAuthHeaders(),
      })
        .then((response) => {
          setComments(response.data);
        })
        .catch((err) => console.error("댓글 불러오기 실패:", err));
    }
  }, [postId, getBackendUrl(), isEditing]);

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    if (isCommentUploading) return; // 중복 방지
    
    setIsCommentUploading(true);
    try {
      const response = await axios.post(`${getBackendUrl()}/api/community/comments/${postId}`, 
        { content: newComment },
        {
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );
      setComments([...comments, response.data]);
      // 댓글 갯수 실시간 업데이트
      if (post) {
        setPost({ ...post, comments: post.comments + 1 });
      }
      setNewComment("");
    } catch (error: any) {
      console.error("Add comment error:", error);
      console.error("Error type:", typeof error);
      console.error("Error message:", error.message);
      console.error("Error response:", error.response);
      console.error("Error response data:", error.response?.data);
      console.error("Error response status:", error.response?.status);
      
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 400) {
          // JSON 메시지 제대로 읽어서 토스트 띄우기
          const msg = error.response.data?.message || "🚫 비속어를 사용하지 말아주세요.";
          console.log("Toast message:", msg);
          toast.error(msg);
        } else {
          toast.error("댓글 등록 중 오류가 발생했습니다 ❌");
        }
      } else {
        toast.error("네트워크 오류 ❌");
      }
    } finally {
      setIsCommentUploading(false);
    }
  };

  const handleUpdateComment = async (id: number) => {
    if (isCommentUpdating) return; // 중복 방지
    
    setIsCommentUpdating(true);
    try {
      const response = await axios.put(`${getBackendUrl()}/api/community/comments/${id}`, 
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
    } catch (error: any) {
      console.error("Update comment error:", error);
      console.error("Error type:", typeof error);
      console.error("Error message:", error.message);
      console.error("Error response:", error.response);
      console.error("Error response data:", error.response?.data);
      console.error("Error response status:", error.response?.status);
      
      if (axios.isAxiosError(error) && error.response) {
        if (error.response.status === 400) {
          // JSON 메시지 제대로 읽어서 토스트 띄우기
          const msg = error.response.data?.message || "🚫 비속어를 사용하지 말아주세요.";
          console.log("Toast message:", msg);
          toast.error(msg);
        } else {
          toast.error("댓글 수정 중 오류가 발생했습니다 ❌");
        }
      } else {
        toast.error("네트워크 오류 ❌");
      }
    } finally {
      setIsCommentUpdating(false);
    }
  };

  const handleDeleteComment = async (id: number) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;
    try {
      await axios.delete(`${getBackendUrl()}/api/community/comments/${id}`, {
        headers: getAuthHeaders(),
      });
      setComments(comments.filter((c) => c.id !== id));
      // 댓글 갯수 실시간 업데이트
      if (post) {
        setPost({ ...post, comments: Math.max(0, post.comments - 1) });
      }
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
    if (isUploading) return; // 중복 방지
    
    setIsUploading(true);
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
        boardType: convertBoardTypeForAPI(editedBoardType),
        tags: post.tags,
        imagesToDelete,
      };
      formData.append("dto", new Blob([JSON.stringify(dto)], { type: "application/json" }));

      editedImages.forEach((file) => {
        formData.append("postImg", file);
      });

      let response;
      try {
        response = await axios.put(`${getBackendUrl()}/api/community/posts/${post.id}`, formData, {
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
            response = await axios.put(`${getBackendUrl()}/api/community/posts/${post.id}`, formData, {
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

      // 수정 성공 후 최신 글 다시 불러오기
      const res = await axios.get(`${getBackendUrl()}/api/community/posts/${post.id}`, {
        headers: { Access_Token: token },
      });
      
      const latestPost = res.data;
      setPost(latestPost);
      
      // 편집 상태 초기화
      setEditedTitle(latestPost.title);
      setEditedContent(latestPost.content);
      setEditedBoardType(convertBoardTypeForDisplay(latestPost.boardType) as "자유게시판" | "멍스타그램" | "꿀팁게시판" | "Q&A");
      setPreviewImages(latestPost.images || []);
      setEditedImages([]);
      
      if (onUpdatePost) onUpdatePost(latestPost);
      setIsEditing(false);
      setImagesToDelete([]);
      
      toast.success("게시글이 수정되었습니다 ");
      router.push(`/community/${post.id}`);
    } catch (err: any) {
      console.error("Edit error:", err.message);
      // 비속어 필터링 에러 처리
      if (err.response?.status === 400) {
        const msg = err.response?.data?.message || "🚫 비속어를 사용하지 말아주세요.";
        toast.error(msg);
      } else {
        const errorMessage = err.response?.data?.message || err.message || "게시글 수정 실패";
        alert("게시글 수정 중 오류: " + errorMessage);
      }
    } finally {
      setIsUploading(false);
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
        response = await axios.delete(`${getBackendUrl()}/api/community/posts/${post.id}`, {
          headers: { Access_Token: token },
        });
      } catch (err: any) {
        if (err.response?.status === 401) {
          console.log("401 Unauthorized, attempting to refresh token");
          token = await refreshToken();
          if (token) {
            response = await axios.delete(`${getBackendUrl()}/api/community/posts/${post.id}`, {
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
        <Button variant="outline" onClick={() => {
          // 브라우저 히스토리가 있으면 뒤로가기, 없으면 커뮤니티 목록으로
          if (window.history.length > 1) {
            router.back();
          } else {
            router.push("/community");
          }
        }} className="mt-4">
          <ChevronLeft className="h-4 w-4 mr-2" /> 뒤로가기
        </Button>
      </div>
    );
  }

  const canEditOrDelete =
    post.ownerEmail &&
    currentUserEmail &&
    (currentUserEmail === post.ownerEmail || currentUserRole === "ROLE_ADMIN");

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => {
              // 브라우저 히스토리가 있으면 뒤로가기, 없으면 커뮤니티 목록으로
              if (window.history.length > 1) {
                router.back();
              } else {
                router.push("/community");
              }
            }} className="p-2">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">커뮤니티</h1>
          </div>
        </div>

        <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-sm">
          {isEditing ? (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">제목</label>
                <Input 
                  value={editedTitle} 
                  onChange={(e) => setEditedTitle(e.target.value)}
                  placeholder="게시글 제목을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">카테고리</label>
                <select
                  value={editedBoardType}
                  onChange={(e) => setEditedBoardType(e.target.value as "자유게시판" | "멍스타그램" | "꿀팁게시판" | "Q&A")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent"
                >
                  <option value="자유게시판">자유게시판 (잡담/소통)</option>
                  <option value="멍스타그램">멍스타그램 (사진/일상 공유)</option>
                  <option value="꿀팁게시판">꿀팁게시판 (정보/후기 공유)</option>
                  <option value="Q&A">Q&A (질문/답변)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">내용</label>
                <Textarea 
                  value={editedContent} 
                  onChange={(e) => setEditedContent(e.target.value)} 
                  rows={8}
                  placeholder="게시글 내용을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">이미지</label>
                <Input type="file" multiple accept="image/*" onChange={handleImageUpload} />
                <div className="flex flex-wrap gap-2 mt-2">
                  {previewImages.map((src, idx) => (
                    <div key={idx} className="relative w-24 h-24">
                      <Image src={src} alt={`preview-${idx}`} fill className="object-cover rounded-md" />
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
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="w-4 h-4 mr-2" />취소
                </Button>
                <Button 
                  onClick={handleEditSave} 
                  disabled={isUploading}
                  className={`flex items-center gap-2 ${
                    isUploading 
                      ? "opacity-50 cursor-not-allowed bg-gray-400" 
                      : "bg-yellow-400 hover:bg-yellow-500 text-black"
                  }`}
                >
                  {isUploading && (
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      ></path>
                    </svg>
                  )}
                  {isUploading ? "업로드 중..." : (
                    <>
                      <Check className="w-4 h-4" />
                      저장
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {/* 상단 */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={post.boardType === "QNA" ? "default" : "secondary"}>
                      {convertBoardTypeForDisplay(post.boardType)}
                    </Badge>
                    {post.sharedFromDiaryId && (
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                        🐾 성장일기 공유
                      </Badge>
                    )}
                  </div>
                  <h1 className="text-xl font-bold mb-1">{post.title}</h1>
                  <p className="text-sm text-gray-500">{post.author} · {post.date}</p>
                </div>
                {canEditOrDelete && (
                  <div className="flex gap-2">
                    <button
                      onClick={handleEdit}
                      className="flex items-center gap-1 border px-3 py-1 rounded-md text-sm text-gray-700 hover:bg-gray-50"
                    >
                      <Edit size={16} />
                      수정
                    </button>
                    <button
                      onClick={() => {
                        console.log("Delete button clicked, postId:", post.id);
                        setShowDeleteConfirm(true);
                      }}
                      className="flex items-center gap-1 border px-3 py-1 rounded-md text-sm text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={16} />
                      삭제
                    </button>
                  </div>
                )}
              </div>

              {/* 본문 */}
              {post.images && post.images.length > 0 && (
                <Image
                  src={post.images[0]}
                  alt="게시글 이미지"
                  width={400}
                  height={300}
                  className="mx-auto rounded-md shadow-sm mb-4"
                />
              )}
              <p className="text-gray-700 leading-relaxed">{post.content}</p>
            </div>
          )}
        </div>

        {!isEditing && (
          <div className="max-w-3xl mx-auto bg-white p-6 rounded-lg shadow-sm mt-6">
            <h3 className="font-semibold border-b pb-2 mb-4">댓글 💬 {post.comments}</h3>
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="댓글을 입력하세요"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleAddComment}
                disabled={isCommentUploading}
                className={`flex items-center gap-2 ${
                  isCommentUploading 
                    ? "opacity-50 cursor-not-allowed bg-gray-400" 
                    : "bg-yellow-400 hover:bg-yellow-500 text-black"
                }`}
              >
                {isCommentUploading && (
                  <svg
                    className="animate-spin h-4 w-4 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                    ></path>
                  </svg>
                )}
                {isCommentUploading ? "업로드 중..." : "등록"}
              </Button>
            </div>

            <div className="space-y-3">
              {comments.map((c) => {
                const canModify = currentUserEmail === c.ownerEmail || currentUserRole === "ROLE_ADMIN";
                const isMeongtory = c.author === "Meongtory";
                return (
                  <div key={c.id} className={`p-4 rounded-md ${isMeongtory ? 'bg-blue-50 border-l-4 border-blue-400' : 'bg-gray-50'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <p className={`font-medium ${isMeongtory ? 'text-blue-900' : 'text-gray-900'}`}>
                          {c.author || "익명"}
                        </p>
                        {isMeongtory && (
                          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-1 rounded-full">
                            🐾 Meongtory
                          </span>
                        )}
                      </div>
                      {canModify && !isMeongtory && (
                        <div className="flex gap-2">
                          <button
                            className="border px-2 py-1 text-xs rounded-md text-gray-700 hover:bg-gray-100"
                            onClick={() => {
                              setEditingId(c.id);
                              setEditContent(c.content);
                            }}
                          >
                            수정
                          </button>
                          <button 
                            className="border px-2 py-1 text-xs rounded-md text-red-500 hover:bg-red-50"
                            onClick={() => handleDeleteComment(c.id)}
                          >
                            삭제
                          </button>
                        </div>
                      )}
                    </div>

                    {editingId === c.id ? (
                      <div className="space-y-2">
                        <Textarea 
                          value={editContent} 
                          onChange={(e) => setEditContent(e.target.value)}
                          className="w-full"
                        />
                        <div className="flex gap-2">
                          <Button 
                            size="sm" 
                            onClick={() => handleUpdateComment(c.id)}
                            disabled={isCommentUpdating}
                            className={`flex items-center gap-1 ${
                              isCommentUpdating 
                                ? "opacity-50 cursor-not-allowed bg-gray-400" 
                                : "bg-yellow-400 hover:bg-yellow-500 text-black"
                            }`}
                          >
                            {isCommentUpdating && (
                              <svg
                                className="animate-spin h-3 w-3 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                                ></path>
                              </svg>
                            )}
                            {isCommentUpdating ? "저장 중..." : "저장"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setEditingId(null)}
                          >
                            취소
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-700 mb-1">{c.content}</p>
                    )}

                    <p className="text-xs text-gray-400">{c.createdAt}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-bold mb-4">게시글 삭제</h3>
              <p className="text-gray-600 mb-6">정말 삭제하시겠습니까? 복구할 수 없습니다.</p>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>취소</Button>
                <Button onClick={handleDelete} className="bg-red-600 text-white">삭제</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}