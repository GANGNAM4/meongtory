"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ChevronDown, Plus } from "lucide-react"
import { petApi } from "@/lib/api"

import type { Pet } from "@/types/pets"

interface AdoptionPageProps {
  isAdmin?: boolean
  isLoggedIn?: boolean
  onNavigateToAnimalRegistration?: () => void
  pets?: Pet[]
  onViewPet?: (pet: Pet) => void
}

const PETS_PER_PAGE = 6

export default function AdoptionPage({
  isAdmin = false,
  isLoggedIn = false,
  onNavigateToAnimalRegistration,
  pets: initialPets = [],
  onViewPet,
}: AdoptionPageProps) {
  const router = useRouter()
  const [activeFilters, setActiveFilters] = useState<string[]>(["보호"])
  const [displayedPetsCount, setDisplayedPetsCount] = useState(PETS_PER_PAGE)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState("전체")
  const [selectedAge, setSelectedAge] = useState("전체")
  const [selectedGender, setSelectedGender] = useState("전체")
  const [selectedNeutering, setSelectedNeutering] = useState("전체")
  const [pets, setPets] = useState<Pet[]>(initialPets)
  const [loading, setLoading] = useState(false)

  // Filter pets based on selected criteria
  const filteredPets = pets.filter((pet) => {
    // 입양 완료된 동물은 제외
    if (pet.adoptionStatus === "adopted") return false
    
    if (selectedStatus !== "전체" && pet.adoptionStatus !== selectedStatus) return false
    if (selectedAge !== "전체") {
      const ageNum = Number.parseInt(pet.age)
      switch (selectedAge) {
        case "1살 미만":
          if (ageNum >= 1) return false
          break
        case "1-3살":
          if (ageNum < 1 || ageNum > 3) return false
          break
        case "4-7살":
          if (ageNum < 4 || ageNum > 7) return false
          break
        case "8살 이상":
          if (ageNum < 8) return false
          break
      }
    }
    if (selectedGender !== "전체") {
      const genderMap = { 수컷: "수컷", 암컷: "암컷" }
      if (pet.gender !== genderMap[selectedGender as keyof typeof genderMap]) return false
    }
    if (selectedNeutering !== "전체") {
      const neuteredMap = { 완료: true, 미완료: false }
      if (pet.isNeutered !== neuteredMap[selectedNeutering as keyof typeof neuteredMap]) return false
    }
    return true
  })

  const displayedPets = filteredPets.slice(0, displayedPetsCount)
  const hasMorePets = displayedPetsCount < filteredPets.length

  const loadMorePets = () => {
    setIsLoading(true)
    // 실제 로딩 시뮬레이션
    setTimeout(() => {
      setDisplayedPetsCount((prev) => Math.min(prev + PETS_PER_PAGE, filteredPets.length))
      setIsLoading(false)
    }, 1000)
  }

  const handlePetClick = (pet: Pet) => {
    // 직접 라우팅 처리
    router.push(`/adoption/${pet.petId || pet.id}`)
  }

  // API 데이터를 프론트엔드 형식으로 변환
  const convertApiPetToAdoptionPet = (apiPet: any): Pet => {
    // personality 안전한 파싱
    let personality: string = ''
    if (apiPet.personality) {
      try {
        // JSON 형식인지 확인
        if (apiPet.personality.startsWith('[') && apiPet.personality.endsWith(']')) {
          const personalityArray = JSON.parse(apiPet.personality)
          personality = personalityArray.join(', ')
        } else {
          // 이미 문자열인 경우
          personality = apiPet.personality
        }
      } catch (error) {
        console.warn('personality 파싱 실패, 기본값 사용:', apiPet.personality)
        personality = '온순함, 친화적'
      }
    }

    return {
      petId: apiPet.petId,
      id: apiPet.petId,
      name: apiPet.name,
      breed: apiPet.breed,
      age: `${apiPet.age}살`,
      gender: apiPet.gender === 'MALE' ? '수컷' : '암컷',
      size: apiPet.weight ? `${apiPet.weight}kg` : '',
      personality: personality,
      healthStatus: apiPet.medicalHistory || '',
      description: apiPet.description || '',
      images: apiPet.imageUrl ? [apiPet.imageUrl] : [],
      location: apiPet.location || '',
      contact: '',
      adoptionFee: 0,
      isNeutered: apiPet.neutered || false,
      isVaccinated: apiPet.vaccinated || false,
      specialNeeds: apiPet.specialNeeds || '',
      dateRegistered: new Date().toISOString().split('T')[0],
      adoptionStatus: apiPet.adopted ? 'adopted' : 'available'
    }
  }

  // 펫 데이터 가져오기
  const fetchPets = async () => {
    setLoading(true)
    try {
      const apiPets = await petApi.getPets()
      const convertedPets = apiPets.map(convertApiPetToAdoptionPet)
      setPets(convertedPets)
    } catch (error) {
      console.error("펫 데이터를 가져오는데 실패했습니다:", error)
    } finally {
      setLoading(false)
    }
  }

  // 컴포넌트 마운트 시 데이터 가져오기
  useEffect(() => {
    fetchPets()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Admin Button */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">입양</h1>
            <p className="text-gray-600">사랑이 필요한 아이들을 만나보세요</p>
          </div>
        
        </div>

        {/* Filter Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 relative z-10">
          <div className="flex flex-wrap gap-4 mb-4">
            {/* Status Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 bg-transparent relative z-20">
                  상태: {selectedStatus}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="relative z-[999]">
                <DropdownMenuItem onClick={() => setSelectedStatus("전체")}>전체</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedStatus("보호중")}>보호중</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedStatus("입양대기")}>입양대기</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Age Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 bg-transparent relative z-20">
                  나이: {selectedAge}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="relative z-[999]">
                <DropdownMenuItem onClick={() => setSelectedAge("전체")}>전체</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedAge("1살 미만")}>1살 미만</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedAge("1-3살")}>1-3살</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedAge("4-7살")}>4-7살</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedAge("8살 이상")}>8살 이상</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Gender Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 bg-transparent relative z-20">
                  성별: {selectedGender}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="relative z-[999]">
                <DropdownMenuItem onClick={() => setSelectedGender("전체")}>전체</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedGender("수컷")}>수컷</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedGender("암컷")}>암컷</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Neutering Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="gap-2 bg-transparent relative z-20">
                  중성화: {selectedNeutering}
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="relative z-[999]">
                <DropdownMenuItem onClick={() => setSelectedNeutering("전체")}>전체</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedNeutering("완료")}>완료</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSelectedNeutering("미완료")}>미완료</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Results Count */}
        <div className="flex items-center gap-2 mb-6">
          <span className="text-2xl">🐾</span>
          <span className="text-lg font-medium">
            <span className="text-blue-600 font-bold">{filteredPets.length}</span> 마리의 아이들이 보호처를 기다리고
            있어요
            {displayedPetsCount < filteredPets.length && (
              <span className="text-gray-500 ml-2">(현재 {displayedPetsCount}마리 표시 중)</span>
            )}
          </span>
        </div>

        {/* Pet Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
            <p className="text-gray-600">동물 목록을 불러오는 중...</p>
          </div>
        ) : displayedPets.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedPets.map((pet) => (
              <Card
                key={pet.id}
                className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => handlePetClick(pet)}
              >
                <div className="relative">
                  <Image
                    src={pet.images?.[0] || "/placeholder.svg?height=200&width=300&query=cute pet"}
                    alt={`${pet.name}`}
                    width={400}
                    height={300}
                    className="w-full h-64 object-cover"
                  />
                  <Badge className="absolute top-3 left-3 bg-yellow-400 text-black hover:bg-yellow-500">
                    {pet.adoptionStatus === "available" ? "보호중" : pet.adoptionStatus === "pending" ? "입양대기" : "입양완료"}
                  </Badge>
                </div>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">
                      {pet.name} {pet.age}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className={pet.gender === "수컷" ? "text-blue-500" : "text-pink-500"}>
                        {pet.gender === "수컷" ? "♂" : "♀"} {pet.gender === "수컷" ? "남아" : "여아"}
                      </span>
                      <span>•</span>
                      <span>{pet.isNeutered ? "중성화 완료" : "중성화 미완료"}</span>
                    </div>
                    <p className="text-sm text-gray-500">지역 : {pet.location}</p>
                  </div>
                  <div className="flex justify-end mt-4">
                    <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                      <span className="text-lg">🐕</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🐾</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">등록된 동물이 없습니다</h3>
            <p className="text-gray-500 mb-6">관리자가 동물을 등록하면 여기에 표시됩니다.</p>
            {isAdmin && isLoggedIn && (
              <Button onClick={onNavigateToAnimalRegistration} className="bg-yellow-400 hover:bg-yellow-500 text-black">
                <Plus className="w-4 h-4 mr-2" />첫 번째 동물 등록하기
              </Button>
            )}
          </div>
        )}

        {/* Load More Button */}
        {hasMorePets && (
          <div className="text-center mt-12">
            <Button size="lg" className="px-8" onClick={loadMorePets} disabled={isLoading}>
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  로딩 중...
                </>
              ) : (
                `더 많은 아이들 보기 (${filteredPets.length - displayedPetsCount}마리 더)`
              )}
            </Button>
          </div>
        )}

        {/* All pets loaded message */}
        {!hasMorePets && filteredPets.length > PETS_PER_PAGE && (
          <div className="text-center mt-12">
            <p className="text-gray-600">모든 아이들을 확인했습니다! 🐾</p>
          </div>
        )}
      </div>
    </div>
  )
}
