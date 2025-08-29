package com.my.backend.contract.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.my.backend.contract.dto.ContractGenerationRequestDto;
import com.my.backend.contract.dto.ContractGenerationResponseDto;
import com.my.backend.contract.entity.ContractTemplate;
import com.my.backend.contract.entity.GeneratedContract;
import com.my.backend.contract.repository.ContractTemplateRepository;
import com.my.backend.contract.repository.GeneratedContractRepository;
import com.my.backend.s3.S3Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class ContractGenerationService {
    
    private final ContractTemplateRepository contractTemplateRepository;
    private final GeneratedContractRepository generatedContractRepository;
    private final ObjectMapper objectMapper;
    private final S3Service s3Service;
    
    public ContractGenerationResponseDto generateContract(ContractGenerationRequestDto requestDto, String generatedBy) {
        // 템플릿 조회
        ContractTemplate template = contractTemplateRepository.findById(requestDto.getTemplateId())
                .orElseThrow(() -> new RuntimeException("템플릿을 찾을 수 없습니다."));
        
        // AI가 생성한 내용이 있으면 사용, 없으면 백엔드에서 생성
        String contractContent;
        if (requestDto.getContent() != null && !requestDto.getContent().trim().isEmpty()) {
            contractContent = requestDto.getContent();
        } else {
            contractContent = generateContractContent(template, requestDto);
        }
        
        // 동물명을 포함한 계약서 이름 생성
        String petName = requestDto.getPetInfo() != null ? requestDto.getPetInfo().getName() : "반려동물";
        String contractName = petName + "_계약서";
        
        // 생성된 계약서 저장
        GeneratedContract generatedContract = GeneratedContract.builder()
                .contractName(contractName)
                .content(contractContent)
                .template(template)
                .generatedBy(generatedBy)
                .customSections(convertToJson(requestDto.getCustomSections()))
                .removedSections(convertToJson(requestDto.getRemovedSections()))
                .petInfo(convertToJson(requestDto.getPetInfo()))
                .userInfo(convertToJson(requestDto.getUserInfo()))
                .additionalInfo(requestDto.getAdditionalInfo())
                .build();
        
        GeneratedContract savedContract = generatedContractRepository.save(generatedContract);
        
        // PDF 생성 및 S3 업로드
        try {
            String pdfUrl = s3Service.uploadContractToS3(savedContract.getId(), savedContract.getContent());
            savedContract.setPdfUrl(pdfUrl);
            generatedContractRepository.save(savedContract);
            log.info("계약서 PDF 생성 및 S3 업로드 완료: {}", savedContract.getId());
        } catch (Exception e) {
            log.error("PDF 생성 및 S3 업로드 실패: {}", e.getMessage());
            // PDF 생성 실패해도 계약서는 저장 완료
            log.info("계약서 저장은 완료되었으나 PDF 생성에 실패했습니다: {}", savedContract.getId());
        }
        
        return ContractGenerationResponseDto.builder()
                .id(savedContract.getId())
                .contractName(savedContract.getContractName())
                .content(savedContract.getContent())
                .petInfo(savedContract.getPetInfo())
                .userInfo(savedContract.getUserInfo())
                .pdfUrl(savedContract.getPdfUrl())
                .wordUrl(savedContract.getWordUrl())
                .generatedAt(savedContract.getCreatedAt())
                .build();
    }
    
    private String generateContractContent(ContractTemplate template, ContractGenerationRequestDto requestDto) {
        StringBuilder content = new StringBuilder();
        
        // 동물명을 포함한 계약서 제목
        String petName = requestDto.getPetInfo() != null ? requestDto.getPetInfo().getName() : "반려동물";
        content.append(petName).append(" 계약서\n\n");
        
        // 반려동물 정보 추가
        if (requestDto.getPetInfo() != null) {
            content.append("반려동물 정보:\n");
            content.append("이름: ").append(requestDto.getPetInfo().getName()).append("\n");
            content.append("품종: ").append(requestDto.getPetInfo().getBreed()).append("\n");
            content.append("나이: ").append(requestDto.getPetInfo().getAge()).append("\n");
            content.append("건강상태: ").append(requestDto.getPetInfo().getHealthStatus()).append("\n\n");
        }
        
        // 사용자 정보 추가
        if (requestDto.getUserInfo() != null) {
            content.append("사용자 정보:\n");
            content.append("이름: ").append(requestDto.getUserInfo().getName()).append("\n");
            content.append("전화번호: ").append(requestDto.getUserInfo().getPhone()).append("\n");
            content.append("이메일: ").append(requestDto.getUserInfo().getEmail()).append("\n\n");
        }
        
        // 커스텀 섹션 추가
        if (requestDto.getCustomSections() != null && !requestDto.getCustomSections().isEmpty()) {
            content.append("추가 조항:\n");
            for (var section : requestDto.getCustomSections()) {
                String title = (String) section.get("title");
                if (title != null) {
                    content.append(title).append("\n\n");
                }
            }
        }
        
        // 추가 정보
        if (requestDto.getAdditionalInfo() != null && !requestDto.getAdditionalInfo().trim().isEmpty()) {
            content.append("추가 정보:\n");
            content.append(requestDto.getAdditionalInfo()).append("\n\n");
        }
        
        return content.toString();
    }
    
    private String convertToJson(Object obj) {
        try {
            return objectMapper.writeValueAsString(obj);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
    
    public List<ContractGenerationResponseDto> getGeneratedContractsByUser(String generatedBy) {
        return generatedContractRepository.findByGeneratedBy(generatedBy).stream()
                .map(this::convertToDto)
                .toList();
    }
    
    public ContractGenerationResponseDto getGeneratedContractById(Long id) {
        GeneratedContract contract = generatedContractRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("생성된 계약서를 찾을 수 없습니다."));
        return convertToDto(contract);
    }
    
    private ContractGenerationResponseDto convertToDto(GeneratedContract contract) {
        return ContractGenerationResponseDto.builder()
                .id(contract.getId())
                .contractName(contract.getContractName())
                .content(contract.getContent())
                .petInfo(contract.getPetInfo())
                .userInfo(contract.getUserInfo())
                .pdfUrl(contract.getPdfUrl())
                .wordUrl(contract.getWordUrl())
                .generatedAt(contract.getCreatedAt())
                .build();
    }
    
    public String generateContractSuggestion(String itemTitle) {
        // 간단한 AI 추천 로직
        switch (itemTitle.toLowerCase()) {
            case "반려동물 이름":
                return "입양하는 반려동물의 이름을 명시하여 계약서의 주체를 명확히 합니다.";
            case "반려동물 품종":
                return "반려동물의 품종을 명시하여 동물의 특성과 관리 방법을 고려한 계약 조건을 설정합니다.";
            case "반려동물 나이":
                return "반려동물의 나이를 명시하여 연령에 따른 특별 관리 사항을 계약에 반영합니다.";
            case "신청자 이름":
                return "입양 신청자의 실명을 명시하여 계약의 당사자를 명확히 합니다.";
            case "신청자 연락처":
                return "신청자의 연락처를 명시하여 향후 소통과 관리가 가능하도록 합니다.";
            case "신청자 이메일":
                return "신청자의 이메일을 명시하여 공식 문서 전달과 소통에 활용합니다.";
            case "주거환경":
                return "신청자의 주거 환경을 확인하여 반려동물이 적합한 환경에서 생활할 수 있는지 검토합니다.";
            case "가족 구성원":
                return "가족 구성원을 명시하여 반려동물과 함께 생활할 모든 구성원의 동의를 확인합니다.";
            case "경제적 여유":
                return "반려동물 양육에 필요한 경제적 여유가 있는지 확인하여 책임감 있는 입양을 보장합니다.";
            case "양육 경험":
                return "이전 반려동물 양육 경험이 있는지 확인하여 적절한 관리 능력을 평가합니다.";
            case "양육 시간":
                return "반려동물과 함께할 수 있는 시간을 확인하여 적절한 관리가 가능한지 검토합니다.";
            case "의료 보험":
                return "반려동물의 의료 보험 가입 여부를 확인하여 건강 관리 계획을 수립합니다.";
            case "사전 교육":
                return "반려동물 양육에 대한 사전 교육 이수 여부를 확인하여 책임감 있는 입양을 보장합니다.";
            default:
                return "이 항목에 대한 구체적인 정보를 수집하여 계약 조건을 세분화하고 책임감 있는 입양을 보장합니다.";
        }
    }
    
    public ContractGenerationResponseDto updateGeneratedContract(Long id, ContractGenerationRequestDto requestDto) {
        GeneratedContract contract = generatedContractRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("계약서를 찾을 수 없습니다."));
        
        // 계약서 내용 업데이트
        if (requestDto.getContent() != null && !requestDto.getContent().trim().isEmpty()) {
            contract.setContent(requestDto.getContent());
        }
        
        // 수정된 계약서 저장
        GeneratedContract updatedContract = generatedContractRepository.save(contract);
        
        // 기존 PDF 삭제 후 새로운 PDF 생성 및 S3 업로드
        try {
            // 기존 S3 PDF 파일 삭제
            if (updatedContract.getPdfUrl() != null && !updatedContract.getPdfUrl().isEmpty()) {
                s3Service.deleteContractFromS3(id);
                log.info("기존 계약서 PDF S3 삭제 완료: {}", id);
            }
            
            // 새로운 PDF 생성 및 S3 업로드
            String newPdfUrl = s3Service.uploadContractToS3(id, updatedContract.getContent());
            updatedContract.setPdfUrl(newPdfUrl);
            generatedContractRepository.save(updatedContract);
            log.info("새로운 계약서 PDF S3 업로드 완료: {}", id);
            
        } catch (Exception e) {
            log.error("계약서 PDF 업데이트 실패: {}", e.getMessage());
            throw new RuntimeException("계약서 PDF 업데이트에 실패했습니다.");
        }
        
        return convertToDto(updatedContract);
    }
    
    public void deleteGeneratedContract(Long id) {
        GeneratedContract contract = generatedContractRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("생성된 계약서를 찾을 수 없습니다."));
        
        try {
            // S3에서 PDF 파일 삭제
            if (contract.getPdfUrl() != null && !contract.getPdfUrl().isEmpty()) {
                s3Service.deleteContractFromS3(id);
                log.info("계약서 PDF S3 삭제 완료: {}", id);
            }
        } catch (Exception e) {
            log.error("계약서 PDF S3 삭제 실패: {}", e.getMessage());
            // S3 삭제 실패해도 DB 삭제는 계속 진행
        }
        
        // DB에서 계약서 삭제
        generatedContractRepository.delete(contract);
        log.info("계약서 DB 삭제 완료: {}", id);
    }
} 