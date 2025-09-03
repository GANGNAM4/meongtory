package com.my.backend.community.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;

@Component
@RequiredArgsConstructor
@Slf4j
public class EnhancedProfanityFilter {

    @Value("${openai.api.key:}")
    private String openaiApiKey;

    // 정규식 기반 비속어 패턴 (보조 필터링) - 한국 욕 + 변형
    private static final String[] BAD_WORD_PATTERNS = {
        "개[\\W_0-9]*새[\\W_0-9]*끼",
        "개[\\W_0-9]*같",   // 개같다, 개같은
        "ㅅ[\\W_0-9]*ㅂ",
        "씨[\\W_0-9]*발",
        "병[\\W_0-9]*신",
        "미친",
        "좆",
        "fuck",
        "shit"
    };

    /**
     * 2단계 비속어 필터링: 정규식 보조 + OpenAI Moderation API 필수 호출
     * @param content 검사할 텍스트
     * @return 비속어 포함 여부
     */
    public boolean containsProfanity(String content) {
        if (content == null || content.trim().isEmpty()) {
            return false;
        }

        // 1단계: 정규식 기반 보조 필터링
        if (containsBadWordRegex(content)) {
            return true;
        }

        // 2단계: OpenAI Moderation API 호출 (정규식에서 안 걸리더라도 항상 실행)
        if (openaiApiKey != null && !openaiApiKey.trim().isEmpty()) {
            try {
                if (isInappropriateByOpenAI(content)) {
                    return true;
                }
            } catch (Exception e) {
                log.warn("OpenAI Moderation API 호출 실패: {}", e.getMessage());
                // API 호출 실패 시 정규식 필터만으로 처리
            }
        } else {
            log.warn("OpenAI API 키가 설정되지 않아 정규식 필터만 사용");
        }

        return false;
    }

    /**
     * 정규식 기반 비속어 검사 (보조 필터)
     * @param content 검사할 텍스트
     * @return 비속어 포함 여부
     */
    private boolean containsBadWordRegex(String content) {
        if (content == null) return false;
        
        String normalizedContent = content.toLowerCase();
        
        for (String pattern : BAD_WORD_PATTERNS) {
            if (normalizedContent.matches(".*" + pattern + ".*")) {
                return true;
            }
        }
        return false;
    }

    /**
     * OpenAI Moderation API를 통한 비속어 검사 (2차 필터)
     * @param text 검사할 텍스트
     * @return 부적절한 내용 포함 여부
     */
    private boolean isInappropriateByOpenAI(String text) {
        try {
            RestTemplate restTemplate = new RestTemplate();
            ObjectMapper objectMapper = new ObjectMapper();
            
            // OpenAI Moderation API 요청 JSON 생성
            String requestBody = objectMapper.writeValueAsString(
                objectMapper.createObjectNode()
                    .put("input", text)
                    .put("model", "text-moderation-latest")
            );
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.setBearerAuth(openaiApiKey);
            
            HttpEntity<String> entity = new HttpEntity<>(requestBody, headers);
            
            ResponseEntity<String> response = restTemplate.postForEntity(
                "https://api.openai.com/v1/moderations", 
                entity, 
                String.class
            );
            
            if (response.getStatusCode() != HttpStatus.OK) {
                log.warn("OpenAI API 호출 실패: {}", response.getStatusCode());
                return false;
            }
            
            JsonNode jsonNode = objectMapper.readTree(response.getBody());
            JsonNode result = jsonNode.path("results").get(0);
            
            boolean flagged = result.path("flagged").asBoolean();
            JsonNode categories = result.path("categories");
            JsonNode categoryScores = result.path("category_scores");
            
            // harassment와 hate score 확인
            double harassmentScore = categoryScores.path("harassment").asDouble(0.0);
            double hateScore = categoryScores.path("hate").asDouble(0.0);
            
            // flagged이거나 harassment/hate score가 0.3을 초과하면 부적절
            return flagged || harassmentScore > 0.3 || hateScore > 0.3;
            
        } catch (Exception e) {
            log.error("OpenAI Moderation API 호출 중 오류 발생: {}", e.getMessage());
            throw new RuntimeException("OpenAI API 호출 실패", e);
        }
    }
}
