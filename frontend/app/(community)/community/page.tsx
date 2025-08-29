"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Heart, Eye, Plus, Search, Edit, Trash, ChevronLeft, ChevronRight } from "lucide-react";
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
  boardType: "Q&A" | "QNA" | "자유게시판" | "멍스타그램" | "꿀팁게시판";
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
  const [keyword, setKeyword] = useState("");
  const [category, setCategory] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("전체");
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const router = useRouter();

  // 카테고리 탭 목록
  const categories = ["전체", "자유게시판", "멍스타그램", "꿀팁게시판", "Q&A"];

  // Q&A <-> QNA 변환 함수
  const convertBoardTypeForDisplay = (boardType: string): string => {
    return boardType === "QNA" ? "Q&A" : boardType;
  };

  const convertBoardTypeForAPI = (boardType: string): string => {
    return boardType === "Q&A" ? "QNA" : boardType;
  };

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

        // 검색 API 사용
        let url = `${getBackendUrl()}/api/community/posts/search?page=${currentPage}&size=7`;
        if (keyword) url += `&keyword=${encodeURIComponent(keyword)}`;
        if (category) url += `&category=${encodeURIComponent(category)}`;

        const response = await fetch(url, {
          method: "GET",
          headers,
        });

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data = await response.json();

        const mappedPosts = data.content.map((post: any) => {
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
            author: post.author || "익명",
            date: formattedDate,
            category: post.category || "",
            boardType: post.boardType || "자유게시판",
            views: post.views || 0,
            likes: post.likes || 0,
            comments: post.comments || 0,
            tags: post.tags || [],
            images: post.images || [],
            ownerEmail: post.ownerEmail || "",
            sharedFromDiaryId: post.sharedFromDiaryId,
          };
        });

        setPosts(mappedPosts);
        setTotalPages(data.totalPages);
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
  }, [keyword, category, currentPage]); // keyword, category, currentPage가 변경될 때마다 다시 fetch

  const filteredPosts = posts?.filter((post) => {
    const matchesSearch =
      (post.title || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (post.content || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (post.author || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
      (post.tags || []).some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  // 항상 createdAt DESC 순서로 정렬 유지 (좋아요 클릭 시에도 순서 변경 방지)
  const sortedPosts = (filteredPosts || []).sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateB - dateA; // 최신순 정렬
  });

  const popularPosts = posts ? [...posts].sort((a, b) => b.views - a.views).slice(0, 5) : [];

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
        // 해당 게시글의 likes 값만 업데이트하고 배열 순서는 절대 변경하지 않음
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

  const handleSearch = () => {
    setKeyword(searchTerm);
    setCurrentPage(0); // 검색 시 첫 페이지로 이동
  };

  const handleCategoryChange = (selectedCategory: string) => {
    setCategory(selectedCategory === "전체" ? "" : convertBoardTypeForAPI(selectedCategory));
    setCurrentPage(0); // 카테고리 변경 시 첫 페이지로 이동
  };

  if (loading) return <div className="min-h-screen bg-gray-50 py-8">로딩 중...</div>;
  if (error) return <div className="min-h-screen bg-gray-50 py-8">에러: {error}</div>;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">커뮤니티</h1>
        </div>

        {/* 카테고리 탭 */}
        <div className="flex gap-4 mb-6">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => {
                setActiveTab(category);
                handleCategoryChange(category);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === category 
                  ? "bg-yellow-400 text-black shadow-sm" 
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* 검색 + 글쓰기 */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <Input
                type="text"
                placeholder="검색어를 입력하세요"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
                className="flex-grow"
              />
              <Button onClick={handleSearch} className="bg-yellow-400 hover:bg-yellow-500 text-black">
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
              <>
                {sortedPosts.map((post) => (
                  <Card key={post.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-6" onClick={() => handleViewPost(post)}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <Badge variant={post.boardType === "QNA" || post.boardType === "Q&A" ? "default" : "secondary"}>
                              {convertBoardTypeForDisplay(post.boardType)}
                            </Badge>
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
                ))}
                
                {/* 페이지 네비게이션 */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center mt-8 gap-2">
                    {/* 이전 페이지 버튼 */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 0))}
                      disabled={currentPage === 0}
                      className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    {/* 페이지 번호 버튼들 */}
                    {(() => {
                      const pages = [];
                      const maxVisiblePages = 5;
                      let startPage = Math.max(0, currentPage - Math.floor(maxVisiblePages / 2));
                      let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 1);
                      
                      // 시작 페이지 조정
                      if (endPage - startPage < maxVisiblePages - 1) {
                        startPage = Math.max(0, endPage - maxVisiblePages + 1);
                      }

                      // 첫 페이지
                      if (startPage > 0) {
                        pages.push(
                          <button
                            key={0}
                            onClick={() => setCurrentPage(0)}
                            className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            1
                          </button>
                        );
                        
                        if (startPage > 1) {
                          pages.push(
                            <span key="ellipsis1" className="px-2 text-gray-500">
                              ...
                            </span>
                          );
                        }
                      }

                      // 중간 페이지들
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <button
                            key={i}
                            onClick={() => setCurrentPage(i)}
                            className={`flex items-center justify-center w-10 h-10 rounded-lg border transition-colors ${
                              currentPage === i 
                                ? "bg-yellow-400 text-white border-yellow-400" 
                                : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            {i + 1}
                          </button>
                        );
                      }

                      // 마지막 페이지
                      if (endPage < totalPages - 1) {
                        if (endPage < totalPages - 2) {
                          pages.push(
                            <span key="ellipsis2" className="px-2 text-gray-500">
                              ...
                            </span>
                          );
                        }
                        
                        pages.push(
                          <button
                            key={totalPages - 1}
                            onClick={() => setCurrentPage(totalPages - 1)}
                            className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
                          >
                            {totalPages}
                          </button>
                        );
                      }

                      return pages;
                    })()}

                    {/* 다음 페이지 버튼 */}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages - 1))}
                      disabled={currentPage === totalPages - 1}
                      className="flex items-center justify-center w-10 h-10 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </>
            ) : (
              <Card className="p-6 text-center text-gray-500">
                <p>{activeTab === "전체" ? "게시글이 없습니다." : `${activeTab} 게시글이 없습니다.`}</p>
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