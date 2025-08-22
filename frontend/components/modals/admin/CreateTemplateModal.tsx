"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Plus, Trash2, X } from "lucide-react"
import axios from "axios"

interface CreateTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  onCreateTemplate?: () => void
}

interface TemplateSection {
  id: string
  title: string
  aiSuggestion: string
}

interface NewTemplate {
  name: string
  category: string
  content: string
  isDefault: boolean
}

export default function CreateTemplateModal({ isOpen, onClose, onCreateTemplate }: CreateTemplateModalProps) {
  const [newTemplate, setNewTemplate] = useState<NewTemplate>({
    name: "",
    category: "",
    content: "",
    isDefault: false
  })
  const [templateSections, setTemplateSections] = useState<TemplateSection[]>([])
  const [showAISuggestion, setShowAISuggestion] = useState<string | null>(null)

  const getBackendUrl = () => {
    return process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"
  }

  const addSection = () => {
    const newSection = {
      id: (Date.now() + Math.random()).toString(),
      title: "새 항목",
      aiSuggestion: ""
    }
    setTemplateSections([...templateSections, newSection])
  }

  const addSectionAtIndex = (index: number) => {
    const newSection = {
      id: (Date.now() + Math.random()).toString(),
      title: "새 항목",
      aiSuggestion: ""
    }
    const newSections = [...templateSections]
    newSections.splice(index, 0, newSection)
    setTemplateSections(newSections)
  }

  const addDefaultSections = () => {
    const baseTime = Date.now()
    const defaultSections = [
      {
        id: (baseTime + 1).toString(),
        title: "반려동물 이름",
        aiSuggestion: "반려동물의 이름을 입력해주세요"
      },
      {
        id: (baseTime + 2).toString(),
        title: "반려동물 품종",
        aiSuggestion: "반려동물의 품종을 입력해주세요"
      },
      {
        id: (baseTime + 3).toString(),
        title: "반려동물 나이",
        aiSuggestion: "반려동물의 나이를 입력해주세요"
      },
      {
        id: (baseTime + 4).toString(),
        title: "신청자 이름",
        aiSuggestion: "신청자의 이름을 입력해주세요"
      },
      {
        id: (baseTime + 5).toString(),
        title: "신청자 연락처",
        aiSuggestion: "신청자의 연락처를 입력해주세요"
      },
      {
        id: (baseTime + 6).toString(),
        title: "신청자 이메일",
        aiSuggestion: "신청자의 이메일을 입력해주세요"
      }
    ]
    setTemplateSections([...templateSections, ...defaultSections])
  }

  const generateClauseNumber = (title: string, sections: TemplateSection[] = templateSections) => {
    const finalTitle = title && title.trim() !== '' ? title : '새 항목'
    
    const usedNumbers = new Set<number>()
    
    sections.forEach((section) => {
      if (section.aiSuggestion) {
        const match = section.aiSuggestion.match(/제(\d+)조/)
        if (match) {
          usedNumbers.add(parseInt(match[1]))
        }
      }
    })
    
    let clauseNumber = 1
    while (usedNumbers.has(clauseNumber)) {
      clauseNumber++
    }
    
    return `제${clauseNumber}조 (${finalTitle})`
  }

  const getAISuggestion = async (title: string) => {
    try {
      const isDefaultTitle = !title || title === '' || title === '새 항목'
      
      if (isDefaultTitle) {
        const response = await axios.post(`${getBackendUrl()}/api/contract-templates/ai-suggestions/contract-suggestions`, {
          templateId: 1,
          currentContent: "",
          petInfo: {},
          userInfo: {}
        })
        
        if (response.data.data && response.data.data.suggestions && response.data.data.suggestions.length > 0) {
          const aiTitle = response.data.data.suggestions[0].suggestion.replace(/^제\d+조\s*\((.+)\)$/, '$1')
          return generateClauseNumber(aiTitle)
        }
      } else {
        const response = await axios.post(`${getBackendUrl()}/api/contract-templates/ai-suggestions/clauses`, {
          templateId: null,
          currentClauses: templateSections.map(s => s.title),
          petInfo: {},
          userInfo: {}
        })
        
        if (response.data.data && response.data.data.suggestions && response.data.data.suggestions.length > 0) {
          const aiTitle = response.data.data.suggestions[0].suggestion.replace(/^제\d+조\s*\((.+)\)$/, '$1')
          return generateClauseNumber(aiTitle)
        }
      }
      
      const defaultTitle = title || '새 항목'
      return generateClauseNumber(defaultTitle)
    } catch (error) {
      console.error("AI 추천 생성 실패:", error)
      const defaultTitle = title || '새 항목'
      return generateClauseNumber(defaultTitle)
    }
  }

  const handleGetClauseNumber = async (sectionId: string, title: string) => {
    const suggestion = await getAISuggestion(title)
    updateSection(sectionId, 'aiSuggestion', suggestion)
    setShowAISuggestion(sectionId)
  }

  const handleRejectAISuggestion = async (sectionId: string) => {
    const section = templateSections.find(s => s.id === sectionId)
    if (section) {
      try {
        const response = await axios.post(`${getBackendUrl()}/api/contract-templates/ai-suggestions/clauses`, {
          templateId: null,
          currentClauses: templateSections.map(s => s.title),
          petInfo: {},
          userInfo: {}
        })
        
        if (response.data.data && response.data.data.length > 1) {
          const randomIndex = Math.floor(Math.random() * (response.data.data.length - 1)) + 1
          const aiTitle = response.data.data[randomIndex].suggestion.replace(/^제\d+조\s*\((.+)\)$/, '$1')
          const newSuggestion = generateClauseNumber(aiTitle)
          updateSection(sectionId, 'aiSuggestion', newSuggestion)
        } else {
          const basicNumber = generateClauseNumber(section.title)
          updateSection(sectionId, 'aiSuggestion', basicNumber)
        }
      } catch (error) {
        console.error("다른 AI 추천 생성 실패:", error)
        const basicNumber = generateClauseNumber(section.title)
        updateSection(sectionId, 'aiSuggestion', basicNumber)
      }
    }
  }

  const handleApplyAISuggestion = (sectionId: string) => {
    const section = templateSections.find(s => s.id === sectionId)
    if (section && section.aiSuggestion) {
      const titleOnly = section.aiSuggestion.replace(/^제\d+조\s*\((.+)\)$/, '$1')
      updateSection(sectionId, 'title', titleOnly)
      setShowAISuggestion(null)
    }
  }

  const handleCloseAISuggestion = (sectionId: string) => {
    setShowAISuggestion(null)
  }

  const removeSection = (id: string) => {
    setTemplateSections(templateSections.filter(section => section.id !== id))
  }

  const updateSection = (id: string, field: 'title' | 'aiSuggestion', value: string) => {
    setTemplateSections(templateSections.map(section => 
      section.id === id ? { ...section, [field]: value } : section
    ))
  }

  const moveSection = (fromIndex: number, toIndex: number) => {
    const newSections = [...templateSections]
    const [movedSection] = newSections.splice(fromIndex, 1)
    newSections.splice(toIndex, 0, movedSection)
    setTemplateSections(newSections)
  }

  const handleCreateTemplate = async () => {
    try {
      const sections = templateSections.map((section, index) => ({
        title: section.title,
        order: index + 1,
        content: "",
        options: null
      }))
      
      const templateData = {
        name: newTemplate.name,
        category: newTemplate.category,
        sections: sections
      }
      
      const response = await axios.post(`${getBackendUrl()}/api/contract-templates`, templateData)
      if (response.data.success) {
        alert("템플릿이 생성되었습니다.")
        onClose()
        setNewTemplate({
          name: "",
          category: "",
          content: "",
          isDefault: false
        })
        setTemplateSections([])
        onCreateTemplate?.()
      } else {
        alert("템플릿 생성에 실패했습니다.")
      }
    } catch (error) {
      console.error("템플릿 생성 실패:", error)
      alert("템플릿 생성에 실패했습니다.")
    }
  }

  const handleClose = () => {
    setNewTemplate({
      name: "",
      category: "",
      content: "",
      isDefault: false
    })
    setTemplateSections([])
    setShowAISuggestion(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>새 템플릿 생성</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* 기본 정보 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">템플릿 이름</label>
              <input
                type="text"
                className="w-full mt-1 p-2 border rounded-md"
                value={newTemplate.name}
                onChange={(e) => setNewTemplate({...newTemplate, name: e.target.value})}
                placeholder="템플릿 이름을 입력하세요"
              />
            </div>
            <div>
              <label className="text-sm font-medium">카테고리</label>
              <select
                className="w-full mt-1 p-2 border rounded-md"
                value={newTemplate.category}
                onChange={(e) => setNewTemplate({...newTemplate, category: e.target.value})}
              >
                <option value="">카테고리 선택</option>
                <option value="입양계약서">입양계약서</option>
                <option value="분양계약서">분양계약서</option>
                <option value="임시보호계약서">임시보호계약서</option>
                <option value="의료계약서">의료계약서</option>
                <option value="훈련계약서">훈련계약서</option>
                <option value="기타">기타</option>
              </select>
            </div>
          </div>

          {/* 섹션 관리 */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium">계약서 항목</h3>
              <div className="flex gap-2">
                <Button 
                  onClick={addDefaultSections}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  기본 항목 추가
                </Button>
                <Button 
                  onClick={addSection}
                  className="bg-green-500 hover:bg-green-600 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  항목 추가
                </Button>
              </div>
            </div>
            
            {templateSections.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
                <p className="text-gray-500 mb-2">계약서에 필요한 항목들을 추가하세요</p>
                <p className="text-sm text-gray-400">"기본 항목 추가" 버튼으로 자주 사용하는 항목들을 한 번에 추가할 수 있습니다</p>
              </div>
            ) : (
              <div className="space-y-4">
                {templateSections.map((section, index) => (
                  <div key={section.id}>
                    <Card className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 relative">
                          <div className="cursor-move text-gray-400 hover:text-gray-600">
                            ⋮⋮
                          </div>
                          <h4 className="font-medium">항목 {index + 1}</h4>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleGetClauseNumber(section.id, section.title)}
                            className="text-xs whitespace-nowrap"
                          >
                            AI 추천
                          </Button>
                          
                          {/* AI 추천 말풍선 */}
                          {showAISuggestion === section.id && section.aiSuggestion && (
                            <div className="absolute top-30 left-0 z-10 w-80 bg-blue-50 border border-blue-200 rounded-lg shadow-lg p-3 mt-1">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-xs font-medium text-blue-800">AI 추천</span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCloseAISuggestion(section.id)}
                                  className="text-xs p-1 h-6 w-6"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                              <p className="text-sm text-blue-900 mb-2">{section.aiSuggestion.replace(/^제\d+조\s*\((.+)\)$/, '$1')}</p>
                              <div className="flex gap-1 justify-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectAISuggestion(section.id)}
                                  className="text-xs px-2"
                                >
                                  다른 추천
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleApplyAISuggestion(section.id)}
                                  className="text-xs bg-blue-500 hover:bg-blue-600 text-white px-2"
                                >
                                  적용하기
                                </Button>
                              </div>
                              <div className="absolute top-4 -left-2 w-0 h-0 border-t-2 border-b-2 border-r-2 border-transparent border-r-blue-50"></div>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {index > 0 && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => moveSection(index, index - 1)}
                            >
                              ↑
                            </Button>
                          )}
                          {index < templateSections.length - 1 && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => moveSection(index, index + 1)}
                            >
                              ↓
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => removeSection(section.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="text-sm font-medium">항목 제목</label>
                          <input
                            type="text"
                            className="w-full mt-1 p-2 border rounded-md"
                            value={section.title}
                            onChange={(e) => updateSection(section.id, 'title', e.target.value)}
                            placeholder="예: 반려동물 이름, 신청자 연락처"
                          />
                        </div>
                      </div>
                    </Card>
                  </div>
                ))}
                
                {/* 마지막 항목 아래에 추가 버튼 */}
                {templateSections.length > 0 && (
                  <div className="flex justify-center my-2">
                    <Button 
                      onClick={addSection}
                      className="bg-green-500 hover:bg-green-600 text-white text-sm"
                      size="sm"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      항목 추가
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 기본 템플릿 설정 */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="isDefault"
              checked={newTemplate.isDefault}
              onChange={(e) => setNewTemplate({...newTemplate, isDefault: e.target.checked})}
            />
            <label htmlFor="isDefault" className="text-sm">기본 템플릿으로 설정</label>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              취소
            </Button>
            <Button 
              onClick={handleCreateTemplate}
              className="bg-blue-500 hover:bg-blue-600 text-white"
              disabled={!newTemplate.name || !newTemplate.category || templateSections.length === 0}
            >
              템플릿 생성
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 