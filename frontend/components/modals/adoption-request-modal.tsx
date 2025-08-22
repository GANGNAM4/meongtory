"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { X, Plus, Trash2, User } from "lucide-react"
import { userApi } from "@/lib/api"

import type { Pet } from "@/types/pets"

interface FormField {
  id: string
  label: string
  type: "text" | "email" | "tel" | "textarea"
  required: boolean
  placeholder: string
}

interface UserInfo {
  id: number
  email: string
  name: string
  phone?: string
  address?: string
}

interface AdoptionRequestModalProps {
  isOpen: boolean
  onClose: () => void
  selectedPet: Pet | null
  onSubmit: (requestData: {
    petId: number
    [key: string]: any
  }) => void
  isAdmin?: boolean
  customFields?: FormField[]
  onUpdateCustomFields?: (fields: FormField[]) => void
}

export default function AdoptionRequestModal({
  isOpen,
  onClose,
  selectedPet,
  onSubmit,
  isAdmin = false,
  customFields = [],
  onUpdateCustomFields,
}: AdoptionRequestModalProps) {
  const [formData, setFormData] = useState<{[key: string]: string}>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isEditingFields, setIsEditingFields] = useState(false)
  const [editingFields, setEditingFields] = useState<FormField[]>(customFields)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [isLoadingUserInfo, setIsLoadingUserInfo] = useState(false)

  // 기본 필드들
  const defaultFields: FormField[] = [
    {
      id: "applicantName",
      label: "신청자 이름",
      type: "text",
      required: true,
      placeholder: "이름을 입력하세요"
    },
    {
      id: "contactNumber",
      label: "연락처",
      type: "tel",
      required: true,
      placeholder: "010-0000-0000"
    },
    {
      id: "email",
      label: "이메일",
      type: "email",
      required: false,
      placeholder: "email@example.com"
    },
    {
      id: "message",
      label: "입양 동기 및 메시지",
      type: "textarea",
      required: true,
      placeholder: "입양하고 싶은 이유와 메시지를 작성해주세요..."
    }
  ]

  // 모든 필드 (기본 + 커스텀)
  const allFields = [...defaultFields, ...customFields]

  // 사용자 정보 가져오기
  const fetchUserInfo = async () => {
    setIsLoadingUserInfo(true)
    try {
      const user = await userApi.getCurrentUser()
      setUserInfo(user)
      
      // 사용자 정보로 폼 데이터 초기화
      setFormData({
        applicantName: user.name || "",
        contactNumber: user.phone || "",
        email: user.email || "",
        message: "",
      })
    } catch (error) {
      console.error("사용자 정보 가져오기 실패:", error)
      // 사용자 정보 가져오기 실패 시 빈 폼으로 시작
      setFormData({
        applicantName: "",
        contactNumber: "",
        email: "",
        message: "",
      })
    } finally {
      setIsLoadingUserInfo(false)
    }
  }

  // 모달이 열릴 때 사용자 정보 가져오기
  useEffect(() => {
    if (isOpen && !isAdmin) {
      fetchUserInfo()
    } else if (isOpen && isAdmin) {
      // 관리자 모드일 때는 빈 폼으로 시작
      setFormData({
        applicantName: "",
        contactNumber: "",
        email: "",
        message: "",
      })
    }
  }, [isOpen, isAdmin])

  const handleInputChange = (fieldId: string, value: string) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
  }

  const handleSubmit = async () => {
    if (!selectedPet) return

    // 유효성 검사
    const requiredFields = allFields.filter(field => field.required)
    for (const field of requiredFields) {
      if (!formData[field.id]?.trim()) {
        alert(`${field.label}을(를) 입력해주세요.`)
        return
      }
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        petId: selectedPet.petId, // id -> petId로 수정
        ...formData
      })
      
      // 성공 시 폼 초기화
      setFormData({})
      onClose()
    } catch (error) {
      console.error("입양신청 실패:", error)
      alert("입양신청에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    // 폼 초기화
    setFormData({})
    setUserInfo(null)
    onClose()
  }

  // 관리자용 필드 편집 기능
  const addCustomField = () => {
    const newField: FormField = {
      id: `custom_${Date.now()}`,
      label: "새 필드",
      type: "text",
      required: false,
      placeholder: "내용을 입력하세요"
    }
    const updatedFields = [...editingFields, newField]
    setEditingFields(updatedFields)
    if (onUpdateCustomFields) {
      onUpdateCustomFields(updatedFields)
    }
  }

  const removeCustomField = (fieldId: string) => {
    const updatedFields = editingFields.filter(field => field.id !== fieldId)
    setEditingFields(updatedFields)
    if (onUpdateCustomFields) {
      onUpdateCustomFields(updatedFields)
    }
  }

  const updateCustomField = (fieldId: string, updates: Partial<FormField>) => {
    const updatedFields = editingFields.map(field => 
      field.id === fieldId ? { ...field, ...updates } : field
    )
    setEditingFields(updatedFields)
    if (onUpdateCustomFields) {
      onUpdateCustomFields(updatedFields)
    }
  }

  if (!selectedPet) return null

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold">입양신청</DialogTitle>
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditingFields(!isEditingFields)}
              >
                {isEditingFields ? "편집 완료" : "필드 편집"}
              </Button>
            )}
          </div>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* 선택된 동물 정보 */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-semibold text-lg mb-2">{selectedPet.name} ({selectedPet.breed})</h3>
            <p className="text-sm text-gray-600">
              {selectedPet.age} • {selectedPet.gender} • {selectedPet.location}
            </p>
          </div>

          {/* 사용자 정보 로딩 중 */}
          {isLoadingUserInfo && !isAdmin && (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-400"></div>
              <span className="ml-2 text-sm text-gray-600">사용자 정보를 불러오는 중...</span>
            </div>
          )}

          {/* 사용자 정보 미리보기 (관리자 모드가 아닐 때) */}
          {userInfo && !isAdmin && (
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <User className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">회원 정보</span>
              </div>
              <div className="text-sm text-blue-700">
                <p>이름: {userInfo.name}</p>
                <p>이메일: {userInfo.email}</p>
                {userInfo.phone && <p>연락처: {userInfo.phone}</p>}
              </div>
            </div>
          )}

          {/* 신청자 정보 입력 */}
          <div className="space-y-4">
            {allFields.map((field) => (
              <div key={field.id}>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor={field.id}>
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </Label>
                  {isAdmin && isEditingFields && field.id.startsWith('custom_') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeCustomField(field.id)}
                      className="h-6 w-6 p-0 text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                
                {field.type === "textarea" ? (
                  <Textarea
                    id={field.id}
                    value={formData[field.id] || ""}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    rows={4}
                    required={field.required}
                  />
                ) : (
                  <Input
                    id={field.id}
                    type={field.type}
                    value={formData[field.id] || ""}
                    onChange={(e) => handleInputChange(field.id, e.target.value)}
                    placeholder={field.placeholder}
                    required={field.required}
                  />
                )}
              </div>
            ))}

            {/* 관리자용 커스텀 필드 추가 버튼 */}
            {isAdmin && isEditingFields && (
              <Button
                variant="outline"
                onClick={addCustomField}
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                필드 추가
              </Button>
            )}
          </div>

          {/* 버튼 */}
          <div className="flex justify-end space-x-3 pt-4">
            <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
              취소
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting || !allFields.every(field => !field.required || formData[field.id]?.trim())}
              className="bg-yellow-400 hover:bg-yellow-500 text-black"
            >
              {isSubmitting ? "신청 중..." : "입양신청"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 