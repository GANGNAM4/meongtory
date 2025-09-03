package com.my.backend.contract.controller;

import com.my.backend.contract.dto.ContractGenerationRequestDto;
import com.my.backend.contract.dto.ContractGenerationResponseDto;
import com.my.backend.contract.dto.ContractSuggestionRequestDto;
import com.my.backend.contract.service.ContractGenerationService;
import com.my.backend.contract.service.ContractFileService;
import com.my.backend.global.dto.ResponseDto;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

@RestController
@RequestMapping("/api/contract-generation")
@RequiredArgsConstructor
public class ContractGenerationController {
    
    private final ContractGenerationService contractGenerationService;
    private final ContractFileService contractFileService;
    
    @PostMapping
    public ResponseEntity<ResponseDto<ContractGenerationResponseDto>> generateContract(
            @RequestBody ContractGenerationRequestDto requestDto, Authentication authentication) {
        String userEmail = authentication.getName();
        ContractGenerationResponseDto response = contractGenerationService.generateContract(requestDto, userEmail);
        return ResponseEntity.ok(ResponseDto.success(response));
    }
    
    @GetMapping("/user")
    public ResponseEntity<ResponseDto<List<ContractGenerationResponseDto>>> getGeneratedContractsByUser(
            Authentication authentication) {
        String userEmail = authentication.getName();
        List<ContractGenerationResponseDto> contracts = contractGenerationService.getGeneratedContractsByUser(userEmail);
        return ResponseEntity.ok(ResponseDto.success(contracts));
    }
    
    @GetMapping("/{id}")
    public ResponseEntity<ResponseDto<ContractGenerationResponseDto>> getGeneratedContractById(@PathVariable Long id) {
        ContractGenerationResponseDto contract = contractGenerationService.getGeneratedContractById(id);
        return ResponseEntity.ok(ResponseDto.success(contract));
    }
    
    @GetMapping("/{id}/download")
    public ResponseEntity<ByteArrayResource> downloadContract(@PathVariable Long id) {
        try {
            System.out.println("=== 계약서 다운로드 시작 ===");
            System.out.println("요청된 계약서 ID: " + id);
            
            // 계약서 데이터 조회
            ContractGenerationResponseDto contract = contractGenerationService.getGeneratedContractById(id);
            if (contract == null) {
                System.out.println("계약서를 찾을 수 없음: " + id);
                return ResponseEntity.notFound().build();
            }
            
            System.out.println("계약서 내용 길이: " + (contract.getContent() != null ? contract.getContent().length() : 0));
            
            // PDF 생성
            byte[] fileContent = contractFileService.generatePDF(contract.getContent());
            if (fileContent == null || fileContent.length == 0) {
                System.out.println("PDF 생성 실패: 빈 파일");
                return ResponseEntity.internalServerError().build();
            }
            
            System.out.println("PDF 생성 완료, 파일 크기: " + fileContent.length + " bytes");
            
            // ContractFileService에서 파일명 생성
            String filename = contractFileService.generateFilename(contract.getContent());
            System.out.println("=== 파일명 생성 완료 ===");
            System.out.println("생성된 파일명: " + filename);
            System.out.println("Content-Disposition 헤더: attachment; filename=\"" + filename + "\"");
            
            ByteArrayResource resource = new ByteArrayResource(fileContent);
            
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .header(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate")
                    .header(HttpHeaders.PRAGMA, "no-cache")
                    .header(HttpHeaders.EXPIRES, "0")
                    .contentType(MediaType.APPLICATION_PDF)
                    .body(resource);
                    
        } catch (RuntimeException e) {
            System.err.println("계약서 조회 실패: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.notFound().build();
        } catch (IOException e) {
            System.err.println("PDF 생성 중 IOException 발생: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        } catch (Exception e) {
            System.err.println("계약서 다운로드 중 예외 발생: " + e.getMessage());
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
    
    @PostMapping("/suggestion")
    public ResponseEntity<ResponseDto<String>> generateContractSuggestion(
            @RequestBody ContractSuggestionRequestDto requestDto) {
        String suggestion = contractGenerationService.generateContractSuggestion(requestDto.getItemTitle());
        return ResponseEntity.ok(ResponseDto.success(suggestion));
    }
    
    @PutMapping("/{id}")
    public ResponseEntity<ResponseDto<ContractGenerationResponseDto>> updateGeneratedContract(
            @PathVariable Long id, @RequestBody ContractGenerationRequestDto requestDto) {
        ContractGenerationResponseDto updatedContract = contractGenerationService.updateGeneratedContract(id, requestDto);
        return ResponseEntity.ok(ResponseDto.success(updatedContract));
    }
    
    @DeleteMapping("/{id}")
    public ResponseEntity<ResponseDto<Void>> deleteGeneratedContract(@PathVariable Long id) {
        contractGenerationService.deleteGeneratedContract(id);
        return ResponseEntity.ok(ResponseDto.success(null));
    }
    

} 