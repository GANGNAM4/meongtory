package com.my.backend.store.controller;

import com.my.backend.store.dto.SearchRequestDto;
import com.my.backend.store.dto.SearchResponseDto;
import com.my.backend.store.service.SearchService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.beans.factory.annotation.Value;

import java.util.List;
import java.util.Map;
import java.util.HashMap;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
@Slf4j
@CrossOrigin(origins = "*")
public class SearchController {

    private final SearchService searchService;
    
    @Value("${ai.service.url:http://ai:8000}")
    private String aiServiceUrl;
    
    @Value("${internal.api.key:default-internal-key}")
    private String internalApiKey;

    /**
     * 임베딩 기반 상품 검색
     * GET /api/search?query=검색어&limit=10
     */
    @GetMapping
    public ResponseEntity<List<SearchResponseDto>> searchProducts(
            @RequestParam String query,
            @RequestParam(required = false, defaultValue = "10") Integer limit) {
        
        try {
            log.info("=== 임베딩 기반 유사도 검색 요청 시작 ===");
            log.info("검색어: '{}'", query);
            log.info("제한 개수: {}", limit);
            log.info("검색 방식: 임베딩 기반 유사도 검색 (AI 기반)");
            log.info("엔드포인트: /api/search");
            
            SearchRequestDto searchRequest = new SearchRequestDto();
            searchRequest.setQuery(query);
            searchRequest.setLimit(limit);
            
            log.info("SearchRequestDto 생성 완료: {}", searchRequest);
            
            List<SearchResponseDto> results = searchService.searchByEmbedding(searchRequest);
            
            log.info("임베딩 기반 유사도 검색 결과 개수: {}", results.size());
            log.info("=== 임베딩 기반 유사도 검색 요청 완료 ===");
            
            return ResponseEntity.ok(results);
            
        } catch (IllegalArgumentException e) {
            log.warn("임베딩 기반 유사도 검색 요청 오류: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
            
        } catch (Exception e) {
            log.error("임베딩 기반 유사도 검색 중 오류 발생: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * POST 방식으로 검색 (더 복잡한 검색 조건을 위해)
     * POST /api/search
     */
    @PostMapping
    public ResponseEntity<List<SearchResponseDto>> searchProductsPost(@RequestBody SearchRequestDto searchRequest) {
        try {
            log.info("POST 검색 요청: query='{}', limit={}", 
                    searchRequest.getQuery(), searchRequest.getLimit());
            
            List<SearchResponseDto> results = searchService.searchByEmbedding(searchRequest);
            
            return ResponseEntity.ok(results);
            
        } catch (IllegalArgumentException e) {
            log.warn("POST 검색 요청 오류: {}", e.getMessage());
            return ResponseEntity.badRequest().build();
            
        } catch (Exception e) {
            log.error("POST 검색 중 오류 발생: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * MyPet 태깅 기반 AI 서비스 검색
     * POST /api/search/mypet
     */
    @PostMapping("/mypet")
    public ResponseEntity<Map<String, Object>> searchWithMyPet(@RequestBody Map<String, Object> request) {
        try {
            String query = (String) request.get("query");
            Integer petId = (Integer) request.get("petId");
            Integer limit = (Integer) request.get("limit");
            
            log.info("MyPet 태깅 검색 요청: query='{}', petId={}, limit={}", query, petId, limit);
            
            // AI 서비스 호출
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            headers.set("X-Internal-Key", internalApiKey);
            
            Map<String, Object> aiRequest = new HashMap<>();
            aiRequest.put("query", query);
            aiRequest.put("petId", petId);
            aiRequest.put("limit", limit);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(aiRequest, headers);
            
            String aiEndpoint = aiServiceUrl + "/search/mypet";
            log.info("AI 서비스 호출: {}", aiEndpoint);
            
            Map<String, Object> aiResponse = restTemplate.postForObject(aiEndpoint, entity, Map.class);
            
            if (aiResponse != null) {
                log.info("AI 서비스 응답 성공: {}개 결과", 
                    aiResponse.get("data") != null ? ((List<?>) aiResponse.get("data")).size() : 0);
                
                Map<String, Object> response = new HashMap<>();
                response.put("success", true);
                response.put("data", aiResponse.get("data"));
                response.put("message", "MyPet 태깅 검색 완료");
                
                return ResponseEntity.ok(response);
            } else {
                log.warn("AI 서비스 응답이 null");
                Map<String, Object> response = new HashMap<>();
                response.put("success", false);
                response.put("message", "AI 서비스 응답 없음");
                return ResponseEntity.ok(response);
            }
            
        } catch (Exception e) {
            log.error("MyPet 태깅 검색 중 오류 발생: {}", e.getMessage(), e);
            
            Map<String, Object> response = new HashMap<>();
            response.put("success", false);
            response.put("message", "검색 중 오류 발생: " + e.getMessage());
            return ResponseEntity.ok(response);
        }
    }
}
