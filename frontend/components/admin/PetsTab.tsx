"use client"

import React, { useState, useEffect } from "react"
import { PetsTabProps, AdoptionRequest } from "@/types/admin"
import { Pet } from "@/types/pets"
import { petApi, adoptionRequestApi, s3Api } from "@/lib/api"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Plus, Edit, Trash2, FileText } from "lucide-react"
import { toast } from "sonner"

export default function PetsTab({ onNavigateToAnimalRegistration, onUpdatePet, onViewContract }: PetsTabProps) {
  const [pets, setPets] = useState<Pet[]>([])
  const [adoptionRequests, setAdoptionRequests] = useState<AdoptionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // API 응답을 Pet 형태로 변환하는 함수
  const convertApiPetToPet = (apiPet: any): Pet => {
    // 해당 펫의 입양신청 상태 확인
    const petAdoptionRequests = (adoptionRequests ?? []).filter((request: AdoptionRequest) => request.petId === apiPet.petId)
    const hasPendingRequests = petAdoptionRequests.some((request: AdoptionRequest) => request.status === "PENDING")
    const hasApprovedRequests = petAdoptionRequests.some((request: AdoptionRequest) => request.status === "APPROVED")
    
    // 입양 상태 결정 (백엔드 adopted 필드 우선, 그 다음 입양신청 상태)
    let finalAdoptedStatus = apiPet.adopted || false
    
    // 백엔드에서 adopted가 false이지만 승인된 입양신청이 있으면 adopted로 설정
    if (!apiPet.adopted && hasApprovedRequests) {
      finalAdoptedStatus = true
    }
    
    return {
      petId: apiPet.petId,
      name: apiPet.name,
      breed: apiPet.breed,
      age: apiPet.age,
      gender: apiPet.gender,
      vaccinated: apiPet.vaccinated || false,
      description: apiPet.description || '',
      imageUrl: apiPet.imageUrl || '',
      adopted: finalAdoptedStatus,
      weight: apiPet.weight,
      location: apiPet.location || '',
      microchipId: apiPet.microchipId || '',
      medicalHistory: apiPet.medicalHistory || '',
      vaccinations: apiPet.vaccinations || '',
      notes: apiPet.notes || '',
      specialNeeds: apiPet.specialNeeds || '',
      personality: apiPet.personality || '',
      rescueStory: apiPet.rescueStory || '',
      aiBackgroundStory: apiPet.aiBackgroundStory || '',
      status: apiPet.status || '보호중',
      type: apiPet.type || '',
      neutered: apiPet.neutered || false
    }
  }

  // 반려동물 데이터 가져오기
  const fetchPets = async () => {
    try {
      const apiPets = await petApi.getPets()
      console.log('API Pets response:', apiPets)
      
      if (!apiPets || !Array.isArray(apiPets)) {
        console.error('API 응답이 배열이 아닙니다:', apiPets)
        setPets([])
        return
      }

      const convertedPets = apiPets.map(convertApiPetToPet)
      setPets(convertedPets)
    } catch (error) {
      console.error('반려동물 데이터 페칭 실패:', error)
      setError('반려동물 데이터를 불러오는데 실패했습니다.')
    }
  }

  // 입양신청 데이터 가져오기
  const fetchAdoptionRequests = async () => {
    try {
      const response = await adoptionRequestApi.getAdoptionRequests()
      console.log('Adoption requests response:', response)
      
      if (response && Array.isArray(response)) {
        setAdoptionRequests(response)
      } else {
        setAdoptionRequests([])
      }
    } catch (error) {
      console.error('입양신청 데이터 페칭 실패:', error)
      setAdoptionRequests([])
    }
  }

  // 모든 데이터 가져오기
  const fetchAllData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      await Promise.all([fetchPets(), fetchAdoptionRequests()])
    } catch (error) {
      console.error('데이터 페칭 실패:', error)
      setError('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 반려동물 상태 업데이트
  const handleUpdatePetStatus = async (petId: number, status: string) => {
    try {
      const adopted = status === "adopted"
      await petApi.updateAdoptionStatus(petId, adopted)
      toast.success('반려동물 상태가 업데이트되었습니다.')
      fetchAllData() // 데이터 새로고침
    } catch (error) {
      console.error('반려동물 상태 업데이트 실패:', error)
      toast.error('상태 업데이트에 실패했습니다.')
    }
  }

  // 반려동물 삭제
  const handleDeletePet = async (petId: number, petName: string) => {
    if (!confirm(`정말로 ${petName}을(를) 삭제하시겠습니까?`)) {
      return
    }

    try {
      // 이미지가 있으면 S3에서도 삭제
      const pet = pets.find((p: Pet) => p.petId === petId)
      if (pet?.imageUrl) {
        try {
          await s3Api.deleteFile(pet.imageUrl)
        } catch (s3Error) {
          console.error('S3 이미지 삭제 실패:', s3Error)
        }
      }

      await petApi.deletePet(petId)
      toast.success('반려동물이 삭제되었습니다.')
      fetchAllData() // 데이터 새로고침
    } catch (error) {
      console.error('반려동물 삭제 실패:', error)
      toast.error('삭제에 실패했습니다.')
    }
  }

  useEffect(() => {
    fetchAllData()
  }, [])

  // 상태에 따른 색상 반환
  const getStatusColor = (status: string) => {
    switch (status) {
      case "available":
        return "bg-green-100 text-green-800"
      case "pending":
        return "bg-yellow-100 text-yellow-800"
      case "adopted":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">입양 관리</h2>
        <Button onClick={onNavigateToAnimalRegistration} className="bg-yellow-400 hover:bg-yellow-500 text-black">
          <Plus className="h-4 w-4 mr-2" />새 동물 등록
        </Button>
      </div>

      <div className="grid gap-4">
        {pets && pets.length > 0 ? (
          pets.map((pet, index) => (
            <Card key={pet.petId || `pet-${index}`}>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <img
                      src={pet.imageUrl || "/placeholder.svg"}
                      alt={pet.name}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                    <div>
                      <h3 className="font-semibold">{pet.name}</h3>
                      <p className="text-sm text-gray-600">
                        {pet.breed} • {pet.age}살 • {pet.gender === 'MALE' ? '수컷' : '암컷'}
                      </p>
                      <p className="text-sm text-gray-500">{pet.location}</p>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge className={getStatusColor(pet.adopted ? "adopted" : "available")}>
                          {pet.adopted ? "입양완료" : "입양가능"}
                        </Badge>
                        {/* 입양신청 현황 표시 */}
                        {(() => {
                          const petRequests = adoptionRequests.filter(request => request.petId === pet.petId)
                          const pendingCount = petRequests.filter(r => r.status === "PENDING").length
                          const approvedCount = petRequests.filter(r => r.status === "APPROVED").length
                          
                          if (petRequests.length > 0) {
                            return (
                              <div className="flex space-x-1">
                                {pendingCount > 0 && (
                                  <Badge className="bg-yellow-100 text-yellow-800 text-xs">
                                    대기 {pendingCount}건
                                  </Badge>
                                )}
                                {approvedCount > 0 && (
                                  <Badge className="bg-green-100 text-green-800 text-xs">
                                    승인 {approvedCount}건
                                  </Badge>
                                )}
                              </div>
                            )
                          }
                          return null
                        })()}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onUpdatePet(pet)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleUpdatePetStatus(pet.petId, "available")}
                      disabled={!pet.adopted}
                    >
                      입양가능
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleUpdatePetStatus(pet.petId, "adopted")}
                      disabled={pet.adopted}
                    >
                      입양완료
                    </Button>
                    {/* 계약서 보기 버튼 - 모든 동물에 대해 표시 */}
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => onViewContract(pet)}
                    >
                      <FileText className="h-4 w-4" />
                      계약서 보기
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleDeletePet(pet.petId, pet.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <div className="text-center py-8">
            <p>등록된 동물이 없습니다.</p>
          </div>
        )}
      </div>
    </div>
  )
} 