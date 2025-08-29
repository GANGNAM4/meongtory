import { useState, useEffect } from 'react'
import { AdoptionRequest } from '@/types/admin'
import { adoptionRequestApi, petApi } from '@/lib/api'
import { formatToKST } from '@/lib/utils'

export function useAdminAdoptionRequests() {
  const [adoptionRequests, setAdoptionRequests] = useState<AdoptionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 입양신청 데이터 페칭
  const fetchAdoptionRequests = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await adoptionRequestApi.getAdoptionRequests()
      console.log('입양신청 데이터:', response)
      setAdoptionRequests(response)
    } catch (error) {
      console.error("Error fetching adoption requests:", error)
      setError('입양신청 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 입양신청 상태 업데이트
  const updateAdoptionRequestStatus = async (requestId: number, status: "PENDING" | "CONTACTED" | "APPROVED" | "REJECTED") => {
    try {
      console.log(`입양 신청 상태 변경 요청: 신청ID ${requestId}, 상태 ${status}`)
      
      const response = await adoptionRequestApi.updateAdoptionRequestStatus(requestId, status)
      console.log('업데이트된 입양 신청:', response)
      
      // 현재 입양 신청 목록에서 해당 신청만 즉시 업데이트
      setAdoptionRequests(prev => prev.map(request => 
        request.id === requestId 
          ? { ...request, status: status }
          : request
      ))
      
      // 입양신청 승인 시 해당 펫의 상태도 업데이트
      if (status === "APPROVED") {
        const approvedRequest = adoptionRequests.find(request => request.id === requestId)
        if (approvedRequest) {
          try {
            // 펫의 adopted 상태를 true로 업데이트
            await petApi.updateAdoptionStatus(approvedRequest.petId, true)
            console.log(`펫 ${approvedRequest.petId}의 입양 상태를 완료로 업데이트했습니다.`)
          } catch (error) {
            console.error('펫 상태 업데이트 실패:', error)
            throw new Error('펫 상태 업데이트에 실패했습니다.')
          }
        }
      }
      
      console.log(`입양 신청 상태 변경 완료: 신청ID ${requestId}, 상태 ${status}`)
      return true
    } catch (error) {
      console.error('입양 신청 상태 업데이트 오류:', error)
      throw new Error('입양 신청 상태 업데이트에 실패했습니다.')
    }
  }

  // 계약서 모달 표시
  const showContractModal = (request: AdoptionRequest) => {
    console.log('계약서 모달 표시:', request)
    return request
  }

  // 컴포넌트 마운트 시 데이터 페칭
  useEffect(() => {
    fetchAdoptionRequests()
  }, [])

  return {
    adoptionRequests,
    loading,
    error,
    fetchAdoptionRequests,
    updateAdoptionRequestStatus,
    showContractModal,
    formatToKST,
    refetch: fetchAdoptionRequests
  }
} 