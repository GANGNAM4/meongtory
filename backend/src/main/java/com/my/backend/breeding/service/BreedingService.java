package com.my.backend.breeding.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.my.backend.breeding.dto.BreedingResultDto;
import com.my.backend.s3.S3Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.reactive.function.BodyInserters;
import org.springframework.web.reactive.function.client.WebClient;

@Service
@Slf4j
@RequiredArgsConstructor
public class BreedingService {

    private final S3Service s3Service;

    @Value("${ai.service.url}")
    private String aiBaseUrl;

    private WebClient aiClient;

    private WebClient getAiClient() {
        if (aiClient == null) {
            aiClient = WebClient.builder().baseUrl(aiBaseUrl).build();
        }
        return aiClient;
    }

    public BreedingResultDto predictBreeding(MultipartFile parent1, MultipartFile parent2) {
        try {
            log.info("교배 예측 시작 - AI 서비스 URL: {}", aiBaseUrl);
            
            // 1) 입력 검증
            if (parent1 == null || parent1.isEmpty() || parent2 == null || parent2.isEmpty()) {
                throw new IllegalArgumentException("부모 이미지가 제공되지 않았습니다.");
            }
            String p1 = parent1.getOriginalFilename();
            String p2 = parent2.getOriginalFilename();
            log.info("파일 정보 - parent1: {} ({} bytes), parent2: {} ({} bytes)", 
                    p1, parent1.getSize(), p2, parent2.getSize());
            
            if ((p1 != null && !p1.matches(".*\\.(jpg|jpeg|png)$")) ||
                    (p2 != null && !p2.matches(".*\\.(jpg|jpeg|png)$"))) {
                throw new IllegalArgumentException("허용된 파일 형식은 .jpg, .jpeg, .png입니다.");
            }
            if (parent1.getSize() > 10 * 1024 * 1024 || parent2.getSize() > 10 * 1024 * 1024) {
                throw new IllegalArgumentException("파일 크기는 10MB를 초과할 수 없습니다.");
            }

            // 2) 파이썬 AI로 멀티파트 전송
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("parent1", new ByteArrayResource(parent1.getBytes()) {
                @Override public String getFilename() { return p1 != null ? p1 : "parent1.jpg"; }
            });
            body.add("parent2", new ByteArrayResource(parent2.getBytes()) {
                @Override public String getFilename() { return p2 != null ? p2 : "parent2.jpg"; }
            });

            log.info("AI 서비스 호출 시작: {}/predict-breeding", aiBaseUrl);
            
            String jsonResponse = getAiClient().post()
                    .uri("/predict-breeding")
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .body(BodyInserters.fromMultipartData(body))
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();

            log.info("AI 서비스 JSON 응답 받음: {}", jsonResponse);

            if (jsonResponse == null || jsonResponse.trim().isEmpty()) {
                throw new RuntimeException("AI 서버로부터 결과를 받지 못했습니다.");
            }

            // JSON 파싱 (Python에서 이미 백분율로 변환됨)
            ObjectMapper objectMapper = new ObjectMapper();
            BreedingResultDto result = objectMapper.readValue(jsonResponse, BreedingResultDto.class);

            log.info("AI 응답 파싱 완료: 확률={}%, 품종={}", result.getProbability(), result.getResultBreed());

            log.info("최종 파싱된 결과: {}", result);

            
            

            // 이미지 생성 안 하면 빈 문자열 유지
            if (result.getImage() == null) result.setImage("");

            return result;

        } catch (Exception e) {
            log.error("교배 예측 실패: {}", e.getMessage(), e);
            throw new RuntimeException("Breeding prediction failed: " + e.getMessage(), e);
        }
    }
}
