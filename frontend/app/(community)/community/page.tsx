"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Heart, Eye, Plus, Search, Edit, Trash } from "lucide-react";
import { Input } from "@/components/ui/input";

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
}

interface CommunityPageProps {
  posts: CommunityPost[];
  isLoggedIn: boolean;
  onShowLogin: () => void;
  onUpdatePosts: (posts: CommunityPost[]) => void;
}

export default function CommunityPage({
  posts,
  isLoggedIn,
  onShowLogin,
  onUpdatePosts,
}: CommunityPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const router = useRouter();

  const filteredPosts = posts?.filter((post) => {
    const matchesSearch =
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSearch;
  });

  const sortedPosts = filteredPosts
    ? [...filteredPosts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  const popularPosts = posts?.sort((a, b) => b.views - a.views).slice(0, 5) || [];

  const handleLike = (postId: number) => {
    onUpdatePosts(posts?.map((post) => (post.id === postId ? { ...post, likes: post.likes + 1 } : post)) || []);
  };

  const handleEdit = (post: CommunityPost) => {
    if (!isLoggedIn) {
      onShowLogin();
      return;
    }
    router.push(`/community/${post.id}?edit=true`);
  };

  const handleDelete = (postId: number) => {
    if (!isLoggedIn) {
      onShowLogin();
      return;
    }
    if (confirm("정말로 이 게시글을 삭제하시겠습니까?")) {
      onUpdatePosts(posts?.filter((post) => post.id !== postId) || []);
    }
  };

  const handleNavigateToWrite = () => {
    if (!isLoggedIn) {
      onShowLogin();
      return;
    }
    router.push("/community/write");
  };

  const handleViewPost = (post: CommunityPost) => {
    router.push(`/community/${post.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">커뮤니티</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
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

            {sortedPosts && sortedPosts.length > 0 ? (
              sortedPosts.map((post) => (
                <Card key={post.id} className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-6" onClick={() => handleViewPost(post)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant={post.boardType === "Q&A" ? "default" : "secondary"}>{post.boardType}</Badge>
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
                            {post.comments}
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLike(post.id);
                            }}
                            className="flex items-center hover:text-red-500 transition-colors"
                          >
                            <Heart className="h-4 w-4 mr-1" />
                            {post.likes}
                          </button>
                          {isLoggedIn && (
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
                          )}
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