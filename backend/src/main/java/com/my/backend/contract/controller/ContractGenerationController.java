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
            // 계약서 데이터 조회
            ContractGenerationResponseDto contract = contractGenerationService.getGeneratedContractById(id);
            if (contract == null) {
                return ResponseEntity.notFound().build();
            }
            
            // PDF 생성
            byte[] fileContent = contractFileService.generatePDF(contract.getContent());
            if (fileContent == null || fileContent.length == 0) {
                return ResponseEntity.internalServerError().build();
            }
            
            // ContractFileService에서 파일명 생성
            String filename = contractFileService.generateFilename(contract.getContent());
            
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