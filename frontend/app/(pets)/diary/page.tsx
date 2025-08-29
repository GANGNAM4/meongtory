"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Plus, Edit, Mic, Trash2 } from "lucide-react"
import { fetchDiaries, deleteDiary } from "@/lib/diary"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/components/navigation"
import GrowthDiaryWritePage from "./write/page"

interface DiaryEntry {
  diaryId: number;
  userId?: number;
  petId?: number; // MyPet의 ID 추가
  petName?: string; // MyPet의 이름 추가
  title: string | null;
  text: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  categories?: string[];
  createdAt: string;
  updatedAt: string;
}

interface GrowthDiaryPageProps {
  entries: DiaryEntry[]
  onViewEntry: (entry: DiaryEntry) => void
  onClose: () => void
  onAddEntry: (entryData: Omit<DiaryEntry, "diaryId" | "createdAt" | "updatedAt">) => void
  isLoggedIn?: boolean // prop을 optional로 변경
  currentUserId?: string
  onNavigateToWrite: () => void
}

export default function GrowthDiaryPage({
  entries,
  onViewEntry,
  onClose,
  onAddEntry,
  isLoggedIn: propIsLoggedIn,
  currentUserId,
  onNavigateToWrite,
}: GrowthDiaryPageProps) {
  const { isLoggedIn, currentUser, checkLoginStatus } = useAuth();
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [isWriteMode, setIsWriteMode] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [diaryToDelete, setDiaryToDelete] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("전체");
  const router = useRouter();
  const { toast } = useToast();

  const refetchDiaries = async (category?: string) => {
    console.log("=== refetchDiaries called ===");
    console.log("Fetching diaries for current user, isLoggedIn:", isLoggedIn);
    console.log("Category filter:", category);
    
    try {
      const data = await fetchDiaries(category);
      console.log("=== fetchDiaries success ===");
      console.log("Raw data received:", data);
      console.log("Data type:", typeof data);
      console.log("Is array:", Array.isArray(data));
      console.log("Number of entries fetched:", data.length);
      setDiaryEntries(data as DiaryEntry[]);
    } catch (err: any) {
      console.error("=== fetchDiaries error ===");
      console.error("일기 목록 불러오기 실패:", err);
      console.error("Error details:", err.message);
      
      if (err.message.includes("로그인이 필요합니다") || err.message.includes("세션이 만료")) {
        toast({
          title: "로그인 필요",
          description: "로그인이 필요합니다. 다시 로그인해주세요.",
          variant: "destructive",
        });
        window.location.href = "/";
        return;
      }
    }
  };

  const handleEdit = (diaryId: number) => {
    console.log("=== handleEdit called ===");
    console.log("Diary ID:", diaryId);
    console.log("Current URL:", window.location.href);
    window.location.href = `/diary/edit/${diaryId}`;
  };

  const handleViewEntry = (diaryId: number) => {
    console.log("=== handleViewEntry called ===");
    console.log("Diary ID:", diaryId);
    router.push(`/diary/${diaryId}`);
  };

  const handleDelete = async (diaryId: number) => {
    setDiaryToDelete(diaryId);
    setShowDeleteConfirm(true);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const category = tab === "전체" ? undefined : tab;
    refetchDiaries(category);
  };

  const confirmDelete = async () => {
    if (!diaryToDelete) return;

    try {
      await deleteDiary(diaryToDelete);
      console.log(`Diary ${diaryToDelete} deleted successfully`);
      toast({
        title: "삭제 완료",
        description: "삭제가 완료되었습니다.",
      });
      refetchDiaries();
    } catch (err: any) {
      console.error("일기 삭제 실패:", err);
      if (err.message.includes("로그인이 필요합니다") || err.message.includes("세션이 만료")) {
        toast({
          title: "로그인 필요",
          description: "로그인이 필요합니다. 다시 로그인해주세요.",
          variant: "destructive",
        });
        window.location.href = "/";
        return;
      }
      toast({
        title: "삭제 실패",
        description: "삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setShowDeleteConfirm(false);
      setDiaryToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setDiaryToDelete(null);
  };

  useEffect(() => {
    console.log("=== useEffect triggered ===");
    console.log("Current userId:", currentUser?.id, "isLoggedIn:", isLoggedIn);
    
    const initialize = async () => {
      setIsLoading(true);
      await checkLoginStatus();
      if (isLoggedIn) {
        await refetchDiaries(activeTab === "전체" ? undefined : activeTab);
      }
      setIsLoading(false);
    };

    initialize();
  }, [isLoggedIn, currentUser, checkLoginStatus]);

  const userEntries = diaryEntries.filter((entry) => {
    console.log("Filtering entry:", entry);
    console.log("Entry userId:", entry.userId, "Entry title:", entry.title);
    return true; // 모든 일기 표시
  });

  console.log("userEntries length:", userEntries.length);
  console.log("userEntries:", userEntries);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 flex items-center justify-center">
        <p className="text-gray-500">로딩 중...</p>
      </div>
    );
  }

  if (isWriteMode) {
    return (
      <GrowthDiaryWritePage
        onBack={() => {
          console.log("=== onBack callback executed ===");
          console.log("Setting isWriteMode to false");
          setIsWriteMode(false);
          console.log("Calling refetchDiaries");
          refetchDiaries();
        }}
        currentUserId={Number(currentUser?.id) || Number(currentUserId)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">성장일기</h1>
          </div>
          {isLoggedIn && (
            <Button
              onClick={() => setIsWriteMode(true)}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              <Plus className="h-4 w-4 mr-2" />글쓰기
            </Button>
          )}
        </div>

        {/* 카테고리 탭 UI */}
        <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
          {["전체", "일상", "건강"].map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "bg-yellow-400 text-black shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="grid gap-6">
          {userEntries.length > 0 ? (
            userEntries.map((entry) => (
              <Card 
                key={entry.diaryId} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewEntry(entry.diaryId)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h2 className="text-xl font-bold text-gray-900">
                            {entry.title || "(제목 없음)"}
                          </h2>
                          {entry.petName && (
                            <p className="text-sm text-blue-600 font-medium">
                              🐾 {entry.petName}
                            </p>
                          )}
                          {localStorage.getItem("userRole") === "ADMIN" && (
                            <p className="text-sm text-gray-500">
                              작성자 ID: {entry.userId}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {isLoggedIn && (
                            <>
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={(e) => {
                                  console.log("=== Edit button clicked ===");
                                  console.log("Entry diaryId:", entry.diaryId);
                                  e.stopPropagation();
                                  handleEdit(entry.diaryId);
                                }}
                                className="hover:bg-gray-100"
                                title="수정"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(entry.diaryId);
                                }}
                                className="hover:bg-red-50 text-red-500 hover:text-red-700"
                                title="삭제"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                      <p className="text-base text-gray-700 mb-2">{entry.text || "(내용 없음)"}</p>
                      <p className="text-sm text-gray-500 mb-3">{entry.createdAt}</p>
                      {entry.categories && entry.categories.length > 0 && (
                        <div className="flex gap-1 mb-2">
                          {entry.categories.map((category: string, index: number) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      )}
                      {entry.audioUrl && (
                        <div className="flex items-center gap-2 mb-2">
                          <Mic className="h-4 w-4" />
                          <audio controls>
                            <source src={entry.audioUrl} />
                          </audio>
                        </div>
                      )}
                    </div>
                    {entry.imageUrl && (
                      <div className="ml-4 flex-shrink-0">
                        <img
                          src={entry.imageUrl}
                          alt="diary image"
                          className="w-24 h-24 object-cover rounded-md"
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <Card className="p-6 text-center text-gray-500">
              <p>{isLoggedIn ? "작성된 성장일기가 없습니다." : "로그인 후 사용해주세요."}</p>
            </Card>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-4">일기 삭제</h3>
                <p className="text-gray-600 mb-6">정말로 이 일기를 삭제하시겠습니까?<br />⚠️ 삭제된 일기는 복구할 수 없습니다.</p>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={cancelDelete}>취소</Button>
                  <Button onClick={confirmDelete} className="bg-red-600 text-white hover:bg-red-700">삭제</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}