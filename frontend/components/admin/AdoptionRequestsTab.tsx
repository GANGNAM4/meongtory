"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Users, Phone, Mail, CheckCircle, XCircle, AlertCircle, Heart } from "lucide-react"
import { AdoptionRequest } from "@/types/admin"
import { adoptionRequestApi, petApi } from "@/lib/api"
import { formatToKST, getCurrentKSTDate } from "@/lib/utils"

interface AdoptionRequestsTabProps {
  onShowContractModal: (request: AdoptionRequest) => void
  onRefreshPets?: () => void
}

export default function AdoptionRequestsTab({
  onShowContractModal,
  onRefreshPets,
}: AdoptionRequestsTabProps) {
  const [adoptionRequests, setAdoptionRequests] = useState<AdoptionRequest[]>([])
  const [filteredRequests, setFilteredRequests] = useState<AdoptionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")

  // 입양신청 데이터 페칭
  const fetchAdoptionRequests = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await adoptionRequestApi.getAdoptionRequests()
      
      // response가 배열인지 확인
      if (!response || !Array.isArray(response)) {
        console.error('입양신청 API 응답이 배열이 아닙니다:', response)
        setAdoptionRequests([])
        return
      }
      
      setAdoptionRequests(response)
    } catch (error) {
      console.error('입양 신청 데이터 페칭 실패:', error)
      setAdoptionRequests([])
    } finally {
      setLoading(false)
    }
  }

  // 입양신청 상태 업데이트
  const handleUpdateAdoptionRequestStatus = async (requestId: number, status: "PENDING" | "CONTACTED" | "APPROVED" | "REJECTED") => {
    try {
      const response = await adoptionRequestApi.updateAdoptionRequestStatus(requestId, status);
      
      // 현재 입양 신청 목록에서 해당 신청만 업데이트
      setAdoptionRequests(prev => prev.map(request => 
        request.id === requestId 
          ? { ...request, status: status }
          : request
      ));
      
      // 입양신청 승인 시 해당 펫의 상태도 업데이트
      if (status === "APPROVED") {
        const approvedRequest = adoptionRequests.find(request => request.id === requestId);
        if (approvedRequest) {
          try {
            // 펫의 adopted 상태를 true로 업데이트
            await petApi.updateAdoptionStatus(approvedRequest.petId, true);
          } catch (error) {
            console.error('펫 상태 업데이트 실패:', error);
          }
        }
      }
      
      // 입양신청 상태 변경 후 펫 목록도 업데이트
      if (onRefreshPets) {
        setTimeout(() => {
          onRefreshPets()
        }, 100)
      }
      
      const statusMessage = status === 'APPROVED' ? '승인 (MyPet에 자동 등록되었습니다)' : 
                           status === 'REJECTED' ? '거절' : 
                           status === 'CONTACTED' ? '연락완료' : '대기중'
      alert(`입양 신청 상태가 ${statusMessage}로 변경되었습니다.`);
    } catch (error) {
      console.error('입양 신청 상태 업데이트 오류:', error);
      alert('입양 신청 상태 업데이트에 실패했습니다.');
    }
  }

  // 컴포넌트 마운트 시 데이터 페칭
  useEffect(() => {
    fetchAdoptionRequests()
  }, [])

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-100 text-yellow-800"
      case "CONTACTED":
        return "bg-blue-100 text-blue-800"
      case "APPROVED":
        return "bg-green-100 text-green-800"
      case "REJECTED":
        return "bg-red-100 text-red-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  // 긴급 신청 여부 확인 (24시간 이상 대기)
  const isUrgent = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = new Date()
    const diffHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    return diffHours > 24
  }

  // 처리율 계산
  const getProcessingRate = () => {
    if (!adoptionRequests || adoptionRequests.length === 0) return 0
    const processed = (adoptionRequests ?? []).filter(request => 
      request.status === "APPROVED" || request.status === "REJECTED" || request.status === "CONTACTED"
    ).length
    return Math.round((processed / (adoptionRequests ?? []).length) * 100)
  }

  // 필터링 및 검색 함수
  const filterRequests = () => {
    let filtered = adoptionRequests

    // 상태별 필터링
    if (statusFilter !== "ALL") {
      filtered = filtered.filter(request => request.status === statusFilter)
    }

    // 검색어 필터링
    if (searchTerm) {
      filtered = filtered.filter(request => 
        request.applicantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.petName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.petBreed.toLowerCase().includes(searchTerm.toLowerCase()) ||
        request.contactNumber.includes(searchTerm) ||
        request.email.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // 정렬
    filtered.sort((a, b) => {
      if (a.status === "PENDING" && b.status !== "PENDING") return -1
      if (a.status !== "PENDING" && b.status === "PENDING") return 1
      if (a.status === "PENDING" && b.status === "PENDING") {
        const aUrgent = isUrgent(a.createdAt)
        const bUrgent = isUrgent(b.createdAt)
        if (aUrgent && !bUrgent) return -1
        if (!aUrgent && bUrgent) return 1
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })

    setFilteredRequests(filtered)
  }

  // 필터링 실행
  useEffect(() => {
    filterRequests()
  }, [adoptionRequests, searchTerm, statusFilter])

  // CSV 내보내기 함수
  const exportToCSV = () => {
    const headers = [
      "신청ID", "펫명", "품종", "신청자명", "연락처", "이메일", 
      "상태", "신청일", "메시지", "회원ID"
    ]
    
    const csvData = filteredRequests.map(request => [
      request.id,
      request.petName,
      request.petBreed,
      request.applicantName,
      request.contactNumber,
      request.email,
      request.status === "PENDING" ? "대기중" : 
      request.status === "CONTACTED" ? "연락완료" : 
      request.status === "APPROVED" ? "승인" : "거절",
      request.createdAt ? formatToKST(request.createdAt) : "날짜 없음",
      request.message,
      request.userId
    ])
    
    const csvContent = [
      headers.join(","),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(","))
    ].join("\n")
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `입양신청_${getCurrentKSTDate()}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p>입양신청 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-600">데이터를 불러오는 중 오류가 발생했습니다.</p>
        <Button onClick={fetchAdoptionRequests} className="mt-4">
          다시 시도
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">입양신청 관리</h2>

      {/* 검색 및 필터 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="신청자명, 펫명, 품종, 연락처로 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-yellow-400"
        >
          <option value="ALL">전체 상태</option>
          <option value="PENDING">대기중</option>
          <option value="CONTACTED">연락완료</option>
          <option value="APPROVED">승인</option>
          <option value="REJECTED">거절</option>
        </select>
        <Button 
          onClick={exportToCSV}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          CSV 내보내기
        </Button>
      </div>

      {/* 통계 요약 */}
      <div className="flex items-center justify-between mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-1">
          <Card key="pending">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-yellow-600">
                {filteredRequests.filter(r => r.status === "PENDING").length}
              </div>
              <p className="text-xs text-gray-600">대기중</p>
            </CardContent>
          </Card>
          <Card key="contacted">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-blue-600">
                {filteredRequests.filter(r => r.status === "CONTACTED").length}
              </div>
              <p className="text-xs text-gray-600">연락완료</p>
            </CardContent>
          </Card>
          <Card key="approved">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {filteredRequests.filter(r => r.status === "APPROVED").length}
              </div>
              <p className="text-xs text-gray-600">승인</p>
            </CardContent>
          </Card>
          <Card key="rejected">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-red-600">
                {filteredRequests.filter(r => r.status === "REJECTED").length}
              </div>
              <p className="text-xs text-gray-600">거절</p>
            </CardContent>
          </Card>
        </div>
        <div className="text-sm text-gray-600 ml-4">
          총 {(filteredRequests ?? []).length}건 (전체 {(adoptionRequests ?? []).length}건)
        </div>
      </div>

      <div className="grid gap-4">
        {(filteredRequests ?? []).length > 0 ? (
          filteredRequests.map((request, index) => (
            <Card key={request.id || `request-${index}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-3">
                      <h3 className="font-semibold">{request.petName} ({request.petBreed}) 입양신청</h3>
                      <div className="flex items-center space-x-2">
                        <Badge className={getStatusColor(request.status)}>
                          {request.status === "PENDING" ? "대기중" : 
                           request.status === "CONTACTED" ? "연락완료" : 
                           request.status === "APPROVED" ? "승인" : "거절"}
                        </Badge>
                        {request.status === "PENDING" && isUrgent(request.createdAt) && (
                          <Badge className="bg-red-100 text-red-800 animate-pulse">
                            긴급
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">신청자: {request.applicantName}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">연락처: {request.contactNumber}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Mail className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">이메일: {request.email}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="text-sm">회원 ID: {request.userId}</span>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{request.message}</p>
                    <p className="text-xs text-gray-500">
                      신청일: {request.createdAt ? formatToKST(request.createdAt) : "날짜 없음"}
                      {request.status === "PENDING" && request.createdAt && (
                        <span className="ml-2 text-red-600">
                          ({Math.floor((new Date().getTime() - new Date(request.createdAt).getTime()) / (1000 * 60 * 60))}시간 경과)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-col space-y-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateAdoptionRequestStatus(request.id, "CONTACTED")}
                      disabled={request.status === "CONTACTED"}
                    >
                      <Phone className="h-4 w-4 mr-1" />
                      연락완료
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateAdoptionRequestStatus(request.id, "APPROVED")}
                      disabled={request.status === "APPROVED"}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      승인
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUpdateAdoptionRequestStatus(request.id, "REJECTED")}
                      disabled={request.status === "REJECTED"}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      거절
                    </Button>
                    {request.status === "APPROVED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onShowContractModal(request)}
                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
                      >
                        AI 계약서 생성
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="p-6 text-center text-gray-500">
            <div className="space-y-4">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                <Heart className="w-8 h-8 text-gray-400" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {(adoptionRequests ?? []).length === 0 ? "입양신청이 없습니다" : "검색 결과가 없습니다"}
                </h3>
                <p className="text-gray-500">
                  {(adoptionRequests ?? []).length === 0 
                    ? "아직 입양신청이 접수되지 않았습니다." 
                    : "검색 조건을 변경해보세요."}
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
} 