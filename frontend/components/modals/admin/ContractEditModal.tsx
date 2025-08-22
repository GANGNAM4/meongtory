"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileText } from "lucide-react"
import axios from "axios"

interface ContractEditModalProps {
  isOpen: boolean
  onClose: () => void
  editingContract: any
  onUpdateContract: () => void
  pet?: any // pet 정보 추가
}

export default function ContractEditModal({ isOpen, onClose, editingContract, onUpdateContract, pet }: ContractEditModalProps) {
  const [contractData, setContractData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)

  const getBackendUrl = () => {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"
  }

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

  useEffect(() => {
    if (editingContract) {
      setContractData({
        ...editingContract,
        content: editingContract.content || ""
      })
    }
  }, [editingContract])

  const handleUpdateContract = async () => {
    if (!editingContract || !contractData) return

    try {
      setIsLoading(true)
      
      const response = await axios.put(`${getBackendUrl()}/api/contract-generation/${editingContract.id}`, {
        content: contractData.content
      })

      if (response.data.success) {
        alert("계약서가 수정되었습니다.")
        onClose()
        onUpdateContract()
      } else {
        alert("계약서 수정에 실패했습니다.")
      }
    } catch (error) {
      console.error("계약서 수정 실패:", error)
      alert("계약서 수정에 실패했습니다.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setContractData(null)
    setIsLoading(false)
    onClose()
  }

  if (!contractData) return null

  const petInfo = parsePetInfo(editingContract)

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            계약서 수정
          </DialogTitle>
        </DialogHeader>
        
        {editingContract && (
          <div className="space-y-6">
            {/* 동물 정보 - 입양관리에서만 표시 */}
            {pet && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <h4 className="font-medium mb-3 text-gray-800">동물 정보</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700 w-16">이름:</span>
                    <span className="text-gray-900">{pet?.name || petInfo?.name || editingContract.petName || editingContract.name || "정보 없음"}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700 w-16">품종:</span>
                    <span className="text-gray-900">{pet?.breed || petInfo?.breed || editingContract.petBreed || editingContract.breed || "정보 없음"}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700 w-16">나이:</span>
                    <span className="text-gray-900">{pet?.age ? `${pet.age}살` : petInfo?.age || editingContract.petAge || editingContract.age || "정보 없음"}</span>
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
                        if (editingContract.petGender === 'MALE') return '수컷'
                        if (editingContract.petGender === 'FEMALE') return '암컷'
                        if (editingContract.petGender === 'UNKNOWN') return '알 수 없음'
                        if (editingContract.gender === 'MALE') return '수컷'
                        if (editingContract.gender === 'FEMALE') return '암컷'
                        if (editingContract.gender === 'UNKNOWN') return '알 수 없음'
                        return "정보 없음"
                      })()}
                    </span>
                  </div>
                                      <div className="flex items-center">
                      <span className="font-medium text-gray-700 w-16">체중:</span>
                      <span className="text-gray-900">{petInfo?.weight !== undefined ? `${petInfo.weight}kg` : "정보 없음"}</span>
                    </div>
                  <div className="flex items-center">
                    <span className="font-medium text-gray-700 w-16">건강상태:</span>
                    <span className="text-gray-900">{pet?.medicalHistory || petInfo?.healthStatus || editingContract.healthStatus || "정보 없음"}</span>
                  </div>
                </div>
              </div>
            )}

            {/* 계약서 내용 수정 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-lg">계약서 내용</h4>
                <div className="text-sm text-gray-500">
                  계약서 내용을 직접 수정할 수 있습니다
                </div>
              </div>
              
              <div className="border rounded-lg bg-white">
                <textarea 
                  className="w-full h-80 p-4 border-0 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={contractData.content || ""}
                  onChange={(e) => setContractData({
                    ...contractData,
                    content: e.target.value
                  })}
                  placeholder="계약서 내용을 수정하세요..."
                />
              </div>
            </div>

            {/* 버튼 */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={handleClose}>
                취소
              </Button>
              <Button 
                onClick={handleUpdateContract}
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? "수정 중..." : "수정 완료"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
} 