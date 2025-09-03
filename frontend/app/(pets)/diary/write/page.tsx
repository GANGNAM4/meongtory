//글쓰기 

"use client";

import React, { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label"; // Label 컴포넌트 추가
import { Card, CardContent } from "@/components/ui/card"; // Card 컴포넌트 추가
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Select 컴포넌트 추가
import Image from "next/image";
import { ChevronLeft, ImageIcon, X, Mic, MicOff, Play, Pause } from "lucide-react"; // 음성 관련 아이콘 추가
import { uploadImageToS3, uploadAudioToS3, getPetList, type Pet, type PetListResponse } from "@/lib/diary"
import { useToast } from "@/components/ui/use-toast";
import { useRouter } from "next/navigation";
import { getBackendUrl } from "@/lib/api";
import axios from 'axios';

interface GrowthDiaryWritePageProps {
  onBack: () => void;
  currentUserId: number;
}

export default function GrowthDiaryWritePage({
  onBack,
  currentUserId
}: GrowthDiaryWritePageProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]); // State to store image URLs
  const [imageFiles, setImageFiles] = useState<File[]>([]); // State to store actual image files
  const [milestones, setMilestones] = useState<string>(""); // 마일스톤 상태 추가
  const [error, setError] = useState(""); // Error state 추가
  const [activities, setActivities] = useState<string>(""); // 활동 상태 추가
  const [tags, setTags] = useState<string>(""); // 태그 상태 추가
  const [isUploading, setIsUploading] = useState(false); // 이미지 업로드 상태
  const [isSubmitting, setIsSubmitting] = useState(false); // 제출 중복 방지 상태
  
  // 펫 관련 상태
  const [pets, setPets] = useState<Pet[]>([]);
  const [selectedPetId, setSelectedPetId] = useState<string>(""); // Select 컴포넌트는 string 값 사용
  const [isLoadingPets, setIsLoadingPets] = useState(false);

  // 음성 녹음 관련 상태
  const [isRecording, setIsRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();

  // 펫 목록 로드
  useEffect(() => {
    const loadPets = async () => {
      try {
        setIsLoadingPets(true);
        const petData = await getPetList();
        setPets(petData.myPets || []);
      } catch (error: any) {
        console.error("펫 목록 로드 실패:", error);
        // 로그인이 필요한 경우가 아닌 경우에만 에러 토스트 표시
        if (!error.message?.includes("로그인이 필요합니다")) {
          toast({
            title: "펫 목록 로드 실패",
            description: "펫 목록을 불러오는 중 오류가 발생했습니다.",
            variant: "destructive",
          });
        }
      } finally {
        setIsLoadingPets(false);
      }
    };

    loadPets();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // 중복 제출 방지
    if (isSubmitting) {
      return;
    }

    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 모두 입력해주세요.");
      toast({
        title: "입력 오류",
        description: "제목과 내용을 모두 입력해주세요.",
        variant: "destructive",
      });
      return;
    }

    // 제출 상태 활성화 (버튼 비활성화 및 "작성 중..." 표시)
    setIsSubmitting(true);

    // 현재 로그인된 사용자의 실제 ID 가져오기
    const userId = localStorage.getItem("userId");
    
    let finalUserId = userId;
    if (!userId) {
      console.log("No userId found in localStorage, using currentUserId prop");
      finalUserId = currentUserId?.toString();
      console.log("Using currentUserId as userId:", finalUserId);
      
      if (!finalUserId) {
        console.log("No userId available");
        toast({
          title: "로그인 필요",
          description: "로그인이 필요합니다.",
          variant: "destructive",
        });
        return;
      }
    }

    try {
      // 이미지 파일들을 S3에 업로드
      let uploadedImageUrls: string[] = [];
      if (imageFiles.length > 0) {
        setIsUploading(true);
        toast({
          title: "이미지 업로드 중",
          description: "이미지를 업로드하고 있습니다...",
        });

        for (const file of imageFiles) {
          try {
            const uploadedUrl = await uploadImageToS3(file);
            uploadedImageUrls.push(uploadedUrl);
          } catch (error) {
            console.error("이미지 업로드 실패:", error);
            toast({
              title: "이미지 업로드 실패",
              description: "이미지 업로드 중 오류가 발생했습니다.",
              variant: "destructive",
            });
            return;
          }
        }
        setIsUploading(false);
      }

      // 오디오 파일을 S3에 업로드
      let uploadedAudioUrl: string | undefined = undefined;
      if (audioUrl && audioUrl.startsWith('blob:')) {
        try {
          // blob URL에서 File 객체 생성
          const response = await fetch(audioUrl);
          const blob = await response.blob();
          const audioFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
          
          setIsUploading(true);
          toast({
            title: "오디오 업로드 중",
            description: "오디오 파일을 업로드하고 있습니다...",
          });
          
          uploadedAudioUrl = await uploadAudioToS3(audioFile);
          setIsUploading(false);
        } catch (error) {
          console.error("오디오 업로드 실패:", error);
          toast({
            title: "오디오 업로드 실패",
            description: "오디오 파일 업로드 중 오류가 발생했습니다.",
            variant: "destructive",
          });
          return;
        }
      } else {
        uploadedAudioUrl = audioUrl;
      }
      
      const diaryData = {
        userId: Number(finalUserId),
        title: title,  
        text: content,
        imageUrl: uploadedImageUrls[0] || undefined,
        audioUrl: uploadedAudioUrl,
        petId: selectedPetId ? Number(selectedPetId) : undefined,
      };

      const result = await axios.post(`${getBackendUrl()}/api/diary`, diaryData, {
        headers: {
          "Access_Token": localStorage.getItem('accessToken') || '',
          "Content-Type": "application/json",
        },
      });

      // 성공 토스트 메시지 표시
      toast({
        title: "작성 완료",
        description: "작성이 완료되었습니다!",
      });
      
      // 약간의 지연 후 뒤로가기 (토스트 메시지가 보이도록)
      setTimeout(() => {
        onBack();
      }, 1000);
    } catch (err: any) {
      console.error("작성 실패:", err);
      
      // 중복 등록 에러 처리
      if (err.response?.status === 409 || err.message.includes("동일한 내용의 일기가 최근에 등록되었습니다")) {
        toast({
          title: "중복 등록",
          description: "동일한 내용의 일기가 최근에 등록되었습니다.",
          variant: "destructive",
        });
        return;
      }
      
      // 인증 관련 에러 처리
      if (err.message.includes("로그인이 필요합니다") || err.message.includes("세션이 만료")) {
        toast({
          title: "로그인 필요",
          description: "로그인이 필요합니다. 다시 로그인해주세요.",
          variant: "destructive",
        });
        // 로그인 페이지로 이동
        // 로그인 모달 표시 대신 홈으로 이동
        window.location.href = "/";
        return;
      }
      
      setError("일기 작성 중 오류가 발생했습니다.");
      toast({
        title: "작성 실패",
        description: "일기 작성 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setIsSubmitting(false); // 제출 상태 비활성화
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImageFiles((prev) => [...prev, ...filesArray]);

      // Create URLs for preview
      const newImageUrls = filesArray.map((file) => URL.createObjectURL(file));
      setImages((prev) => [...prev, ...newImageUrls]);
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setImages((prev) => prev.filter((_, index) => index !== indexToRemove));
    setImageFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleImageClick = () => {
    fileInputRef.current?.click();
  };

  // 음성 녹음 시작
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // 녹음 시간 타이머 시작
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("녹음 시작 실패:", error);
      toast({
        title: "녹음 실패",
        description: "마이크 권한이 필요합니다.",
        variant: "destructive",
      });
    }
  };

  // 음성 녹음 중지
  const stopRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      // 녹음된 데이터를 저장할 변수
      let recordedBlob: Blob | null = null;
      
      // ondataavailable 이벤트 핸들러 설정
      const chunks: BlobPart[] = [];
      mediaRecorderRef.current.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      // onstop 이벤트 핸들러 설정
      mediaRecorderRef.current.onstop = async () => {
        recordedBlob = new Blob(chunks, { type: "audio/webm" });
        const url = URL.createObjectURL(recordedBlob);
        setAudioUrl(url);

        try {
          // FormData 생성
          const formData = new FormData();
          formData.append('audio', recordedBlob, 'recording.webm');

          // 백엔드로 직접 전송
          const response = await fetch(`${getBackendUrl()}/api/diary/voice`, {
            method: 'POST',
            
            headers: {
              'Access_Token': localStorage.getItem('accessToken') || '',
            },
            body: formData,
          });

          if (!response.ok) {
            throw new Error('음성 변환에 실패했습니다.');
          }

          const transcribedText = await response.text();

          // 변환된 텍스트를 textarea에 추가
          setContent(prevContent => {
            const newContent = prevContent + (prevContent ? '\n\n' : '') + transcribedText;
            return newContent;
          });

          toast({
            title: "음성 변환 완료",
            description: "음성이 텍스트로 변환되어 추가되었습니다.",
          });

        } catch (error) {
          console.error('음성 변환 오류:', error);
          toast({
            title: "음성 변환 실패",
            description: "음성을 텍스트로 변환하는 중 오류가 발생했습니다.",
            variant: "destructive",
          });
        }
      };

      // 녹음 중지
      mediaRecorderRef.current.stop();
      setIsRecording(false);

      // 타이머 정리
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  // 오디오 재생/일시정지 토글
  const toggleAudioPlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // 오디오 제거
  const removeAudio = () => {
    setAudioUrl("");
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  };

  // 시간 포맷팅 (초를 MM:SS 형식으로)
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button onClick={onBack} variant="outline">
            <ChevronLeft className="h-4 w-4 mr-2" />
            뒤로가기
          </Button>
          <h1 className="text-3xl font-bold text-gray-900">새 일기 작성</h1>
          <div className="w-24" /> {/* Placeholder for alignment */}
        </div>

        <Card className="p-6">
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">제목</Label>
                <Input
                  id="title"
                  placeholder="제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              {/* 펫 선택 섹션 */}
              <div className="space-y-2">
                <Label htmlFor="pet-select">펫 선택</Label>
                {isLoadingPets ? (
                  <div className="text-sm text-gray-500">펫 목록을 불러오는 중...</div>
                ) : pets.length === 0 ? (
                  <div className="text-sm text-gray-500">등록된 펫이 없습니다</div>
                ) : (
                  <Select value={selectedPetId} onValueChange={setSelectedPetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="펫을 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {pets.map((pet) => (
                        <SelectItem key={pet.myPetId} value={pet.myPetId.toString()}>
                          {pet.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
                />
              </div>

              {/* Image Upload Section */}
              <div className="space-y-2">
                <Label htmlFor="image-upload">사진 첨부 (선택 사항)</Label>
                <div className="flex items-center space-x-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleImageClick}
                    disabled={isUploading}
                    className="flex items-center space-x-2"
                  >
                    <ImageIcon className="h-4 w-4" />
                    <span>{images.length === 0 ? "선택된 파일 없음" : `${images.length}개 파일 선택됨`}</span>
                  </Button>
                  <input
                    ref={fileInputRef}
                    id="image-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </div>
                
                {/* Image Preview Grid */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {images.map((imageSrc, index) => (
                    <div key={index} className="relative w-full h-32 rounded-md overflow-hidden group">
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
                    <div 
                      className="w-full h-32 border-2 border-dashed border-gray-300 rounded-md flex items-center justify-center text-gray-400 cursor-pointer hover:border-gray-400 hover:text-gray-500 transition-colors"
                      onClick={handleImageClick}
                    >
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
              </div>

              {/* 음성 녹음 섹션 */}
              <div className="space-y-2">
                <Label>음성 일기 (선택 사항)</Label>
                <div className="flex items-center space-x-4 p-4 border rounded-lg bg-gray-50">
                  {!audioUrl ? (
                    <div className="flex items-center space-x-2">
                      {!isRecording ? (
                        <Button
                          type="button"
                          onClick={startRecording}
                          className="bg-red-500 hover:bg-red-600 text-white"
                        >
                          <Mic className="h-4 w-4 mr-2" />
                          녹음 시작
                        </Button>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <Button
                            type="button"
                            onClick={stopRecording}
                            className="bg-gray-500 hover:bg-gray-600 text-white"
                          >
                            <MicOff className="h-4 w-4 mr-2" />
                            녹음 중지
                          </Button>
                          <span className="text-sm text-gray-600">
                            녹음 중... {formatTime(recordingTime)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Button
                        type="button"
                        onClick={toggleAudioPlayback}
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                      >
                        {isPlaying ? (
                          <Pause className="h-4 w-4 mr-2" />
                        ) : (
                          <Play className="h-4 w-4 mr-2" />
                        )}
                        {isPlaying ? "일시정지" : "재생"}
                      </Button>
                      <Button
                        type="button"
                        onClick={removeAudio}
                        variant="outline"
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="h-4 w-4 mr-2" />
                        삭제
                      </Button>
                      <span className="text-sm text-gray-600">음성 녹음 완료</span>
                    </div>
                  )}
                </div>
                {audioUrl && (
                  <audio
                    ref={audioRef}
                    src={audioUrl}
                    onEnded={() => setIsPlaying(false)}
                    className="w-full"
                  />
                )}
                <div className="text-sm text-gray-500">
                  💡 음성 녹음 후 자동으로 텍스트로 변환되어 내용에 추가됩니다.
                </div>
              </div>

              {error && <div className="text-red-500 text-sm text-center">{error}</div>}

              <Button
                type="submit"
                disabled={isUploading || isSubmitting}
                className={isSubmitting ? "opacity-50 cursor-not-allowed" : ""}
              >
                {isSubmitting ? "작성 중..." : isUploading ? "업로드 중..." : "작성 완료"}
              </Button>
            </CardContent>
          </form>
        </Card>
      </div>
    </div>
  );
}