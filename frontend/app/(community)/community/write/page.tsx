"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ImageIcon, X } from "lucide-react";
import { getApiBaseUrl } from "../../../../lib/utils/apiBaseUrl";

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
  ownerEmail?: string;
}

interface CommunityWritePageProps {
  onBack: () => void;
  onSubmit: (postData: CommunityPost) => void;
}

export default function CommunityWritePage({
  onBack,
  onSubmit,
}: CommunityWritePageProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const boardType: "Q&A" | "자유게시판" = "자유게시판";
  const [images, setImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const router = useRouter();
  const API_BASE_URL = getApiBaseUrl();

  // 로그인 사용자 이메일 로드
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const token = localStorage.getItem("accessToken");
        if (!token) {
          setError("로그인이 필요합니다.");
          setCurrentUserEmail("");
          return;
        }
        const res = await fetch(`${API_BASE_URL}/api/accounts/me`, {
          headers: { Access_Token: token },
        });
        if (!res.ok) throw new Error(`사용자 정보 로드 실패 (${res.status})`);
        const response = await res.json();
        console.log("Fetched User Data:", response);
        
        // 응답 구조에 따라 email 추출
        let email = "";
        if (response.success && response.data) {
          // 예상 구조: { success: true, data: { email: string, role: string } }
          // 또는: { success: true, data: { user: { email: string, role: string } } }
          email = response.data.email || response.data.user?.email || "";
          if (!email) {
            throw new Error("Email field not found in response data");
          }
          setCurrentUserEmail(email);
        } else {
          throw new Error("Invalid response format");
        }
      } catch (err: any) {
        console.error("사용자 정보 로드 에러:", err.message);
        setError("사용자 정보를 불러오는 중 오류가 발생했습니다: " + err.message);
        setCurrentUserEmail("");
      }
    };

    fetchUserInfo();
  }, []);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      setImageFiles((prev) => [...prev, ...filesArray]);
      const newImageUrls = filesArray.map((file) => URL.createObjectURL(file));
      setImages((prev) => [...prev, ...newImageUrls]);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
    setImageFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 모두 입력해주세요.");
      return;
    }

    if (!currentUserEmail) {
      setError("로그인이 필요합니다.");
      return;
    }

    try {
      const token = localStorage.getItem("accessToken");
      if (!token) {
        setError("로그인이 필요합니다.");
        return;
      }

      const formData = new FormData();
      const dto = {
        title,
        content,
        category: "일반",
        boardType,
        tags: [],
        ownerEmail: currentUserEmail,
      };

      formData.append(
        "dto",
        new Blob([JSON.stringify(dto)], { type: "application/json" })
      );

      imageFiles.forEach((file) => {
        formData.append("postImg", file);
      });

      const res = await fetch(`${API_BASE_URL}/api/community/posts/create`, {
        method: "POST",
        headers: { Access_Token: token },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(
          `게시글 작성 실패: ${errorData.error || res.statusText}`
        );
      }

      const savedPost = await res.json();
      console.log("Saved Post:", savedPost);

      // CommunityPost 인터페이스에 맞게 데이터 변환
      const newPost: CommunityPost = {
        id: savedPost.id,
        title: savedPost.title,
        content: savedPost.content,
        author: savedPost.author || currentUserEmail,
        date: savedPost.createdAt || new Date().toISOString(),
        category: savedPost.category,
        boardType: savedPost.boardType,
        views: savedPost.views || 0,
        likes: savedPost.likes || 0,
        comments: savedPost.comments || 0,
        tags: savedPost.tags || [],
        images: savedPost.images || [],
        ownerEmail: savedPost.ownerEmail || currentUserEmail,
      };

      alert("게시글이 작성되었습니다.");
      onSubmit(newPost);
      setTitle("");
      setContent("");
      setImages([]);
      setImageFiles([]);
      router.push("/community");
    } catch (err: any) {
      console.error("게시글 작성 에러:", err.message);
      setError(err.message || "게시글 작성 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-6">
          <Button onClick={() => router.push("/community")} variant="outline">
            <ChevronLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">새 게시글 작성</h1>
          <div className="w-24" />
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="p-6">
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">제목</Label>
                <Input
                  id="title"
                  placeholder="제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={!currentUserEmail} // 로그인하지 않은 경우 비활성화
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">내용</Label>
                <Textarea
                  id="content"
                  placeholder="내용을 입력하세요"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={10}
                  required
                  disabled={!currentUserEmail} // 로그인하지 않은 경우 비활성화
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="image-upload">사진 첨부 (선택 사항)</Label>
                <Input
                  id="image-upload"
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleImageUpload}
                  disabled={!currentUserEmail} // 로그인하지 않은 경우 비활성화
                />
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {images.map((imageSrc, index) => (
                    <div
                      key={index}
                      className="relative w-full h-32 rounded-md overflow-hidden group"
                    >
                      <img
                        src={imageSrc || "/placeholder.svg"}
                        alt={`Uploaded preview ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleRemoveImage(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  {images.length === 0 && (
                    <div className="w-full h-32 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center text-gray-400">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
              </div>

              {error && (
                <div className="text-red-500 text-sm text-center">{error}</div>
              )}

              <Button
                type="submit"
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-black"
                disabled={!currentUserEmail} // 로그인하지 않은 경우 비활성화
              >
                작성 완료
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}