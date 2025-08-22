"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileText } from "lucide-react"

interface TemplateViewModalProps {
  isOpen: boolean
  onClose: () => void
  selectedTemplate: any
}

export default function TemplateViewModal({ isOpen, onClose, selectedTemplate }: TemplateViewModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            템플릿 상세 보기
          </DialogTitle>
        </DialogHeader>
        
        {selectedTemplate && (
          <div className="space-y-6">
            {/* 템플릿 기본 정보 */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium mb-2">템플릿 정보</h4>
              <div className="text-sm space-y-1">
                <p><strong>이름:</strong> {selectedTemplate.name}</p>
                <p><strong>카테고리:</strong> {selectedTemplate.category}</p>
                <p><strong>설명:</strong> {selectedTemplate.description}</p>
                <p><strong>타입:</strong> {selectedTemplate.isDefault ? "기본 템플릿" : "사용자 템플릿"}</p>
              </div>
            </div>

            {/* 템플릿 섹션 */}
            {selectedTemplate.sections && selectedTemplate.sections.length > 0 ? (
              <div>
                <h4 className="font-medium mb-3">템플릿 섹션</h4>
                <div className="space-y-3">
                  {selectedTemplate.sections.map((section: any, index: number) => (
                    <Card key={index}>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <span>{index + 1}. {section.title}</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {section.aiSuggestion && (
                          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm font-medium text-blue-800 mb-1">AI 추천 내용</p>
                            <p className="text-sm text-blue-900">{section.aiSuggestion.replace(/^제\d+조\s*\((.+)\)$/, '$1')}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <h4 className="font-medium mb-3">템플릿 내용</h4>
                <div className="bg-white border rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-sm">{selectedTemplate.content || "내용이 없습니다."}</pre>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            닫기
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 