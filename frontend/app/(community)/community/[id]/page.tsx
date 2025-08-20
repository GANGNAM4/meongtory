"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getApiBaseUrl } from "@/lib/utils/apiBaseUrl";
import { Edit, Trash2, X, ChevronLeft, Check } from "lucide-react";
import { useRouter, useSearchParams, useParams } from "next/navigation";

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

interface CommunityDetailPageProps {
  post?: CommunityPost | null;
  onBack: () => void;
  onUpdatePost: (updatedPost: CommunityPost) => void;
  onDeletePost: (postId: number) => void;
  currentUserEmail?: string;
  currentUserRole?: string;
}

export default function CommunityDetailPage({
  post: initialPost,
  onBack,
  onUpdatePost,
  onDeletePost,
  currentUserEmail: propUserEmail,
  currentUserRole: propUserRole,
}: CommunityDetailPageProps) {
  const API_BASE_URL = getApiBaseUrl();
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
  const [currentUserEmail, setCurrentUserEmail] = useState<string | undefined>(propUserEmail);
  const [currentUserRole, setCurrentUserRole] = useState<string | undefined>(propUserRole);

  // 사용자 정보 가져오기
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) {
          console.log("No access token found");
          setCurrentUserEmail(undefined);
          setCurrentUserRole(undefined);
          return;
        }
        const res = await fetch(`${API_BASE_URL}/api/accounts/me`, {
          headers: { Access_Token: token },
        });
        if (!res.ok) throw new Error(`사용자 정보 로드 실패 (${res.status})`);
        const response = await res.json();
        console.log("Fetched User Data:", response);
        if (response.status === "success" && response.data) {
          setCurrentUserEmail(response.data.email);
          setCurrentUserRole(response.data.role);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err: any) {
        console.error("사용자 정보 로드 에러:", err.message);
        setCurrentUserEmail(undefined);
        setCurrentUserRole(undefined);
      }
    };

    if (!propUserEmail && !propUserRole) {
      fetchUserInfo();
    }
  }, [propUserEmail, propUserRole]);

  // 게시글 데이터 가져오기
  useEffect(() => {
    if (!initialPost && postId) {
      const fetchPost = async () => {
        try {
          setIsLoading(true);
          setError(null);
          const res = await fetch(`${API_BASE_URL}/api/community/posts/${postId}`, {
            headers: getAuthHeaders(),
          });
          console.log("API Response Status:", res.status);
          if (!res.ok) throw new Error(`게시글 로드 실패 (${res.status})`);
          const data: CommunityPost = await res.json();
          console.log("Fetched Post:", data);
          setPost(data);
          setEditedTitle(data.title);
          setEditedContent(data.content);
          setPreviewImages(data.images || []);
        } catch (err: any) {
          console.error("게시글 로드 에러:", err.message);
          setError(err.message || "게시글을 불러오는 중 오류가 발생했습니다.");
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
  }, [initialPost, postId]);

  const getAuthHeaders = (): HeadersInit => {
    const token = localStorage.getItem("accessToken");
    console.log("Access Token:", token);
    return token ? { Access_Token: token } : {};
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
    if (!post) {
      alert("게시글 데이터가 없습니다.");
      return;
    }
    try {
      const formData = new FormData();
      const dto = {
        title: editedTitle,
        content: editedContent,
        category: post.category,
        boardType: post.boardType,
        tags: post.tags,
        imagesToDelete,
        ownerEmail: post.ownerEmail,
      };
      formData.append("dto", new Blob([JSON.stringify(dto)], { type: "application/json" }));

      editedImages.forEach((file) => {
        formData.append("postImg", file);
      });

      const res = await fetch(`${API_BASE_URL}/api/community/posts/${post.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!res.ok) throw new Error(`게시글 수정 실패 (${res.status})`);

      const updatedPost = await res.json();
      onUpdatePost({
        ...post,
        title: updatedPost.title,
        content: updatedPost.content,
        images: updatedPost.images || [],
      });
      setIsEditing(false);
      setImagesToDelete([]);
      router.push(`/community/${post.id}`); // 수정 후 쿼리 파라미터 제거
    } catch (err: any) {
      console.error("게시글 수정 에러:", err.message);
      alert("게시글 수정 중 오류가 발생했습니다: " + err.message);
    }
  };

  const handleDelete = async () => {
    if (!post) {
      alert("게시글 데이터가 없습니다.");
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/community/posts/${post.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!res.ok) throw new Error(`게시글 삭제 실패 (${res.status})`);

      onDeletePost(post.id);
      onBack();
    } catch (err: any) {
      console.error("게시글 삭제 에러:", err.message);
      alert("게시글 삭제 중 오류가 발생했습니다: " + err.message);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>게시글을 불러오는 중...</p>
      </div>
    );
  }

  if (!post || error) {
    return (
      <div className="p-4 text-center text-gray-500">
        <p>{error || "게시글을 불러올 수 없습니다."}</p>
        <Button variant="outline" onClick={onBack} className="mt-4">
          <ChevronLeft className="h-4 w-4 mr-2" /> 뒤로가기
        </Button>
      </div>
    );
  }

  const canEditOrDelete =
    currentUserEmail &&
    post.ownerEmail &&
    (currentUserEmail === post.ownerEmail || currentUserRole === "ADMIN");

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-2" /> 뒤로가기
        </Button>

        {canEditOrDelete && (
          <div className="flex gap-2">
            {!isEditing && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => router.push(`/community/${post.id}?edit=true`)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="destructive"
              size="icon"
              onClick={() => setShowDeleteConfirm(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <Input value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)} />
          <Textarea
            value={editedContent}
            onChange={(e) => setEditedContent(e.target.value)}
            rows={6}
          />
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