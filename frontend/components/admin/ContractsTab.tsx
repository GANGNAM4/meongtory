"use client"

import React, { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileText, MessageSquare, Plus, Eye, Edit, Trash2, Download } from "lucide-react"
import axios from "axios"
import { formatToKST } from "@/lib/utils"
import CreateTemplateModal from "@/components/modals/admin/CreateTemplateModal"
import EditTemplateModal from "@/components/modals/admin/EditTemplateModal"
import TemplateViewModal from "@/components/modals/admin/TemplateViewModal"
import ContractViewModal from "@/components/modals/admin/ContractViewModal"
import ContractEditModal from "@/components/modals/admin/ContractEditModal"
import ContractGenerationModal from "@/components/modals/admin/ContractGenerationModal"

interface ContractsTabProps {
  onShowContractModal?: (request: any) => void
  selectedAdoptionRequest?: any
  selectedContract?: any
  selectedPet?: any
  onContractViewClosed?: () => void
}

export default function ContractsTab({
  onShowContractModal,
  selectedAdoptionRequest,
  selectedContract,
  selectedPet,
  onContractViewClosed,
}: ContractsTabProps) {
  // 상태 관리
  const [contractView, setContractView] = useState<"templates" | "contracts">("templates")
  const [contractTemplates, setContractTemplates] = useState<any[]>([])
  const [generatedContracts, setGeneratedContracts] = useState<any[]>([])
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [isLoadingContracts, setIsLoadingContracts] = useState(false)
  
  // 모달 상태
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false)
  const [showContractViewModal, setShowContractViewModal] = useState(false)
  const [showGeneratedContractViewModal, setShowGeneratedContractViewModal] = useState(false)
  const [showEditTemplateModal, setShowEditTemplateModal] = useState(false)
  const [showContractEditModal, setShowContractEditModal] = useState(false)
  const [showContractGenerationModal, setShowContractGenerationModal] = useState(false)
  
  // 선택된 아이템
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [selectedContractForView, setSelectedContractForView] = useState<any>(null)
  const [selectedPetForView, setSelectedPetForView] = useState<any>(null)
  const [selectedTemplateForEdit, setSelectedTemplateForEdit] = useState<any>(null)
  


  // 템플릿 데이터 페칭
  const fetchContractTemplates = async () => {
    try {
      setIsLoadingTemplates(true)
      const response = await axios.get(`${getBackendUrl()}/api/contract-templates`)
      if (response.data.success) {
        setContractTemplates(response.data.data || [])
      } else {
        console.error("템플릿 로드 실패:", response.data.message)
      }
    } catch (error) {
      console.error("템플릿 로드 실패:", error)
    } finally {
      setIsLoadingTemplates(false)
    }
  }

  // 생성된 계약서 데이터 페칭
  const fetchGeneratedContracts = async () => {
    try {
      setIsLoadingContracts(true)
      const response = await axios.get(`${getBackendUrl()}/api/contract-generation/user`)
      if (response.data.success) {
        setGeneratedContracts(response.data.data || [])
      } else {
        console.error("생성된 계약서 로드 실패:", response.data.message)
      }
    } catch (error) {
      console.error("생성된 계약서 로드 실패:", error)
    } finally {
      setIsLoadingContracts(false)
    }
  }

  // 컴포넌트 마운트 시 데이터 페칭
  useEffect(() => {
    fetchContractTemplates()
    fetchGeneratedContracts()
  }, [])

  // selectedAdoptionRequest가 있으면 계약서 생성 모달 열기
  useEffect(() => {
    if (selectedAdoptionRequest && !selectedContract) {
      // 입양신청으로부터 계약서 생성 요청
      setContractView("contracts")
      setShowContractGenerationModal(true)
      console.log("입양신청으로부터 계약서 생성 요청:", selectedAdoptionRequest)
    }
  }, [selectedAdoptionRequest])

  // selectedContract가 있으면 계약서 보기 모달 열기
  useEffect(() => {
    if (selectedContract && !selectedAdoptionRequest) {
      // 입양관리로부터 계약서 보기 요청
      setContractView("contracts")
      setSelectedContractForView(selectedContract)
      setShowGeneratedContractViewModal(true)
      console.log("입양관리로부터 계약서 보기 요청:", selectedContract)
    }
  }, [selectedContract])

  // 백엔드 URL 가져오기
  const getBackendUrl = () => {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"
  }

  // 템플릿 보기 핸들러
  const handleViewTemplate = async (templateId: number) => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/contract-templates/${templateId}`)
      if (response.data.success) {
        setSelectedTemplate(response.data.data)
        setShowContractViewModal(true)
      } else {
        alert("템플릿을 불러오는데 실패했습니다.")
      }
    } catch (error) {
      console.error("템플릿 보기 오류:", error)
      alert("템플릿을 불러오는데 실패했습니다.")
    }
  }

  // 템플릿 수정 핸들러
  const handleEditTemplate = async (templateId: number) => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/contract-templates/${templateId}`)
      if (response.data.success) {
        setSelectedTemplateForEdit(response.data.data)
        setShowEditTemplateModal(true)
      } else {
        alert("템플릿을 불러오는데 실패했습니다.")
      }
    } catch (error) {
      console.error("템플릿 수정 오류:", error)
      alert("템플릿을 불러오는데 실패했습니다.")
    }
  }

  // 템플릿 삭제 핸들러
  const handleDeleteTemplate = async (templateId: number) => {
    if (!confirm("정말로 이 템플릿을 삭제하시겠습니까?")) {
      return
    }

    try {
      const response = await axios.delete(`${getBackendUrl()}/api/contract-templates/${templateId}`)
      if (response.data.success) {
        alert("템플릿이 삭제되었습니다.")
        fetchContractTemplates() // 목록 새로고침
      } else {
        alert("템플릿 삭제에 실패했습니다.")
      }
    } catch (error) {
      console.error("템플릿 삭제 오류:", error)
      alert("템플릿 삭제에 실패했습니다.")
    }
  }

  // 생성된 계약서 보기 핸들러
  const handleViewGeneratedContract = async (contractId: number) => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/contract-generation/${contractId}`)
      if (response.data.success) {
        const contractData = response.data.data
        console.log("계약서 데이터:", contractData)
        
        // pet 정보 추출
        let petInfo = null
        if (contractData.petInfo) {
          try {
            petInfo = typeof contractData.petInfo === 'string' 
              ? JSON.parse(contractData.petInfo) 
              : contractData.petInfo
            console.log("추출된 pet 정보:", petInfo)
          } catch (error) {
            console.error("petInfo 파싱 오류:", error)
          }
        }
        
        setSelectedContractForView(contractData)
        setSelectedPetForView(null) // AI 계약서 탭에서는 pet 정보 전달하지 않음
        setShowGeneratedContractViewModal(true)
      } else {
        alert("계약서를 불러오는데 실패했습니다.")
      }
    } catch (error) {
      console.error("계약서 보기 오류:", error)
      alert("계약서를 불러오는데 실패했습니다.")
    }
  }

  // 계약서 다운로드 핸들러
  const handleDownloadContract = async (contractId: number) => {
    try {
      const response = await axios.get(`${getBackendUrl()}/api/contract-generation/${contractId}/download`, {
        responseType: 'blob'
      })
      
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `contract-${contractId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error("계약서 다운로드 오류:", error)
      alert("계약서 다운로드에 실패했습니다.")
    }
  }

  // 계약서 삭제 핸들러
  const handleDeleteContract = async (contractId: number) => {
    if (!confirm("정말로 이 계약서를 삭제하시겠습니까?")) {
      return
    }

    try {
      const response = await axios.delete(`${getBackendUrl()}/api/contract-generation/${contractId}`)
      if (response.data.success) {
        alert("계약서가 삭제되었습니다.")
        fetchGeneratedContracts() // 목록 새로고침
      } else {
        alert("계약서 삭제에 실패했습니다.")
      }
    } catch (error) {
      console.error("계약서 삭제 오류:", error)
      alert("계약서 삭제에 실패했습니다.")
    }
  }

  // 계약서 수정 핸들러
  const handleEditContract = async (contract: any) => {
    console.log("계약서 수정 시작:", contract)
    
    setSelectedContractForView(contract)
    setSelectedPetForView(null) // AI 계약서 탭에서는 pet 정보 전달하지 않음
    setShowContractEditModal(true)
  }



  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">AI 계약서 관리</h2>
        <div className="flex gap-2">
          <Button 
            onClick={() => setContractView("templates")} 
            className={`${contractView === "templates" ? "bg-blue-600" : "bg-blue-500 hover:bg-blue-600"} text-white`}
          >
            <FileText className="h-4 w-4 mr-2" />
            템플릿 관리
          </Button>
          <Button 
            onClick={() => setContractView("contracts")} 
            className={`${contractView === "contracts" ? "bg-green-600" : "bg-green-500 hover:bg-green-600"} text-white`}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            계약서 관리
          </Button>
        </div>
      </div>

      {/* 템플릿 관리 뷰 */}
      {contractView === "templates" && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>계약서 템플릿 목록</CardTitle>
              <Button 
                onClick={() => setShowCreateTemplateModal(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                새 템플릿 생성
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingTemplates ? (
              <div className="text-center py-8">
                <p>템플릿을 불러오는 중...</p>
              </div>
            ) : contractTemplates.length === 0 ? (
              <div className="text-center py-8">
                <p>등록된 템플릿이 없습니다.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {contractTemplates.map((template) => (
                  <Card key={template.id} className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <Badge variant="outline">
                        {template.isDefault ? "기본 템플릿" : "사용자 템플릿"}
                      </Badge>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewTemplate(template.id)}>
                          <Eye className="h-4 w-4 mr-1" />
                          보기
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEditTemplate(template.id)}>
                          <Edit className="h-4 w-4 mr-1" />
                          수정
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteTemplate(template.id)}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          삭제
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 계약서 관리 뷰 */}
      {contractView === "contracts" && (
        <Card>
          <CardHeader>
            <CardTitle>생성된 계약서 목록</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingContracts ? (
              <div className="text-center py-8">
                <p>계약서를 불러오는 중...</p>
              </div>
            ) : generatedContracts.length === 0 ? (
              <div className="text-center py-8">
                <p>생성된 계약서가 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {generatedContracts.map((contract) => {
                  // pet 정보 추출
                  let petInfo = null
                  if (contract.petInfo) {
                    try {
                      petInfo = typeof contract.petInfo === 'string' 
                        ? JSON.parse(contract.petInfo) 
                        : contract.petInfo
                    } catch (error) {
                      console.error("petInfo 파싱 오류:", error)
                    }
                  }
                  
                  return (
                    <div key={contract.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div>
                        <h4 className="font-medium">{contract.contractName || "계약서"}</h4>
                        <p className="text-sm text-gray-600">
                          {petInfo?.name ? `${petInfo.name} (${petInfo.breed || '품종 정보 없음'})` : "동물 정보 없음"}
                        </p>
                        <p className="text-sm text-gray-600">
                          {contract.generatedAt ? formatToKST(contract.generatedAt) : "날짜 없음"} 생성
                        </p>
                        <p className="text-xs text-gray-500">
                          생성자: {contract.generatedBy || "관리자"}
                        </p>
                      </div>
                                          <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleViewGeneratedContract(contract.id)}>
                          <Eye className="h-4 w-4 mr-1" />
                          보기
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEditContract(contract)}>
                          <Edit className="h-4 w-4 mr-1" />
                          수정
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDownloadContract(contract.id)}>
                          <Download className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDeleteContract(contract.id)}>
                          <Trash2 className="h-4 w-4 mr-1" />
                          삭제
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 모달 컴포넌트들 */}
      <CreateTemplateModal
        isOpen={showCreateTemplateModal}
        onClose={() => setShowCreateTemplateModal(false)}
        onCreateTemplate={fetchContractTemplates}
      />

      <EditTemplateModal
        isOpen={showEditTemplateModal}
        onClose={() => setShowEditTemplateModal(false)}
        editingTemplate={selectedTemplateForEdit}
        onUpdateTemplate={fetchContractTemplates}
      />

      <TemplateViewModal
        isOpen={showContractViewModal}
        onClose={() => setShowContractViewModal(false)}
        selectedTemplate={selectedTemplate}
      />

      <ContractViewModal
        isOpen={showGeneratedContractViewModal}
        onClose={() => {
          setShowGeneratedContractViewModal(false)
          setSelectedContractForView(null)
          setSelectedPetForView(null)
          // 부모 컴포넌트에서 selectedContract 초기화
          if (onContractViewClosed) {
            onContractViewClosed()
          }
        }}
        contract={selectedContractForView}
        pet={selectedPet || selectedPetForView}
        onEdit={(contract) => {
          // 보기 모달 닫고 수정 모달 열기
          setShowGeneratedContractViewModal(false)
          setSelectedContractForView(contract)
          setShowContractEditModal(true)
        }}
      />

      <ContractEditModal
        isOpen={showContractEditModal}
        onClose={() => {
          setShowContractEditModal(false)
          setSelectedContractForView(null)
          setSelectedPetForView(null)
        }}
        editingContract={selectedContractForView}
        pet={selectedPetForView}
        onUpdateContract={fetchGeneratedContracts}
      />

      <ContractGenerationModal
        isOpen={showContractGenerationModal}
        onClose={() => {
          setShowContractGenerationModal(false)
          // 부모 컴포넌트에서 selectedAdoptionRequest 초기화
          if (onContractViewClosed) {
            onContractViewClosed()
          }
        }}
        adoptionRequest={selectedAdoptionRequest}
        contractTemplates={contractTemplates}
        onGenerateContract={fetchGeneratedContracts}
      />
    </div>
  )
} 