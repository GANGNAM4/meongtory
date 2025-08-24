"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronLeft, ImageIcon, X } from "lucide-react";
import axios from "axios";
import { getBackendUrl } from "@/lib/api";
import { toast } from "react-hot-toast";

export const dynamic = "force-dynamic";

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

interface CommunityWritePageProps {
  onShowLogin?: () => void;
}

const refreshAccessToken = async () => {
  try {
    const refreshToken = localStorage.getItem("refreshToken");
    if (!refreshToken) {
      console.error("리프레시 토큰이 없습니다.");
      return null;
    }
    const response = await axios.post(
      `${getBackendUrl()}/api/accounts/refresh`,
      { refreshToken },
      { headers: { "Content-Type": "application/json" } }
    );
    const { accessToken } = response.data.data;
    localStorage.setItem("accessToken", accessToken);
    return accessToken;
  } catch (err) {
    console.error("토큰 갱신 실패:", err);
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    return null;
  }
};

function CommunityWritePageContent({ onShowLogin }: CommunityWritePageProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const boardType: "Q&A" | "자유게시판" = "자유게시판";
  const [images, setImages] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [sharedFromDiary, setSharedFromDiary] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

    useEffect(() => {
    const initializePage = async () => {
      // URL 파라미터에서 성장일기 ID 확인
      const sharedFromDiaryId = searchParams.get('sharedFromDiary');
      
             if (sharedFromDiaryId) {
         try {
           // 성장일기 데이터 가져오기
           const token = localStorage.getItem("accessToken");
           const response = await axios.get(`${getBackendUrl()}/api/diary/${sharedFromDiaryId}`, {
             headers: {
               Access_Token: token,
             },
           });
           
           const diary = response.data;
           setSharedFromDiary(diary);
           setTitle(diary.title || "");
           setContent(diary.text || "");
           
                       // 성장일기 이미지를 백엔드를 통해 다운로드하여 업로드 준비
            if (diary.imageUrl) {
              try {
                // 백엔드를 통해 이미지 다운로드 (CORS 문제 해결)
                const imageResponse = await axios.get(`${getBackendUrl()}/api/s3/download`, {
                  params: { fileUrl: diary.imageUrl },
                  responseType: 'blob',
                  headers: {
                    Access_Token: token,
                  },
                });
                
                const imageBlob = imageResponse.data;
                
                // 파일명 추출 (URL에서 마지막 부분)
                const urlParts = diary.imageUrl.split('/');
                const fileName = urlParts[urlParts.length - 1] || 'diary-image.jpg';
                
                // Blob을 File 객체로 변환
                const imageFile = new File([imageBlob], fileName, { type: imageBlob.type });
                
                // 미리보기용 URL 생성
                const previewUrl = URL.createObjectURL(imageBlob);
                setImages([previewUrl]);
                setImageFiles([imageFile]);
                
                toast.success("성장일기에서 공유된 내용과 이미지가 자동으로 채워졌습니다!");
              } catch (imageError) {
                console.error("이미지 다운로드 실패:", imageError);
                toast.error("이미지를 불러오는데 실패했습니다.");
              }
            } else {
              toast.success("성장일기에서 공유된 내용이 자동으로 채워졌습니다!");
            }
         } catch (error) {
           console.error("성장일기 로드 실패:", error);
           toast.error("성장일기 정보를 불러오는데 실패했습니다.");
         }
       }

      // 사용자 정보 가져오기
      try {
        if (typeof window === "undefined") {
          setError("클라이언트 환경에서만 로그인 확인 가능");
          return;
        }
        let token = localStorage.getItem("accessToken");
        console.log("Access Token:", token ? "존재함" : "없음");
        if (!token) {
          setError("로그인이 필요합니다. 로그인 모달을 엽니다.");
          if (onShowLogin) {
            onShowLogin();
          } else {
            console.warn("onShowLogin prop이 정의되지 않음, /community로 이동");
            router.push("/community");
          }
          return;
        }
        const res = await axios.get(`${getBackendUrl()}/api/accounts/me`, {
          headers: {
            Access_Token: token, // Authorization -> Access_Token
          },
        });
        if (!res.data.success) {
          throw new Error(`사용자 정보 로드 실패 (${res.status})`);
        }
        const { email } = res.data.data;
        if (!email) {
          throw new Error("Email field not found in response data");
        }
        setCurrentUserEmail(email);
        console.log("Fetched User Data:", res.data.data);
      } catch (err: any) {
        console.error("사용자 정보 로드 에러:", err);
        if (err.response?.status === 401) {
          const newToken = await refreshAccessToken();
          if (newToken) {
            try {
              const res = await axios.get(`${getBackendUrl()}/api/accounts/me`, {
                headers: {
                  Access_Token: newToken,
                },
              });
              if (!res.data.success) {
                throw new Error(`사용자 정보 재로드 실패 (${res.status})`);
              }
              const { email } = res.data.data;
              setCurrentUserEmail(email);
              console.log("Fetched User Data after refresh:", res.data.data);
            } catch (retryErr: any) {
              console.error("재시도 실패:", retryErr);
              localStorage.removeItem("accessToken");
              localStorage.removeItem("refreshToken");
              setError("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
              if (onShowLogin) {
                onShowLogin();
              } else {
                router.push("/community");
              }
            }
          } else {
            setError("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
            if (onShowLogin) {
              onShowLogin();
            } else {
              router.push("/community");
            }
          }
        } else {
          setError(`사용자 정보를 불러오는 중 오류가 발생했습니다: ${err.message}`);
          if (onShowLogin) {
            onShowLogin();
          } else {
            router.push("/community");
          }
        }
      }
    };

         initializePage();
   }, [router, onShowLogin, searchParams]);

   // 컴포넌트 언마운트 시 blob URL 정리
   useEffect(() => {
     return () => {
       images.forEach((imageUrl) => {
         if (imageUrl && imageUrl.startsWith('blob:')) {
           URL.revokeObjectURL(imageUrl);
         }
       });
     };
   }, [images]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const filesArray = Array.from(event.target.files);
      setImageFiles((prev) => [...prev, ...filesArray]);
      const newImageUrls = filesArray.map((file) => URL.createObjectURL(file));
      setImages((prev) => [...prev, ...newImageUrls]);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => {
      const newImages = prev.filter((_, index) => index !== indexToRemove);
      // URL 해제 (메모리 누수 방지)
      if (prev[indexToRemove] && prev[indexToRemove].startsWith('blob:')) {
        URL.revokeObjectURL(prev[indexToRemove]);
      }
      return newImages;
    });
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
      setError("로그인이 필요합니다. 로그인 모달을 엽니다.");
      if (onShowLogin) {
        onShowLogin();
      } else {
        router.push("/community");
      }
      return;
    }

    try {
      let token = localStorage.getItem("accessToken");
      if (!token) {
        setError("로그인이 필요합니다. 로그인 모달을 엽니다.");
        if (onShowLogin) {
          onShowLogin();
        } else {
          router.push("/community");
        }
        return;
      }

      const formData = new FormData();
      const dto = {
        title,
        content,
        category: "일반",
        boardType,
        tags: [],
        sharedFromDiaryId: sharedFromDiary?.diaryId || undefined,
      };

      formData.append(
        "dto",
        new Blob([JSON.stringify(dto)], { type: "application/json" })
      );

      imageFiles.forEach((file) => {
        formData.append("postImg", file);
      });

      const res = await axios.post(`${getBackendUrl()}/api/community/posts/create`, formData, {
        headers: {
          Access_Token: token, // Authorization -> Access_Token
        },
      });

      const savedPost = res.data;

      console.log("Saved Post:", savedPost);

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

      toast.success("게시글이 작성되었습니다.");
      setTitle("");
      setContent("");
      setImages([]);
      setImageFiles([]);
      router.push("/community");
    } catch (err: any) {
      console.error("게시글 작성 에러:", err);
      if (err.response?.status === 401) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          try {
            const formData = new FormData();
            const dto = {
              title,
              content,
              category: "일반",
              boardType,
              tags: [],
            };
            formData.append(
              "dto",
              new Blob([JSON.stringify(dto)], { type: "application/json" })
            );
            imageFiles.forEach((file) => {
              formData.append("postImg", file);
            });
            const res = await axios.post(`${getBackendUrl()}/api/community/posts/create`, formData, {
              headers: {
                Access_Token: newToken,
              },
            });
            const savedPost = res.data;
            console.log("Saved Post after refresh:", savedPost);
            toast.success("게시글이 작성되었습니다.");
            setTitle("");
            setContent("");
            setImages([]);
            setImageFiles([]);
            router.push("/community");
          } catch (retryErr: any) {
            console.error("재시도 실패:", retryErr);
            setError("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
            if (onShowLogin) {
              onShowLogin();
            } else {
              router.push("/community");
            }
          }
        } else {
          setError("로그인 세션이 만료되었습니다. 다시 로그인해주세요.");
          if (onShowLogin) {
            onShowLogin();
          } else {
            router.push("/community");
          }
        }
      } else {
        setError(err.message || "게시글 작성 중 오류가 발생했습니다.");
      }
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
              {/* 성장일기 공유 배지 */}
              {sharedFromDiary && (
                <div className="flex items-center gap-2 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                  <span className="text-yellow-800 font-medium">🐾 성장일기에서 공유됨</span>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="title">제목</Label>
                <Input
                  id="title"
                  placeholder="제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  disabled={!currentUserEmail}
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
                  disabled={!currentUserEmail}
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
                  disabled={!currentUserEmail}
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
                disabled={!currentUserEmail}
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

export default function CommunityWritePage({ onShowLogin }: CommunityWritePageProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">로딩 중...</div>}>
      <CommunityWritePageContent onShowLogin={onShowLogin} />
    </Suspense>
  );
}