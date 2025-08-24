"use client"

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Edit, Trash2, Save, X, Mic, MicOff, Play, Pause, Camera, Share2 } from "lucide-react"
import Image from "next/image"
import { fetchDiary, updateDiary, deleteDiary, uploadImageToS3, uploadAudioToS3 } from "@/lib/diary"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/components/navigation"

export default function DiaryEntryDetail() {
  const router = useRouter()
  const params = useParams()
  const { toast } = useToast()
  const { currentUser } = useAuth()
  
  const diaryId = Number(params.id)
  
  const [entry, setEntry] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [editedEntry, setEditedEntry] = useState({
    title: "",
    content: "",
    images: [] as string[],
  })

  const [audioUrl, setAudioUrl] = useState<string>("")
  const [isRecording, setIsRecording] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const loadDiary = async () => {
      if (!diaryId) return
      
      try {
        setIsLoading(true)
        const data = await fetchDiary(diaryId)
        setEntry(data)
        setEditedEntry({
          title: data.title || "",
          content: data.text || "",
          images: data.imageUrl ? [data.imageUrl] : [],
        })
        setAudioUrl(data.audioUrl || "")
      } catch (error: any) {
        console.error("일기 불러오기 실패:", error)
        toast({
          title: "오류",
          description: "일기를 불러오는데 실패했습니다.",
          variant: "destructive",
        })
        router.push("/diary")
      } finally {
        setIsLoading(false)
      }
    }

    loadDiary()
  }, [diaryId, router, toast])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      const chunks: BlobPart[] = []
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data)

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/wav" })
        const url = URL.createObjectURL(blob)
        setAudioUrl(url)
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error("녹음 시작 실패:", error)
      toast({
        title: "오류",
        description: "마이크 권한이 필요합니다.",
        variant: "destructive",
      })
    }
  }

  const stopRecording = () => {
    mediaRecorderRef.current?.stop()
    setIsRecording(false)
  }

  const toggleAudioPlayback = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const uploadedUrl = await uploadImageToS3(e.target.files[0])
        setEditedEntry((prev) => ({ ...prev, images: [...prev.images, uploadedUrl] }))
        toast({
          title: "성공",
          description: "이미지가 업로드되었습니다.",
        })
      } catch (error) {
        console.error("이미지 업로드 실패:", error)
        toast({
          title: "오류",
          description: "이미지 업로드에 실패했습니다.",
          variant: "destructive",
        })
      }
    }
  }

  const removeImage = (index: number) => {
    setEditedEntry((prev) => ({
      ...prev,
      images: prev.images.filter((_: string, i: number) => i !== index),
    }))
  }

  const handleSave = async () => {
    try {
      const updateData = {
        title: editedEntry.title,
        text: editedEntry.content,
        imageUrl: editedEntry.images.length > 0 ? editedEntry.images[0] : undefined,
        audioUrl: audioUrl || undefined,
      }

      const updatedEntry = await updateDiary(diaryId, updateData)
      setEntry(updatedEntry)
      setIsEditing(false)
      
      toast({
        title: "성공",
        description: "일기가 수정되었습니다.",
      })
    } catch (error: any) {
      console.error("일기 수정 실패:", error)
      toast({
        title: "오류",
        description: "일기 수정에 실패했습니다.",
        variant: "destructive",
      })
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditedEntry({
      title: entry.title || "",
      content: entry.text || "",
      images: entry.imageUrl ? [entry.imageUrl] : [],
    })
    setAudioUrl(entry.audioUrl || "")
  }

  const handleDelete = async () => {
    try {
      await deleteDiary(diaryId)
      toast({
        title: "성공",
        description: "일기가 삭제되었습니다.",
      })
      router.push("/diary")
    } catch (error: any) {
      console.error("일기 삭제 실패:", error)
      toast({
        title: "오류",
        description: "일기 삭제에 실패했습니다.",
        variant: "destructive",
      })
    }
  }

  const handleBack = () => {
    router.push("/diary")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center justify-center">
            <p className="text-gray-500">로딩 중...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className="min-h-screen bg-gray-50 pt-20">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="flex items-center justify-center">
            <p className="text-gray-500">일기를 찾을 수 없습니다.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={handleBack} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">성장일기</h1>
          </div>
          {!isEditing && (
            <div className="flex space-x-2">
              {currentUser?.id === entry.userId && (
                <>
                  <Button variant="outline" onClick={() => setIsEditing(true)}>
                    <Edit className="w-4 h-4 mr-2" />수정
                  </Button>
                  <Button variant="outline" onClick={() => setShowDeleteConfirm(true)} className="text-red-600">
                    <Trash2 className="w-4 h-4 mr-2" />삭제
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={() => router.push(`/community/write?sharedFromDiary=${diaryId}`)}
                className="bg-yellow-400 hover:bg-yellow-500 text-black border-yellow-400"
              >
                <Share2 className="w-4 h-4 mr-2" />커뮤니티에 공유
              </Button>
            </div>
          )}
        </div>

        <Card>
          <CardContent className="p-8">
            {isEditing ? (
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">제목</label>
                  <Input
                    value={editedEntry.title}
                    onChange={(e) => setEditedEntry((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="일기 제목을 입력하세요"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">내용</label>
                  <Textarea
                    value={editedEntry.content}
                    onChange={(e) => setEditedEntry((prev) => ({ ...prev, content: e.target.value }))}
                    placeholder="오늘 있었던 일을 적어보세요..."
                    rows={8}
                  />
                </div>

                <div className="flex space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={isRecording ? stopRecording : startRecording}
                    className={isRecording ? "bg-red-100 border-red-300" : ""}
                  >
                    {isRecording ? (
                      <><MicOff className="w-4 h-4 mr-2" />녹음 중지</>
                    ) : (
                      <><Mic className="w-4 h-4 mr-2" />음성 녹음</>
                    )}
                  </Button>

                  {audioUrl && (
                    <Button type="button" variant="outline" onClick={toggleAudioPlayback}>
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                  )}
                </div>

                {audioUrl && (
                  <div>
                    <audio ref={audioRef} src={audioUrl} />
                    <p className="text-sm text-gray-600">음성 녹음이 추가되었습니다.</p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-medium">사진</label>
                  <div className="flex space-x-2">
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Camera className="w-4 h-4 mr-2" />사진 추가
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>

                  {editedEntry.images.length > 0 && (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                      {editedEntry.images.map((image: string, index: number) => (
                        <div key={index} className="relative">
                          <Image
                            src={image}
                            alt={`Upload ${index + 1}`}
                            width={100}
                            height={100}
                            className="w-full h-24 object-cover rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(index)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs"
                          >×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="w-4 h-4 mr-2" />취소
                  </Button>
                  <Button onClick={handleSave} className="bg-yellow-400 hover:bg-yellow-500 text-black">
                    <Save className="w-4 h-4 mr-2" />저장
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 mb-2">{entry.title}</h2>
                  <p className="text-gray-500">{entry.createdAt}</p>
                </div>
                {entry.text && (
                  <div className="prose max-w-none">
                    <p className="text-gray-700 text-lg leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                  </div>
                )}
                {entry.imageUrl && (
                  <div>
                    <h4 className="font-semibold mb-2">사진</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <Image
                        src={entry.imageUrl}
                        alt="Diary image"
                        width={200}
                        height={200}
                        className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(entry.imageUrl, "_blank")}
                      />
                    </div>
                  </div>
                )}
                {entry.audioUrl && (
                  <div>
                    <h4 className="font-semibold mb-2">음성 녹음</h4>
                    <audio controls className="w-full">
                      <source src={entry.audioUrl} type="audio/wav" />
                    </audio>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md mx-4">
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-4">일기 삭제</h3>
                <p className="text-gray-600 mb-6">정말 삭제하시겠습니까? 복구할 수 없습니다.</p>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>취소</Button>
                  <Button onClick={handleDelete} className="bg-red-600 text-white">삭제</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}