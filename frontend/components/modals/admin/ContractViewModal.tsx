"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileText } from "lucide-react"
import type { Pet } from "@/types/pets"

interface ContractViewModalProps {
  isOpen: boolean
  onClose: () => void
  contract: any
  pet?: any // pet 정보 추가
  onEdit?: (contract: any) => void // 수정 버튼 클릭 시 호출될 함수
}

export default function ContractViewModal({ isOpen, onClose, contract, pet, onEdit }: ContractViewModalProps) {
  // petInfo 파싱 함수
  const parsePetInfo = (contract: any) => {
    if (!contract) return null
    
    try {
      if (contract.petInfo) {
        return typeof contract.petInfo === 'string' 
          ? JSON.parse(contract.petInfo) 
          : contract.petInfo
      }
      return null
    } catch (error) {
      console.error("petInfo 파싱 오류:", error)
      return null
    }
  }

  const petInfo = parsePetInfo(contract)
  
  // 디버깅용 로그
  console.log("Contract data:", contract)
  console.log("Parsed petInfo:", petInfo)
  console.log("Pet data:", pet)
  console.log("Pet gender:", pet?.gender)

  const handleDownloadContract = async (contractId: number) => {
    try {
      const response = await fetch(`http://localhost:8080/api/contract-generation/${contractId}/download`, {
        method: 'GET',
        headers: {
          'Access_Token': localStorage.getItem('accessToken') || '',
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
    } catch (error) {
      console.error("계약서 다운로드 실패:", error)
      alert("파일 다운로드에 실패했습니다.")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            계약서 상세 보기
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {contract && (
            <div className="space-y-6">
              {/* 동물 정보 - 입양관리에서만 표시 */}
              {pet && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3 text-gray-800">동물 정보</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16">이름:</span>
                      <span className="text-gray-900">{pet?.name || petInfo?.name || contract.petName || contract.name || "정보 없음"}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16">품종:</span>
                      <span className="text-gray-900">{pet?.breed || petInfo?.breed || contract.petBreed || contract.breed || "정보 없음"}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16">나이:</span>
                      <span className="text-gray-900">{pet?.age ? `${pet.age}살` : petInfo?.age || contract.petAge || contract.age || "정보 없음"}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16">성별:</span>
                      <span className="text-gray-900">
                        {(() => {
                          if (pet?.gender === 'MALE') return '수컷'
                          if (pet?.gender === 'FEMALE') return '암컷'
                                                  if (pet?.gender === 'UNKNOWN') return '알 수 없음'
                        if (petInfo?.gender === 'MALE') return '수컷'
                        if (petInfo?.gender === 'FEMALE') return '암컷'
                        if (petInfo?.gender === 'UNKNOWN') return '알 수 없음'
                        if (contract.petGender === 'MALE') return '수컷'
                        if (contract.petGender === 'FEMALE') return '암컷'
                        if (contract.petGender === 'UNKNOWN') return '알 수 없음'
                        if (contract.gender === 'MALE') return '수컷'
                        if (contract.gender === 'FEMALE') return '암컷'
                        if (contract.gender === 'UNKNOWN') return '알 수 없음'
                          return "정보 없음"
                        })()}
                      </span>
                    </div>
                                      <div className="flex items-center">
                    <span className="font-medium text-gray-700 w-16">체중:</span>
                    <span className="text-gray-900">{petInfo?.weight !== undefined ? `${petInfo.weight}kg` : "정보 없음"}</span>
                  </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16">예방접종:</span>
                      <span className="text-gray-900">{petInfo?.vaccinated ? "완료" : "미완료"}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16">중성화:</span>
                      <span className="text-gray-900">{petInfo?.neutered ? "완료" : "미완료"}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16">건강상태:</span>
                      <span className="text-gray-900">{pet?.medicalHistory || petInfo?.healthStatus || contract.healthStatus || "정보 없음"}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 계약서 내용 */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">계약서 내용</h4>
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      variant="outline"
                      className="bg-white text-black border border-gray-300 hover:bg-gray-50"
                      onClick={() => handleDownloadContract(contract.id || 0)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      PDF 다운로드
                    </Button>
                    {onEdit && (
                      <Button 
                        size="sm"
                        variant="outline"
                        className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"
                        onClick={() => onEdit(contract)}
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        수정하기
                      </Button>
                    )}
                  </div>
                </div>
                <div className="bg-white p-4 rounded border max-h-96 overflow-y-auto">
                  {contract.content ? (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{contract.content}</div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>계약서 내용을 불러올 수 없습니다.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={onClose}>
                  닫기
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 