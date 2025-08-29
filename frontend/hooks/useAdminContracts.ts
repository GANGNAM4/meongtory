import { useState, useEffect } from 'react'
import { ContractTemplate, GeneratedContract } from '@/types/admin'
import axios from 'axios'
import { formatToKST } from '@/lib/utils'
import { getBackendUrl } from "@/lib/api";

export function useAdminContracts() {
  const [contractTemplates, setContractTemplates] = useState<ContractTemplate[]>([])
  const [generatedContracts, setGeneratedContracts] = useState<GeneratedContract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [isLoadingContracts, setIsLoadingContracts] = useState(false)

  // 계약서 템플릿 페칭
  const fetchContractTemplates = async () => {
    try {
      setIsLoadingTemplates(true)
      const response = await axios.get(`${getBackendUrl()}/api/contract-templates`)
      if (response.data.success) {
        setContractTemplates(response.data.data || [])
      } else {
        console.error("템플릿 로드 실패:", response.data.message)
        throw new Error(response.data.message || "템플릿 로드에 실패했습니다.")
      }
    } catch (error) {
      console.error("템플릿 로드 실패:", error)
      throw new Error("템플릿 로드에 실패했습니다.")
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  // 생성된 계약서 페칭
  const fetchGeneratedContracts = async () => {
    try {
      setIsLoadingContracts(true)
      const response = await axios.get(`${getBackendUrl()}/api/contract-generation/user`)
      if (response.data.success) {
        setGeneratedContracts(response.data.data || [])
      } else {
        console.error("생성된 계약서 로드 실패:", response.data.message)
        throw new Error(response.data.message || "생성된 계약서 로드에 실패했습니다.")
      }
    } catch (error) {
      console.error("생성된 계약서 로드 실패:", error)
      throw new Error("생성된 계약서 로드에 실패했습니다.")
    } finally {
      setIsLoadingContracts(false)
    }
  }

  // 템플릿 보기
  const viewTemplate = async (template: ContractTemplate) => {
    console.log('템플릿 보기:', template)
    return template
  }

  // 템플릿 수정
  const editTemplate = async (template: ContractTemplate) => {
    console.log('템플릿 수정:', template)
    return template
  }

  // 템플릿 삭제
  const deleteTemplate = async (templateId: number) => {
    try {
      await axios.delete(`${getBackendUrl()}/api/contract-templates/${templateId}`)
      await fetchContractTemplates() // 목록 새로고침
      return true
    } catch (error) {
      console.error('템플릿 삭제 실패:', error)
      throw new Error('템플릿 삭제에 실패했습니다.')
    }
  }

  // 생성된 계약서 보기
  const viewGeneratedContract = async (contract: GeneratedContract) => {
    console.log('생성된 계약서 보기:', contract)
    return contract
  }

  // 계약서 다운로드
  const downloadContract = async (contractId: number) => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/contract-generation/${contractId}/download`, {
        responseType: 'blob'
      })
      
      // 파일 다운로드
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `contract-${contractId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      return true
    } catch (error) {
      console.error('계약서 다운로드 실패:', error)
      throw new Error('계약서 다운로드에 실패했습니다.')
    }
  }

  // 계약서 삭제
  const deleteContract = async (contractId: number) => {
    try {
      await axios.delete(`${getBackendUrl()}/api/contract-generation/${contractId}`)
      
      // localStorage에서 PDF URL도 삭제
      localStorage.removeItem(`contract_pdf_url_${contractId}`)
      console.log(`계약서 ${contractId} 삭제 완료 - PDF URL도 함께 삭제됨`)
      
      await fetchGeneratedContracts() // 목록 새로고침
      return true
    } catch (error) {
      console.error('계약서 삭제 실패:', error)
      throw new Error('계약서 삭제에 실패했습니다.')
    }
  }

  // 계약서 수정
  const editContract = async (contract: GeneratedContract) => {
    try {
      const response = await axios.put(`${getBackendUrl()}/api/contract-generation/${contract.id}`, {
        content: contract.content
      })
      
      if (response.data.success) {
        // 새로운 PDF URL을 localStorage에 저장
        const newPdfUrl = response.data.data?.pdfUrl || response.data.pdfUrl
        if (newPdfUrl) {
          localStorage.setItem(`contract_pdf_url_${contract.id}`, newPdfUrl)
          console.log(`계약서 ${contract.id} 수정 완료 - 새로운 PDF URL 저장:`, newPdfUrl)
        }
        
        await fetchGeneratedContracts() // 목록 새로고침
        return response.data.data || response.data
      } else {
        throw new Error('계약서 수정에 실패했습니다.')
      }
    } catch (error) {
      console.error('계약서 수정 실패:', error)
      throw new Error('계약서 수정에 실패했습니다.')
    }
  }

  // 모든 데이터 페칭
  const fetchAllData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      await Promise.all([
        fetchContractTemplates(),
        fetchGeneratedContracts()
      ])
    } catch (error) {
      console.error('데이터 페칭 실패:', error)
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
    contractTemplates,
    generatedContracts,
    loading,
    error,
    isLoadingTemplates,
    isLoadingContracts,
    fetchContractTemplates,
    fetchGeneratedContracts,
    viewTemplate,
    editTemplate,
    deleteTemplate,
    viewGeneratedContract,
    downloadContract,
    deleteContract,
    editContract,
    formatToKST,
    refetch: fetchAllData
  }
} 