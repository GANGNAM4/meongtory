package com.my.backend.contract.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.my.backend.contract.dto.AISuggestionDto;
import com.my.backend.contract.dto.ContractGenerationRequestDto;
import com.my.backend.contract.entity.AISuggestion;
import com.my.backend.contract.entity.ContractTemplate;
import com.my.backend.contract.repository.AISuggestionRepository;
import com.my.backend.contract.repository.ContractTemplateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import jakarta.annotation.PostConstruct;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Transactional
public class AISuggestionService {
    
    private final AISuggestionRepository aiSuggestionRepository;
    private final ContractTemplateRepository contractTemplateRepository;
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;
    
    @Value("${AI_SERVICE_URL:http://localhost:9000}")
    private String aiServiceUrl;
    
    public List<AISuggestionDto> getClauseSuggestions(Long templateId, List<String> currentClauses,
                                                     ContractGenerationRequestDto.PetInfoDto petInfo,
                                                     ContractGenerationRequestDto.UserInfoDto userInfo,
                                                     String requestedBy) {
        
        // AI 조항 추천 생성
        List<AISuggestionDto> suggestions = generateClauseSuggestions(templateId, currentClauses, petInfo, userInfo);
        
        // 추천 내용 저장
        for (AISuggestionDto suggestion : suggestions) {
            AISuggestion aiSuggestion = AISuggestion.builder()
                    .suggestion(suggestion.getSuggestion())
                    .type(AISuggestion.SuggestionType.valueOf(suggestion.getType()))
                    .confidence(suggestion.getConfidence())
                    .template(templateId != null ? contractTemplateRepository.findById(templateId).orElse(null) : null)
                    .requestedBy(requestedBy)
                    .build();
            
            aiSuggestionRepository.save(aiSuggestion);
        }
        
        return suggestions;
    }
    
    public Map<String, Object> generateContract(ContractGenerationRequestDto requestDto, String requestedBy) {
        try {
            // AI 서비스에 요청
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("templateId", requestDto.getTemplateId());
            requestBody.put("templateSections", requestDto.getTemplateSections()); // 템플릿의 실제 조항들
            requestBody.put("customSections", requestDto.getCustomSections()); // 추가할 커스텀 조항들
            requestBody.put("removedSections", requestDto.getRemovedSections());
            Map<String, Object> petInfoMap = new HashMap<>();
            if (requestDto.getPetInfo() != null) {
                petInfoMap.put("name", requestDto.getPetInfo().getName() != null ? requestDto.getPetInfo().getName() : "");
                petInfoMap.put("breed", requestDto.getPetInfo().getBreed() != null ? requestDto.getPetInfo().getBreed() : "");
                petInfoMap.put("age", requestDto.getPetInfo().getAge() != null ? requestDto.getPetInfo().getAge() : 0);
                petInfoMap.put("healthStatus", requestDto.getPetInfo().getHealthStatus() != null ? requestDto.getPetInfo().getHealthStatus() : "");
            }
            requestBody.put("petInfo", petInfoMap);
            
            Map<String, Object> userInfoMap = new HashMap<>();
            if (requestDto.getUserInfo() != null) {
                userInfoMap.put("name", requestDto.getUserInfo().getName() != null ? requestDto.getUserInfo().getName() : "");
                userInfoMap.put("phone", requestDto.getUserInfo().getPhone() != null ? requestDto.getUserInfo().getPhone() : "");
                userInfoMap.put("email", requestDto.getUserInfo().getEmail() != null ? requestDto.getUserInfo().getEmail() : "");
            }
            requestBody.put("userInfo", userInfoMap);
            requestBody.put("additionalInfo", requestDto.getAdditionalInfo());
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                aiServiceUrl + "/generate-contract", 
                request, 
                Map.class
            );
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            } else {
                return getDefaultContractResponse();
            }
            
        } catch (Exception e) {
            // 에러 발생 시 기본 응답 반환
            e.printStackTrace();
            return getDefaultContractResponse();
        }
    }
    
    public Map<String, Object> getContractSuggestions(ContractSuggestionRequestDto requestDto, String requestedBy) {
        
        try {
            // AI 서비스에 요청
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("templateId", requestDto.getTemplateId());
            requestBody.put("currentContent", requestDto.getCurrentContent());
            
            Map<String, Object> petInfoMap = new HashMap<>();
            if (requestDto.getPetInfo() != null) {
                petInfoMap.put("name", requestDto.getPetInfo().getName() != null ? requestDto.getPetInfo().getName() : "");
                petInfoMap.put("breed", requestDto.getPetInfo().getBreed() != null ? requestDto.getPetInfo().getBreed() : "");
                petInfoMap.put("age", requestDto.getPetInfo().getAge() != null ? requestDto.getPetInfo().getAge() : 0);
                petInfoMap.put("healthStatus", requestDto.getPetInfo().getHealthStatus() != null ? requestDto.getPetInfo().getHealthStatus() : "");
            }
            requestBody.put("petInfo", petInfoMap);
            
            Map<String, Object> userInfoMap = new HashMap<>();
            if (requestDto.getUserInfo() != null) {
                userInfoMap.put("name", requestDto.getUserInfo().getName() != null ? requestDto.getUserInfo().getName() : "");
                userInfoMap.put("phone", requestDto.getUserInfo().getPhone() != null ? requestDto.getUserInfo().getPhone() : "");
                userInfoMap.put("email", requestDto.getUserInfo().getEmail() != null ? requestDto.getUserInfo().getEmail() : "");
            }
            requestBody.put("userInfo", userInfoMap);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                aiServiceUrl + "/contract-suggestions", 
                request, 
                Map.class
            );
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                return response.getBody();
            } else {
                return getDefaultContractSuggestionsResponse();
            }
            
        } catch (Exception e) {
            // 에러 발생 시 기본 응답 반환
            return getDefaultContractSuggestionsResponse();
        }
    }
    
    private List<AISuggestionDto> generateClauseSuggestions(Long templateId, List<String> currentClauses,
                                                           ContractGenerationRequestDto.PetInfoDto petInfo,
                                                           ContractGenerationRequestDto.UserInfoDto userInfo) {
        try {
            // AI 서비스에 요청
            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("templateId", templateId);
            requestBody.put("currentClauses", currentClauses);
            Map<String, Object> petInfoMap = new HashMap<>();
            if (petInfo != null) {
                petInfoMap.put("name", petInfo.getName() != null ? petInfo.getName() : "");
                petInfoMap.put("breed", petInfo.getBreed() != null ? petInfo.getBreed() : "");
                petInfoMap.put("age", petInfo.getAge() != null ? petInfo.getAge() : 0);
                petInfoMap.put("healthStatus", petInfo.getHealthStatus() != null ? petInfo.getHealthStatus() : "");
            }
            requestBody.put("petInfo", petInfoMap);
            
            Map<String, Object> userInfoMap = new HashMap<>();
            if (userInfo != null) {
                userInfoMap.put("name", userInfo.getName() != null ? userInfo.getName() : "");
                userInfoMap.put("phone", userInfo.getPhone() != null ? userInfo.getPhone() : "");
                userInfoMap.put("email", userInfo.getEmail() != null ? userInfo.getEmail() : "");
            }
            requestBody.put("userInfo", userInfoMap);
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(
                aiServiceUrl + "/clause-suggestions", 
                request, 
                Map.class
            );
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                List<Map<String, Object>> suggestions = (List<Map<String, Object>>) response.getBody().get("suggestions");
                return convertToAISuggestionDtos(suggestions);
            } else {
                return getDefaultClauseSuggestions();
            }
            
        } catch (Exception e) {
            // 에러 발생 시 기본 추천 반환
            e.printStackTrace();
            return getDefaultClauseSuggestions();
        }
    }
    
    private Map<String, Object> getDefaultContractResponse() {
        Map<String, Object> response = new HashMap<>();
        response.put("content", "기본 계약서 내용입니다.");
        response.put("status", "success");
        response.put("message", "기본 계약서가 생성되었습니다.");
        return response;
    }
    
    private Map<String, Object> getDefaultContractSuggestionsResponse() {
        Map<String, Object> response = new HashMap<>();
        List<Map<String, Object>> suggestions = new ArrayList<>();
        
        suggestions.add(Map.of("suggestion", "제4조 (건강관리)", "type", "SECTION", "confidence", 0.8));
        suggestions.add(Map.of("suggestion", "제5조 (의료비용)", "type", "SECTION", "confidence", 0.7));
        suggestions.add(Map.of("suggestion", "제6조 (반려동물 행동)", "type", "SECTION", "confidence", 0.6));
        
        response.put("suggestions", suggestions);
        return response;
    }
    
    private List<AISuggestionDto> convertToAISuggestionDtos(List<Map<String, Object>> suggestions) {
        List<AISuggestionDto> result = new ArrayList<>();
        
        for (Map<String, Object> suggestion : suggestions) {
            AISuggestionDto dto = AISuggestionDto.builder()
                    .suggestion((String) suggestion.get("suggestion"))
                    .type((String) suggestion.get("type"))
                    .confidence((Double) suggestion.get("confidence"))
                    .build();
            result.add(dto);
        }
        
        return result;
    }
    
    private List<AISuggestionDto> getDefaultClauseSuggestions() {
        List<AISuggestionDto> suggestions = new ArrayList<>();
        
        suggestions.add(AISuggestionDto.builder()
                .suggestion("제4조 (건강관리)")
                .type("CLAUSE")
                .confidence(0.9)
                .build());
        
        suggestions.add(AISuggestionDto.builder()
                .suggestion("제5조 (의료비용)")
                .type("CLAUSE")
                .confidence(0.8)
                .build());
        
        suggestions.add(AISuggestionDto.builder()
                .suggestion("제6조 (반려동물 행동)")
                .type("CLAUSE")
                .confidence(0.7)
                .build());
        
        suggestions.add(AISuggestionDto.builder()
                .suggestion("제7조 (식사 및 영양)")
                .type("CLAUSE")
                .confidence(0.6)
                .build());
        
        suggestions.add(AISuggestionDto.builder()
                .suggestion("제8조 (임시보호)")
                .type("CLAUSE")
                .confidence(0.5)
                .build());
        
        return suggestions;
    }
    
    public List<AISuggestionDto> getSuggestionsByUser(String requestedBy) {
        return aiSuggestionRepository.findByRequestedBy(requestedBy).stream()
                .map(this::convertToDto)
                .toList();
    }
    
    private AISuggestionDto convertToDto(AISuggestion suggestion) {
        return AISuggestionDto.builder()
                .id(suggestion.getId())
                .suggestion(suggestion.getSuggestion())
                .type(suggestion.getType().name())
                .confidence(suggestion.getConfidence())
                .build();
    }
    
    // 계약서 조항 추천 요청을 위한 DTO
    public static class ContractSuggestionRequestDto {
        private Long templateId;
        private String currentContent;
        private ContractGenerationRequestDto.PetInfoDto petInfo;
        private ContractGenerationRequestDto.UserInfoDto userInfo;
        
        // Getters and Setters
        public Long getTemplateId() { return templateId; }
        public void setTemplateId(Long templateId) { this.templateId = templateId; }
        
        public String getCurrentContent() { return currentContent; }
        public void setCurrentContent(String currentContent) { this.currentContent = currentContent; }
        
        public ContractGenerationRequestDto.PetInfoDto getPetInfo() { return petInfo; }
        public void setPetInfo(ContractGenerationRequestDto.PetInfoDto petInfo) { this.petInfo = petInfo; }
        
        public ContractGenerationRequestDto.UserInfoDto getUserInfo() { return userInfo; }
        public void setUserInfo(ContractGenerationRequestDto.UserInfoDto userInfo) { this.userInfo = userInfo; }
    }
} 