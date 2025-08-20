import { useState, useEffect } from 'react'
import { AdminProduct, AdoptionRequest } from '@/types/admin'
import { Pet } from '@/types/pets'
import { productApi, petApi, adoptionRequestApi } from '@/lib/api'

export function useAdminDashboard() {
  const [products, setProducts] = useState<AdminProduct[]>([])
  const [pets, setPets] = useState<Pet[]>([])
  const [adoptionRequests, setAdoptionRequests] = useState<AdoptionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 상품 데이터 페칭
  const fetchProducts = async () => {
    try {
      const response = await productApi.getProducts()
      setProducts(response.data)
    } catch (err) {
      console.error('상품 데이터 페칭 실패:', err)
      setError('상품 데이터를 불러오는데 실패했습니다.')
    }
  }

  // 반려동물 데이터 페칭
  const fetchPets = async () => {
    try {
      const response = await petApi.getPets()
      setPets(response.data)
    } catch (err) {
      console.error('반려동물 데이터 페칭 실패:', err)
      setError('반려동물 데이터를 불러오는데 실패했습니다.')
    }
  }

  // 입양 신청 데이터 페칭
  const fetchAdoptionRequests = async () => {
    try {
      const response = await adoptionRequestApi.getAdoptionRequests()
      setAdoptionRequests(response.data)
    } catch (err) {
      console.error('입양 신청 데이터 페칭 실패:', err)
      setError('입양 신청 데이터를 불러오는데 실패했습니다.')
    }
  }

  // 모든 데이터 페칭
  const fetchAllData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      await Promise.all([
        fetchProducts(),
        fetchPets(),
        fetchAdoptionRequests()
      ])
    } catch (err) {
      console.error('데이터 페칭 실패:', err)
      setError('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 컴포넌트 마운트 시 데이터 페칭
  useEffect(() => {
    fetchAllData()
  }, [])

  return {
    products,
    pets,
    adoptionRequests,
    loading,
    error,
    refetch: fetchAllData
  }
} 