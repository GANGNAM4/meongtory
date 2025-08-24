"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Heart, Eye, Plus, Search, Edit, Trash } from "lucide-react";
import { Input } from "@/components/ui/input";
import { getBackendUrl } from "@/lib/api";

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
  sharedFromDiaryId?: number;
}

interface CommunityPageProps {
  isLoggedIn?: boolean;
  onShowLogin?: () => void;
  onUpdatePosts?: (posts: CommunityPost[]) => void;
}

export default function CommunityPage({
  isLoggedIn: propIsLoggedIn,
  onShowLogin,
  onUpdatePosts,
}: CommunityPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const router = useRouter();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      setIsLoggedIn(!!token);
    }

    const fetchPosts = async () => {
      try {
        setLoading(true);
        const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch(`${getBackendUrl()}/api/community/posts`, {
          method: "GET",
          headers,
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        const mappedPosts = data.map((post: any) => {
          // 날짜 처리 개선
          let formattedDate = "날짜 없음";
          if (post.createdAt) {
            try {
              const date = new Date(post.createdAt);
              if (!isNaN(date.getTime())) {
                formattedDate = date.toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                });
              }
            } catch (error) {
              console.error("날짜 파싱 오류:", error);
            }
          }
          
          return {
            id: post.id,
            title: post.title || "제목 없음",
            content: post.content || "",
            author: post.author || "익명", //  DB author 매핑
            date: formattedDate,
            category: post.category || "",
            boardType: post.boardType || "자유게시판",
            views: post.views || 0,
            likes: post.likes || 0,
            comments: post.comments || 0, // DB community_posts.comments (commentCount)
            tags: post.tags || [],
            images: post.images || [],
            ownerEmail: post.ownerEmail || "",
            sharedFromDiaryId: post.sharedFromDiaryId,
          };
        });

        setPosts(mappedPosts);
        if (typeof onUpdatePosts === "function") {
          onUpdatePosts(mappedPosts);
        }
      } catch (err: any) {
        setError(err.message || "Failed to fetch posts");
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, []);

  const filteredPosts = posts?.filter((post) => {
    const matchesSearch =
      (post.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (post.content || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (post.author || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (post.tags || []).some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const sortedPosts = filteredPosts || [];

  const popularPosts = posts?.sort((a, b) => b.views - a.views).slice(0, 5) || [];

  const handleLike = async (postId: number) => {
    try {
      if (!isLoggedIn) {
        if (onShowLogin) return onShowLogin();
        return;
      }

      const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(`${getBackendUrl()}/api/community/posts/${postId}/like`, {
        method: "PUT",
        headers,
      });

      if (response.ok) {
        const updatedPosts = posts.map((post) =>
          post.id === postId ? { ...post, likes: post.likes + 1 } : post
        );
        setPosts(updatedPosts);
        if (typeof onUpdatePosts === "function") {
          onUpdatePosts(updatedPosts);
        }
      } else {
        throw new Error("Failed to like post");
      }
    } catch (err) {
      console.error("Failed to like post:", err);
      setError("Failed to like post");
    }
  };

  const handleEdit = (post: CommunityPost) => {
    if (!isLoggedIn) {
      if (onShowLogin) onShowLogin();
      else router.push("/community");
      return;
    }
    router.push(`/community/${post.id}?edit=true`);
  };

  const handleDelete = async (postId: number) => {
    if (!isLoggedIn) {
      if (onShowLogin) onShowLogin();
      else router.push("/community");
      return;
    }
    if (confirm("정말로 이 게시글을 삭제하시겠습니까?")) {
      try {
        const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
        const headers: HeadersInit = {};
        if (token) headers["Access_Token"] = token;

        const response = await fetch(`${getBackendUrl()}/api/community/posts/${postId}`, {
          method: "DELETE",
          headers,
        });

        if (response.ok) {
          const updatedPosts = posts.filter((post) => post.id !== postId);
          setPosts(updatedPosts);
          if (typeof onUpdatePosts === "function") {
            onUpdatePosts(updatedPosts);
          }
          router.push("/community");
        } else {
          throw new Error("Failed to delete post");
        }
      } catch (err) {
        console.error("Failed to delete post:", err);
        setError("Failed to delete post");
      }
    }
  };

  const handleNavigateToWrite = () => {
    if (!isLoggedIn) {
      if (onShowLogin) onShowLogin();
      else router.push("/community");
      return;
    }
    router.push("/community/write");
  };

  const handleViewPost = (post: CommunityPost) => {
    router.push(`/community/${post.id}`);
  };

  if (loading) return <div className="min-h-screen bg-gray-50 py-8">로딩 중...</div>;
  if (error) return <div className="min-h-screen bg-gray-50 py-8">에러: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">커뮤니티</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* 검색 + 글쓰기 */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <Input
                type="text"
                placeholder="게시글 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-grow"
              />
              <Button className="bg-yellow-400 hover:bg-yellow-500 text-black">
                <Search className="h-4 w-4 mr-2" />
                검색
              </Button>
              <Button onClick={handleNavigateToWrite} className="bg-yellow-400 hover:bg-yellow-500 text-black">
                <Plus className="h-4 w-4 mr-2" />
                글쓰기
              </Button>
            </div>

            {/* 게시글 목록 */}
            {sortedPosts && sortedPosts.length > 0 ? (
              sortedPosts.map((post) => (
                <Card key={post.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6" onClick={() => handleViewPost(post)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant={post.boardType === "Q&A" ? "default" : "secondary"}>{post.boardType}</Badge>
                          {post.sharedFromDiaryId && (
                            <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                              🐾 성장일기 공유
                            </Badge>
                          )}
                          <span className="text-sm text-gray-500">{post.author}</span>
                          <span className="text-sm text-gray-500">{post.date}</span>
                        </div>
                        <h2 className="text-xl font-semibold mb-2">{post.title}</h2>
                        <p className="text-gray-700 line-clamp-2 mb-4">{post.content}</p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Eye className="h-4 w-4 mr-1" />
                            {post.views}
                          </span>
                          <span className="flex items-center">
                            <MessageSquare className="h-4 w-4 mr-1" />
                            💬 {post.comments}
                          </span>
                          <button
                            disabled={!isLoggedIn}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (isLoggedIn) handleLike(post.id);
                            }}
                            className={`flex items-center ${
                              isLoggedIn ? "hover:text-red-500" : "opacity-50 cursor-not-allowed"
                            }`}
                          >
                            <Heart className="h-4 w-4 mr-1" />
                            {post.likes}
                          </button>
                          {/* {isLoggedIn && (
                            <>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEdit(post);
                                }}
                                className="flex items-center hover:text-blue-500 transition-colors"
                              >
                                <Edit className="h-4 w-4 mr-1" />
                                수정
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(post.id);
                                }}
                                className="flex items-center hover:text-red-500 transition-colors"
                              >
                                <Trash className="h-4 w-4 mr-1" />
                                삭제
                              </button>
                            </>
                          )} */}
                        </div>
                      </div>
                      {post.images && post.images.length > 0 && (
                        <div className="ml-4 flex-shrink-0">
                          <Image
                            src={post.images?.[0] || "/placeholder.svg"}
                            alt={post.title}
                            width={120}
                            height={90}
                            className="rounded-md object-cover"
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card className="p-6 text-center text-gray-500">
                <p>게시글이 없습니다.</p>
              </Card>
            )}
          </div>

          {/* 인기글 사이드 */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4">인기 게시글</h3>
                <ul className="space-y-3">
                  {popularPosts.map((post) => (
                    <li key={post.id} className="border-b pb-3 last:border-b-0 last:pb-0">
                      <button onClick={() => handleViewPost(post)} className="text-left w-full">
                        <p className="text-sm font-medium text-gray-800 hover:text-blue-600 line-clamp-2">
                          {post.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {post.author} • 조회 {post.views}
                        </p>
                      </button>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}