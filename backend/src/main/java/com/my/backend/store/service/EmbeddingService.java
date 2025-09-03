package com.my.backend.store.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Arrays;
import java.util.concurrent.CompletableFuture;

@Service
@RequiredArgsConstructor
@Slf4j
public class EmbeddingService {

    private final RestTemplate restTemplate;

    /**
     * AI 서비스의 API를 호출하여 임베딩을 업데이트
     */
    public CompletableFuture<String> updateEmbeddingsAsync() {
        return CompletableFuture.supplyAsync(() -> {
            try {
                String aiServiceUrl = "http://ai:9000/update-embeddings";
                HttpHeaders headers = new HttpHeaders();
                headers.setContentType(MediaType.APPLICATION_JSON);
                headers.setAccept(Arrays.asList(MediaType.APPLICATION_JSON, MediaType.APPLICATION_JSON_UTF8));
                
                // 빈 요청 바디 (필요한 경우 파라미터 추가 가능)
                HttpEntity<String> entity = new HttpEntity<>(headers);
                
                ResponseEntity<String> response = restTemplate.exchange(
                    aiServiceUrl,
                    HttpMethod.POST,
                    entity,
                    String.class
                );
                
                if (response.getStatusCode().is2xxSuccessful()) {
                    return "임베딩 업데이트가 성공적으로 완료되었습니다.\n" + response.getBody();
                } else {
                    log.error("임베딩 업데이트 실패. 상태 코드: {}", response.getStatusCode());
                    return "임베딩 업데이트에 실패했습니다. 상태 코드: " + response.getStatusCode() + "\n" + response.getBody();
                }
                
            } catch (Exception e) {
                log.error("AI 서비스 임베딩 업데이트 요청 중 오류 발생", e);
                return "AI 서비스 임베딩 업데이트 요청 중 오류가 발생했습니다: " + e.getMessage();
            }
        });
    }
    
    /**
     * 임베딩 업데이트 상태 확인
     */
    public boolean isEmbeddingUpdateInProgress() {
        // 간단한 구현: 실제로는 더 정교한 상태 관리가 필요할 수 있음
        return false;
    }
}
