"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FileText } from "lucide-react"

interface GeneratedContractViewModalProps {
  isOpen: boolean
  onClose: () => void
  generatedContract: string | null
}

export default function GeneratedContractViewModal({ isOpen, onClose, generatedContract }: GeneratedContractViewModalProps) {
  const handleDownloadContract = async () => {
    try {
      // 임시로 텍스트 파일로 다운로드
      const blob = new Blob([generatedContract || ""], { type: 'text/plain' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `generated-contract-${Date.now()}.txt`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      
      alert("계약서 파일이 다운로드되었습니다.")
    } catch (error) {
      console.error("계약서 다운로드 실패:", error)
      alert("파일 다운로드에 실패했습니다.")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            생성된 계약서 보기
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {generatedContract ? (
            <div className="space-y-4">
              {/* 계약서 내용 */}
              <div className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium">생성된 계약서 내용</h4>
                  <div className="flex gap-2">
                    <Button 
                      size="sm"
                      variant="outline"
                      className="bg-white text-black border border-gray-300 hover:bg-gray-50"
                      onClick={handleDownloadContract}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      파일 다운로드
                    </Button>
                  </div>
                </div>
                <div className="bg-white p-4 rounded border max-h-96 overflow-y-auto">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{generatedContract}</div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={onClose}>
                  닫기
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>생성된 계약서가 없습니다.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 