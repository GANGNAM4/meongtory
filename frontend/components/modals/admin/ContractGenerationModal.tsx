"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { FileText, MessageSquare } from "lucide-react"
import axios from "axios"
import type { AdoptionRequest } from "@/types/admin"

interface ContractGenerationModalProps {
  isOpen: boolean
  onClose: () => void
  adoptionRequest: AdoptionRequest | null
  contractTemplates: any[]
  onGenerateContract: () => void
}

export default function ContractGenerationModal({ 
  isOpen, 
  onClose, 
  adoptionRequest, 
  contractTemplates, 
  onGenerateContract 
}: ContractGenerationModalProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null)
  const [isGeneratingContract, setIsGeneratingContract] = useState(false)
  const [generatedContract, setGeneratedContract] = useState<string | null>(null)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)

  const getBackendUrl = () => {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"
  }

  const handleGenerateContract = async () => {
    if (!adoptionRequest) {
      alert("신청 정보를 찾을 수 없습니다.")
      return
    }
    
    if (!selectedTemplate) {
      alert("템플릿을 선택해주세요.")
      return
    }

    try {
      setIsGeneratingContract(true)
      
      // 선택된 템플릿 정보 가져오기
      const selectedTemplateData = contractTemplates.find(t => t.id === selectedTemplate)
      if (!selectedTemplateData) {
        alert("템플릿 정보를 찾을 수 없습니다.")
        return
      }

      const backendUrl = getBackendUrl()

      const accessToken = localStorage.getItem('accessToken')
      if (!accessToken) {
        alert("로그인이 필요합니다.")
        return
      }

      // petId가 있으면 상세 정보 가져오기
      let petData = null
      if (adoptionRequest.petId) {
        try {
          console.log("Pet API 호출 시작:", `${getBackendUrl()}/api/pets/${adoptionRequest.petId}`)
          const petResponse = await axios.get(`${getBackendUrl()}/api/pets/${adoptionRequest.petId}`, {
            headers: {
              'Authorization': accessToken,
              'Access_Token': accessToken,
            },
          })
          
          if (petResponse.data.success) {
            petData = petResponse.data.data
            console.log("가져온 완전한 pet 데이터:", petData)
          } else {
            console.log("Pet API 응답 실패:", petResponse.data)
          }
        } catch (error) {
          console.error("pet 정보 가져오기 실패:", error)
        }
      } else {
        console.log("adoptionRequest.petId가 없어서 Pet API 호출하지 않음")
      }

      // petData가 없으면 adoptionRequest 정보로 기본값 설정
      if (!petData) {
        petData = {
          petId: adoptionRequest.petId || null,
          name: adoptionRequest.petName,
          breed: adoptionRequest.petBreed,
          age: adoptionRequest.petAge || "알 수 없음",
          gender: adoptionRequest.petGender || "UNKNOWN",
          healthStatus: adoptionRequest.petMedicalHistory || adoptionRequest.petNotes || adoptionRequest.petSpecialNeeds || "건강상태 정보 없음",
          weight: adoptionRequest.petWeight,
          vaccinated: adoptionRequest.petVaccinated || false,
          neutered: adoptionRequest.petNeutered || false
        }
        console.log("adoptionRequest 정보로 기본값 설정:", petData)
      }

      // 데이터 검증
      console.log("선택된 템플릿 ID:", selectedTemplate)
      console.log("템플릿 데이터:", selectedTemplateData)
      console.log("Pet 정보:", petData)
      console.log("신청자 정보:", {
        name: adoptionRequest.applicantName,
        phone: adoptionRequest.contactNumber,
        email: adoptionRequest.email
      })

      const requestData = {
        templateId: selectedTemplate,
        templateSections: selectedTemplateData.sections?.map((section: any) => ({ 
          title: section.title, 
          content: section.content || "" 
        })) || [],
        customSections: [],
        removedSections: [],
        petInfo: petData,
        userInfo: {
          name: adoptionRequest.applicantName || "",
          phone: adoptionRequest.contactNumber || "",
          email: adoptionRequest.email || ""
        },
        additionalInfo: adoptionRequest.message || ""
      }

      console.log("AI 서비스 요청 데이터:", JSON.stringify(requestData, null, 2))

      const response = await axios.post(`${getBackendUrl()}/api/contract-templates/ai-suggestions/generate-contract`, requestData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken,
          'Access_Token': accessToken,
        },
      })

      console.log("AI 서비스 응답:", response.data)
      console.log("AI 서비스 응답 구조:", JSON.stringify(response.data, null, 2))

      // 생성된 계약서를 백엔드에 저장
      const contractData = {
        templateId: selectedTemplate,
        templateSections: selectedTemplateData.sections?.map((section: any) => ({ 
          title: section.title, 
          content: section.content || "" 
        })) || [],
        customSections: [],
        removedSections: [],
        petInfo: petData,
        userInfo: {
          name: adoptionRequest.applicantName,
          phone: adoptionRequest.contactNumber,
          email: adoptionRequest.email
        },
        additionalInfo: adoptionRequest.message,
        shelterInfo: {
          name: "멍멍이 보호소",
          representative: "김보호",
          address: "서울시 강남구 테헤란로 123",
          phone: "02-1234-5678"
        },
        content: response.data.data?.content || response.data.content
      }

      // 백엔드에 계약서 저장
      await axios.post(`${getBackendUrl()}/api/contract-generation`, contractData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': accessToken,
          'Access_Token': accessToken,
        },
      })
      
      setGeneratedContract(response.data.data?.content || response.data.content)
      
      onGenerateContract()
      
      alert("계약서가 생성되었습니다. 입양관리 탭에서 계약서를 확인할 수 있습니다.")
    } catch (error: any) {
      console.error("계약서 생성 실패:", error)
      console.error("오류 응답 데이터:", error.response?.data)
      console.error("오류 응답 상태:", error.response?.status)
      console.error("오류 응답 헤더:", error.response?.headers)
      console.error("오류 메시지:", error.message)
      console.error("오류 코드:", error.code)
      
      if (error.response?.status === 401) {
        alert("인증이 필요합니다. 다시 로그인해주세요.")
      } else if (error.response?.status === 403) {
        alert("권한이 없습니다. 관리자 권한이 필요합니다.")
      } else if (error.response?.status === 400) {
        const errorMessage = error.response.data?.message || error.response.data?.error || '잘못된 요청 형식입니다.'
        console.error("400 오류 상세:", errorMessage)
        alert(`계약서 생성에 실패했습니다: ${errorMessage}`)
      } else if (error.response?.data?.message) {
        alert(`계약서 생성에 실패했습니다: ${error.response.data.message}`)
      } else {
        alert("계약서 생성에 실패했습니다. 다시 시도해주세요.")
      }
    } finally {
      setIsGeneratingContract(false)
    }
  }

  const handleDownloadContract = async (contractId: number) => {
    try {
      const accessToken = localStorage.getItem('accessToken')
      if (!accessToken) {
        alert("로그인이 필요합니다.")
        return
      }

      const response = await fetch(`${getBackendUrl()}/api/contract-generation/${contractId}/download`, {
        method: 'GET',
        headers: {
          'Authorization': accessToken,
          'Access_Token': accessToken,
        },
      })
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.setAttribute('download', `contract-${contractId}.pdf`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        window.URL.revokeObjectURL(url)
        
        alert("PDF 파일이 다운로드되었습니다.")
      } else {
        alert("파일 다운로드에 실패했습니다.")
      }
    } catch (error: any) {
      console.error("계약서 다운로드 실패:", error)
      
      if (error.response?.status === 401) {
        alert("인증이 필요합니다. 다시 로그인해주세요.")
      } else if (error.response?.status === 403) {
        alert("권한이 없습니다. 관리자 권한이 필요합니다.")
      } else {
        alert("파일 다운로드에 실패했습니다.")
      }
    }
  }

  const handleClose = () => {
    setSelectedTemplate(null)
    setGeneratedContract(null)
    setIsGeneratingContract(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>AI 계약서 생성</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {adoptionRequest && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">입양 신청 정보</h4>
                <div className="text-sm space-y-1">
                  <p><strong>입양견:</strong> {adoptionRequest.petName} ({adoptionRequest.petBreed})</p>
                  <p><strong>신청자:</strong> {adoptionRequest.applicantName}</p>
                  <p><strong>연락처:</strong> {adoptionRequest.contactNumber}</p>
                  <p><strong>이메일:</strong> {adoptionRequest.email}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 템플릿 선택 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      템플릿 선택
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingTemplates ? (
                      <div className="text-center py-4">
                        <p>템플릿을 불러오는 중...</p>
                      </div>
                    ) : contractTemplates.length === 0 ? (
                      <div className="text-center py-4">
                        <p>사용 가능한 템플릿이 없습니다.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {contractTemplates.map((template) => (
                          <div 
                            key={template.id}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedTemplate === template.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                            }`}
                            onClick={() => setSelectedTemplate(template.id)}
                          >
                            <h4 className="font-medium">{template.name}</h4>
                            <p className="text-sm text-gray-600">{template.description}</p>
                            <Badge variant="outline" className="mt-1">
                              {template.isDefault ? "기본 템플릿" : "사용자 템플릿"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 입양견 및 신청자 정보 */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      입양견 및 신청자 정보
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium">입양견 이름</label>
                        <input 
                          type="text" 
                          className="w-full mt-1 p-2 border rounded-md" 
                          placeholder="입양견 이름"
                          defaultValue={adoptionRequest.petName}
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">입양견 품종</label>
                        <input 
                          type="text" 
                          className="w-full mt-1 p-2 border rounded-md" 
                          placeholder="입양견 품종"
                          defaultValue={adoptionRequest.petBreed}
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">신청자 이름</label>
                        <input 
                          type="text" 
                          className="w-full mt-1 p-2 border rounded-md" 
                          placeholder="신청자 이름"
                          defaultValue={adoptionRequest.applicantName}
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium">신청자 연락처</label>
                        <input 
                          type="text" 
                          className="w-full mt-1 p-2 border rounded-md" 
                          placeholder="신청자 연락처"
                          defaultValue={adoptionRequest.contactNumber}
                          readOnly
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleClose}>
                  취소
                </Button>
                <Button 
                  className="bg-green-500 hover:bg-green-600 text-white"
                  onClick={handleGenerateContract}
                  disabled={!selectedTemplate || isGeneratingContract}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {isGeneratingContract ? "생성 중..." : "AI 계약서 생성"}
                </Button>
              </div>

              {/* 생성된 계약서 미리보기 */}
              {generatedContract && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>생성된 계약서 미리보기</CardTitle>
                      <div className="flex gap-2">
                        <Button 
                          size="sm"
                          variant="outline"
                          className="bg-white text-black border border-gray-300 hover:bg-gray-50"
                          onClick={() => handleDownloadContract(0)}
                        >
                          <FileText className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-white p-4 rounded border max-h-96 overflow-y-auto">
                      <div className="whitespace-pre-wrap text-sm">{generatedContract}</div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 