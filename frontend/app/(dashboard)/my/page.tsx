"use client"

import React, { useState, useEffect, useCallback } from 'react'
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { format } from "date-fns"
import { formatToKST } from "@/lib/utils"
import { adoptionRequestApi, userApi } from "@/lib/api"
import { myPetApi, MyPetRequestDto, MyPetResponseDto } from "@/lib/mypet"
import { Edit, X, Plus, Trash2, Camera } from "lucide-react"
import axios from "axios"
import type { MyPet } from "@/types/pets"

interface AdoptionInquiry {
  id: number
  petId: number
  petName: string
  inquirerName: string
  phone: string
  email: string
  message: string
  status: "대기중" | "연락완료" | "승인" | "거절"
  date: string
}

interface AdoptionRequest {
  id: number
  petId: number
  petName: string
  petBreed: string
  userId: number
  userName: string
  applicantName: string
  contactNumber: string
  email: string
  message: string
  status: "PENDING" | "CONTACTED" | "APPROVED" | "REJECTED"
  createdAt: string
  updatedAt: string
}

interface OrderItem {
  id: number
  productId: number
  productName: string
  price: number
  quantity: number
  orderDate: string
  status: "completed" | "pending" | "cancelled"
  ImageUrl: string
}


export default function MyPage() {
  const [activeTab, setActiveTab] = useState("userInfo")
  const [isEditingUserInfo, setIsEditingUserInfo] = useState(false)
  const [userInfo, setUserInfo] = useState<any>(null)
  const [editedName, setEditedName] = useState("")
  const [editedEmail, setEditedEmail] = useState("")
  const [adoptionRequests, setAdoptionRequests] = useState<AdoptionRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<AdoptionRequest | null>(null)
  const [editForm, setEditForm] = useState({
    applicantName: "",
    contactNumber: "",
    email: "",
    message: ""
  })

  // MyPet 관련 상태
  const [myPets, setMyPets] = useState<MyPetResponseDto[]>([])
  const [showPetModal, setShowPetModal] = useState(false)
  const [selectedPet, setSelectedPet] = useState<MyPetResponseDto | null>(null)
  const [petForm, setPetForm] = useState<MyPetRequestDto>({
    name: "",
    breed: "",
    age: undefined,
    gender: "UNKNOWN",
    type: "",
    weight: undefined,
    imageUrl: ""
  })
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string>("")

  // 주문 내역 상태 추가
  const [orders, setOrders] = useState<any[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)

  // 주문 내역 가져오기
  const fetchOrders = async () => {
    setOrdersLoading(true)
    try {
      const token = localStorage.getItem('accessToken')
      
      // 먼저 현재 사용자 정보를 가져와서 accountId를 얻습니다
      const userResponse = await axios.get('http://localhost:8080/api/accounts/me', {
        headers: {
          "Access_Token": token,
          "Refresh_Token": localStorage.getItem('refreshToken') || ''
        }
      })
      
      console.log('사용자 정보 응답 전체:', userResponse.data)
      const accountId = userResponse.data.data?.id || userResponse.data.id
      console.log('현재 사용자 accountId:', accountId)
      
      if (!accountId) {
        console.error('사용자 ID를 찾을 수 없습니다.')
        return
      }
      
      // 사용자별 주문 조회 API 호출
      const response = await axios.get(`http://localhost:8080/api/orders/user/${accountId}`, {
        headers: {
          "Access_Token": token,
          "Refresh_Token": localStorage.getItem('refreshToken') || ''
        }
      })
      
      console.log('사용자별 주문 데이터:', response.data)
      
      // 백엔드에서 받은 데이터를 프론트엔드 형식으로 변환 (결제 완료된 주문만)
      const convertedOrders = response.data
        .filter((order: any) => order.status === 'PAID') // 결제 완료된 주문만 필터링
        .map((order: any) => ({
          orderId: order.id,
          userId: order.accountId,
          amount: order.amount,
          paymentStatus: 'COMPLETED', // 결제 완료된 주문만 표시하므로 항상 COMPLETED
          orderedAt: order.createdAt,
          orderItems: [{
            id: order.id,
            productId: order.productId,
            productName: order.productName,
            price: order.amount,
            quantity: order.quantity,
            orderDate: order.createdAt,
            status: 'completed', // 결제 완료된 주문만 표시하므로 항상 completed
            ImageUrl: order.imageUrl || "/placeholder.svg"
          }]
        }))
      
      console.log('변환된 주문 데이터:', convertedOrders)
      setOrders(convertedOrders)
    } catch (error) {
      console.error('주문 내역을 가져오는데 실패했습니다:', error)
      if (axios.isAxiosError(error)) {
        console.error('Axios 오류:', error.response?.data)
        console.error('상태 코드:', error.response?.status)
        console.error('에러 메시지:', error.message)
        
        // 401 Unauthorized인 경우 로그인 페이지로 리다이렉트
        if (error.response?.status === 401) {
          console.error('인증이 필요합니다. 로그인 페이지로 이동합니다.')
          // 로그인 페이지로 리다이렉트 로직 추가
        }
      }
      // 에러가 발생해도 빈 배열로 설정하여 UI가 깨지지 않도록 함
      setOrders([])
    } finally {
      setOrdersLoading(false)
    }
  }

  // 사용자 정보 가져오기
  const fetchUserInfo = async () => {
    try {
      console.log("사용자 정보 요청 시작...")
      const response = await userApi.getCurrentUser()
      console.log("사용자 정보 응답:", response)
      setUserInfo(response)
      setEditedName(response.name || "")
      setEditedEmail(response.email || "")
    } catch (error) {
      console.error("사용자 정보를 가져오는데 실패했습니다:", error)
    }
  }

  // 입양신청 데이터 가져오기
  const fetchAdoptionRequests = async () => {
    setLoading(true)
    try {
      const response = await adoptionRequestApi.getUserAdoptionRequests()
      setAdoptionRequests(response)
    } catch (error) {
      console.error("입양신청 데이터를 가져오는데 실패했습니다:", error)
    } finally {
      setLoading(false)
    }
  }

  // 내 펫 데이터 가져오기
  const fetchMyPets = async () => {
    try {
      const response = await myPetApi.getMyPets()
      setMyPets(response.myPets)
    } catch (error) {
      console.error("내 펫 데이터를 가져오는데 실패했습니다:", error)
    }
  }

  // 컴포넌트 마운트 시 데이터 가져오기
  useEffect(() => {
    console.log("MyPage 컴포넌트 마운트됨")
    console.log("fetchUserInfo 함수 호출 시작")
    fetchUserInfo()
    console.log("fetchAdoptionRequests 함수 호출 시작")
    fetchAdoptionRequests()
    console.log("fetchMyPets 함수 호출 시작")
    fetchMyPets()
    console.log("fetchOrders 함수 호출 시작")
    fetchOrders()
    console.log("MyPage useEffect 완료")
  }, [])

  // 주문 내역 탭이 활성화될 때 주문 데이터 새로고침
  useEffect(() => {
    if (activeTab === "orders") {
      fetchOrders()
    }
  }, [activeTab])

  // 관리자 페이지에서 주문 상태 변경 시 자동 새로고침
  const handleOrderStatusUpdate = useCallback(() => {
    console.log('주문 상태 변경 감지 - 마이페이지 주문 내역 새로고침')
    fetchOrders()
  }, [])

  useEffect(() => {
    window.addEventListener('orderStatusUpdated', handleOrderStatusUpdate)
    
    return () => {
      window.removeEventListener('orderStatusUpdated', handleOrderStatusUpdate)
    }
  }, [handleOrderStatusUpdate])

  console.log("userInfo 상태:", userInfo)
  console.log("userInfo가 null인지 확인:", userInfo === null)
  
  if (!userInfo) {
    console.log("userInfo가 null이므로 로그인 필요 메시지 표시")
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="p-8 text-center">
          <CardContent>
            <h2 className="text-2xl font-bold text-red-600 mb-4">로그인이 필요합니다</h2>
            <p className="text-gray-600 mb-4">마이페이지를 이용하려면 로그인해주세요.</p>
            <Button onClick={() => window.history.back()}>이전 페이지로</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const handleUserInfoSave = () => {
    // Here you would typically send the updated info to a backend
    console.log("Updated User Info:", { name: editedName, email: editedEmail })
    setIsEditingUserInfo(false)
  }

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

  const getStatusText = (status: string) => {
    switch (status) {
      case "PENDING":
        return "대기중"
      case "CONTACTED":
        return "연락완료"
      case "APPROVED":
        return "승인"
      case "REJECTED":
        return "거절"
      default:
        return status
    }
  }

  // 수정 모달 열기
  const handleEditRequest = (request: AdoptionRequest) => {
    setSelectedRequest(request)
    setEditForm({
      applicantName: request.applicantName,
      contactNumber: request.contactNumber,
      email: request.email,
      message: request.message
    })
    setShowEditModal(true)
  }

  // 수정 모달 닫기
  const handleCloseEditModal = () => {
    setShowEditModal(false)
    setSelectedRequest(null)
    setEditForm({
      applicantName: "",
      contactNumber: "",
      email: "",
      message: ""
    })
  }

  // 입양신청 수정
  const handleUpdateRequest = async () => {
    if (!selectedRequest) return

    try {
      await adoptionRequestApi.updateAdoptionRequest(selectedRequest.id, editForm)
      
      // 로컬 상태 업데이트
      setAdoptionRequests(prev => prev.map(request => 
        request.id === selectedRequest.id 
          ? { ...request, ...editForm }
          : request
      ))
      
      alert("입양신청이 성공적으로 수정되었습니다.")
      handleCloseEditModal()
    } catch (error) {
      console.error('입양신청 수정 오류:', error)
      alert('입양신청 수정에 실패했습니다.')
    }
  }

  // 펫 등록/수정 모달 열기
  const handleOpenPetModal = (pet?: MyPetResponseDto) => {
    if (pet) {
      setSelectedPet(pet)
      setPetForm({
        name: pet.name,
        breed: pet.breed || "",
        age: pet.age,
        gender: pet.gender || "UNKNOWN",
        type: pet.type || "",
        weight: pet.weight,
        imageUrl: pet.imageUrl || ""
      })
      setImagePreview(pet.imageUrl || "")
    } else {
      setSelectedPet(null)
      setPetForm({
        name: "",
        breed: "",
        age: undefined,
        gender: "UNKNOWN",
        type: "",
        weight: undefined,
        imageUrl: ""
      })
      setImagePreview("")
    }
    setShowPetModal(true)
  }

  // 펫 등록/수정 모달 닫기
  const handleClosePetModal = () => {
    setShowPetModal(false)
    setSelectedPet(null)
    setSelectedImage(null)
    setImagePreview("")
  }

  // 이미지 선택 처리
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log("이미지 선택 이벤트 발생:", event)
    const file = event.target.files?.[0]
    console.log("선택된 파일:", file)
    if (file) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        console.log("파일 읽기 완료:", e.target?.result)
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // 펫 등록/수정 처리
  const handleSavePet = async () => {
    try {
      let imageUrl = petForm.imageUrl

      // 새 이미지가 선택된 경우 업로드
      if (selectedImage) {
        imageUrl = await myPetApi.uploadPetImage(selectedImage)
      }

      const petData = {
        ...petForm,
        imageUrl
      }

      if (selectedPet) {
        // 수정
        await myPetApi.updateMyPet(selectedPet.myPetId, petData)
        alert("펫 정보가 수정되었습니다.")
      } else {
        // 등록
        await myPetApi.registerMyPet(petData)
        alert("펫이 등록되었습니다.")
      }

      // 목록 새로고침
      fetchMyPets()
      handleClosePetModal()
    } catch (error) {
      console.error('펫 저장 오류:', error)
      alert('펫 저장에 실패했습니다.')
    }
  }

  // 펫 삭제 처리
  const handleDeletePet = async (petId: number) => {
    if (confirm("정말로 이 펫을 삭제하시겠습니까?")) {
      try {
        await myPetApi.deleteMyPet(petId)
        alert("펫이 삭제되었습니다.")
        fetchMyPets()
      } catch (error) {
        console.error('펫 삭제 오류:', error)
        alert('펫 삭제에 실패했습니다.')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">마이페이지</h1>
            <p className="text-gray-600 mt-2">{userInfo.name}님의 정보</p>
          </div>
          <Button onClick={() => window.history.back()} variant="outline">
            이전 페이지로
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="userInfo">사용자 정보</TabsTrigger>
            <TabsTrigger value="petInfo">펫 정보</TabsTrigger>
            <TabsTrigger value="orders">주문 내역</TabsTrigger>
            <TabsTrigger value="adoptionHistory">입양 내역</TabsTrigger>
          </TabsList>

          {/* 사용자 정보 Tab */}
          <TabsContent value="userInfo" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>사용자 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">이름</Label>
                  {isEditingUserInfo ? (
                    <Input id="name" value={editedName} onChange={(e) => setEditedName(e.target.value)} />
                  ) : (
                    <p className="text-gray-700 font-medium">{userInfo.name}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">이메일</Label>
                  {isEditingUserInfo ? (
                    <Input id="email" value={editedEmail} onChange={(e) => setEditedEmail(e.target.value)} disabled />
                  ) : (
                    <p className="text-gray-700 font-medium">{userInfo.email}</p>
                  )}
                </div>
                <div className="flex justify-end">
                  {isEditingUserInfo ? (
                    <Button onClick={handleUserInfoSave}>저장</Button>
                  ) : (
                    <Button onClick={() => setIsEditingUserInfo(true)} variant="outline">
                      정보 수정
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 펫 정보 Tab */}
          <TabsContent value="petInfo" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">나의 펫 정보</h2>
              <Button onClick={() => handleOpenPetModal()} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                펫 등록
              </Button>
            </div>
            
            {myPets.length > 0 ? (
              <div className="grid gap-4">
                {myPets.map((pet) => (
                  <Card key={pet.myPetId}>
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <div className="relative">
                          <Image
                            src={pet.imageUrl || "/placeholder.svg"}
                            alt={pet.name}
                            width={120}
                            height={120}
                            className="rounded-lg object-cover"
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-xl font-semibold">{pet.name}</h3>
                            <div className="flex items-center space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenPetModal(pet)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDeletePet(pet.myPetId)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="font-medium">품종:</span> {pet.breed || "미등록"}
                            </div>
                            <div>
                              <span className="font-medium">나이:</span> {pet.age ? `${pet.age}살` : "미등록"}
                            </div>
                            <div>
                              <span className="font-medium">성별:</span> {
                                pet.gender === "MALE" ? "수컷" : 
                                pet.gender === "FEMALE" ? "암컷" : "미등록"
                              }
                            </div>
                            <div>
                              <span className="font-medium">종류:</span> {pet.type || "미등록"}
                            </div>
                            {pet.weight && (
                              <div>
                                <span className="font-medium">체중:</span> {pet.weight}kg
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center text-gray-500">
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">등록된 펫이 없습니다</h3>
                    <p className="text-gray-500">반려동물을 등록하여 관리해보세요!</p>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* 주문 내역 Tab */}
          <TabsContent value="orders" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">주문 내역</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchOrders}
                className="flex items-center gap-2"
                disabled={ordersLoading}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {ordersLoading ? '로딩 중...' : '새로고침'}
              </Button>
            </div>
            {ordersLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
                <p className="text-gray-600">주문 내역을 불러오는 중...</p>
              </div>
            ) : orders.length > 0 ? (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[100px]">상품</TableHead>
                        <TableHead>상품명</TableHead>
                        <TableHead>상품ID</TableHead>
                        <TableHead>수량</TableHead>
                        <TableHead>총 가격</TableHead>
                        <TableHead>주문일</TableHead>
                        <TableHead className="text-right">상태</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order, index) => {
                        const orderItem = order.orderItems && order.orderItems[0];
                        return (
                          <TableRow key={`${order.orderId}-${order.orderedAt}-${index}`}>
                            <TableCell>
                              <Image
                                src={orderItem?.ImageUrl || "/placeholder.svg"}
                                alt={orderItem?.productName || "상품"}
                                width={60}
                                height={60}
                                className="rounded-md object-cover"
                              />
                            </TableCell>
                            <TableCell className="font-medium">{orderItem?.productName || "상품명 없음"}</TableCell>
                            <TableCell>{orderItem?.productId || "N/A"}</TableCell>
                            <TableCell>{orderItem?.quantity || 0}</TableCell>
                            <TableCell>{((order.amount || 0)).toLocaleString()}원</TableCell>
                            <TableCell>
                              {order.orderedAt ? 
                                (() => {
                                  try {
                                    // 백엔드에서 yyyy-MM-dd HH:mm:ss 형식으로 전송됨
                                    const date = new Date(order.orderedAt);
                                    if (isNaN(date.getTime())) {
                                      console.error('날짜 파싱 실패:', order.orderedAt);
                                      return "날짜 형식 오류";
                                    }
                                    return format(date, "yyyy-MM-dd")
                                  } catch (error) {
                                    console.error('날짜 파싱 오류:', error, '원본 데이터:', order.orderedAt);
                                    return "날짜 없음"
                                  }
                                })() 
                                : "날짜 없음"
                              }
                            </TableCell>
                            <TableCell className="text-right">
                              <Badge
                                className={
                                  order.paymentStatus === "COMPLETED"
                                    ? "bg-green-100 text-green-800"
                                    : order.paymentStatus === "PENDING"
                                      ? "bg-yellow-100 text-yellow-800"
                                    : order.paymentStatus === "CANCELLED"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                                }
                              >
                                {order.paymentStatus === "COMPLETED" ? "결제완료" : 
                                 order.paymentStatus === "PENDING" ? "주문생성" : 
                                 order.paymentStatus === "CANCELLED" ? "취소됨" : 
                                 order.paymentStatus || "알 수 없음"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : (
              <Card className="p-6 text-center text-gray-500">
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">주문한 내역이 없습니다</h3>
                    <p className="text-gray-500">아직 주문한 상품이 없습니다. 스토어에서 상품을 구매해보세요!</p>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* 입양 내역 Tab */}
          <TabsContent value="adoptionHistory" className="space-y-6">
            <h2 className="text-2xl font-bold">입양 내역</h2>
            
            {/* 통계 카드 */}
            {adoptionRequests.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-blue-600">
                      {adoptionRequests.length}
                    </div>
                    <p className="text-xs text-gray-600">총 신청 건수</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-yellow-600">
                      {adoptionRequests.filter(r => r.status === "PENDING").length}
                    </div>
                    <p className="text-xs text-gray-600">대기중</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">
                      {adoptionRequests.filter(r => r.status === "APPROVED").length}
                    </div>
                    <p className="text-xs text-gray-600">승인</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-red-600">
                      {adoptionRequests.filter(r => r.status === "REJECTED").length}
                    </div>
                    <p className="text-xs text-gray-600">거절</p>
                  </CardContent>
                </Card>
              </div>
            )}
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-400 mx-auto mb-4"></div>
                <p className="text-gray-600">입양 내역을 불러오는 중...</p>
              </div>
            ) : adoptionRequests.length > 0 ? (
              <div className="grid gap-4">
                {adoptionRequests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-3">
                            <h3 className="font-semibold">{request.petName} ({request.petBreed}) 입양신청</h3>
                            <Badge className={getStatusColor(request.status)}>
                              {getStatusText(request.status)}
                            </Badge>
                          </div>
                          <div className="space-y-2 mb-4">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">신청자:</span> {request.applicantName}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">연락처:</span> {request.contactNumber}
                            </p>
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">이메일:</span> {request.email}
                            </p>
                          </div>
                          <div className="mb-4">
                            <p className="text-sm font-medium text-gray-700 mb-2">입양 동기 및 메시지:</p>
                            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                              {request.message}
                            </p>
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>신청일: {formatToKST(request.createdAt)}</span>
                            <span>수정일: {formatToKST(request.updatedAt)}</span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEditRequest(request)}
                            disabled={request.status !== "PENDING"}
                            title={request.status !== "PENDING" ? "대기중인 신청만 수정할 수 있습니다" : "수정하기"}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center text-gray-500">
                <div className="space-y-4">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">입양 신청 내역이 없습니다</h3>
                    <p className="text-gray-500">아직 입양 신청을 하지 않으셨습니다. 입양 페이지에서 마음에 드는 동물을 찾아보세요!</p>
                  </div>
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* 입양신청 수정 모달 */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>입양신청 수정</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseEditModal}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="applicantName">신청자명</Label>
              <Input
                id="applicantName"
                value={editForm.applicantName}
                onChange={(e) => setEditForm(prev => ({ ...prev, applicantName: e.target.value }))}
                placeholder="신청자명을 입력하세요"
              />
            </div>
            <div>
              <Label htmlFor="contactNumber">연락처</Label>
              <Input
                id="contactNumber"
                value={editForm.contactNumber}
                onChange={(e) => setEditForm(prev => ({ ...prev, contactNumber: e.target.value }))}
                placeholder="연락처를 입력하세요"
              />
            </div>
            <div>
              <Label htmlFor="email">이메일</Label>
              <Input
                id="email"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                placeholder="이메일을 입력하세요"
              />
            </div>
            <div>
              <Label htmlFor="message">입양 동기 및 메시지</Label>
              <Textarea
                id="message"
                value={editForm.message}
                onChange={(e) => setEditForm(prev => ({ ...prev, message: e.target.value }))}
                placeholder="입양 동기와 메시지를 입력하세요"
                rows={4}
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={handleCloseEditModal}>
                취소
              </Button>
              <Button onClick={handleUpdateRequest}>
                수정 완료
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 펫 등록/수정 모달 */}
      <Dialog open={showPetModal} onOpenChange={setShowPetModal}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{selectedPet ? "펫 정보 수정" : "펫 등록"}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClosePetModal}
              >
                <X className="h-4 w-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* 기본 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="petName">펫 이름 *</Label>
                <Input
                  id="petName"
                  value={petForm.name}
                  onChange={(e) => setPetForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="펫 이름을 입력하세요"
                />
              </div>
              <div>
                <Label htmlFor="petBreed">품종</Label>
                <Input
                  id="petBreed"
                  value={petForm.breed}
                  onChange={(e) => setPetForm(prev => ({ ...prev, breed: e.target.value }))}
                  placeholder="품종을 입력하세요"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="petAge">나이</Label>
                <Input
                  id="petAge"
                  type="number"
                  value={petForm.age || ""}
                  onChange={(e) => setPetForm(prev => ({ ...prev, age: e.target.value ? parseInt(e.target.value) : undefined }))}
                  placeholder="나이"
                />
              </div>
              <div>
                <Label htmlFor="petGender">성별</Label>
                <Select value={petForm.gender} onValueChange={(value) => setPetForm(prev => ({ ...prev, gender: value as any }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="성별 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MALE">수컷</SelectItem>
                    <SelectItem value="FEMALE">암컷</SelectItem>
                    <SelectItem value="UNKNOWN">미상</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="petType">종류</Label>
                <Input
                  id="petType"
                  value={petForm.type}
                  onChange={(e) => setPetForm(prev => ({ ...prev, type: e.target.value }))}
                  placeholder="강아지, 고양이 등"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="petWeight">체중 (kg)</Label>
              <Input
                id="petWeight"
                type="number"
                step="0.1"
                value={petForm.weight || ""}
                onChange={(e) => setPetForm(prev => ({ ...prev, weight: e.target.value ? parseFloat(e.target.value) : undefined }))}
                placeholder="체중"
              />
            </div>

            {/* 이미지 업로드 */}
            <div>
              <Label>펫 사진</Label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    id="petImage"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <label htmlFor="petImage" className="cursor-pointer">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex items-center space-x-2"
                      onClick={() => {
                        const fileInput = document.getElementById('petImage') as HTMLInputElement;
                        if (fileInput) {
                          fileInput.click();
                        }
                      }}
                    >
                      <Camera className="h-4 w-4" />
                      <span>사진 선택</span>
                    </Button>
                  </label>
                </div>
                {imagePreview && (
                  <div className="relative w-32 h-32 border rounded-lg overflow-hidden">
                    <Image
                      src={imagePreview}
                      alt="펫 사진 미리보기"
                      fill
                      className="rounded-lg object-cover"
                    />
                  </div>
                )}
                {!imagePreview && (
                  <div className="text-sm text-gray-500">
                    사진을 선택하면 여기에 미리보기가 표시됩니다.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={handleClosePetModal}>
                취소
              </Button>
              <Button onClick={handleSavePet} disabled={!petForm.name}>
                {selectedPet ? "수정 완료" : "등록 완료"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}