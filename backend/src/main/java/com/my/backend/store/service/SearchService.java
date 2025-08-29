package com.my.backend.store.service;

import com.my.backend.store.dto.SearchRequestDto;
import com.my.backend.store.dto.SearchResponseDto;
import com.my.backend.store.entity.NaverProduct;
import com.my.backend.store.repository.NaverProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
@RequiredArgsConstructor
@Slf4j
public class SearchService {

    private final NaverProductRepository naverProductRepository;

    /**
     * 검색어 전처리
     * @param query 원본 검색어
     * @return 전처리된 검색어
     */
    private String preprocessQuery(String query) {
        if (query == null) {
            return "";
        }
        
        // 1. 공백 제거 및 정규화
        String processedQuery = query.trim();
        
        // 2. 특수문자 제거 (한글, 영문, 숫자, 공백만 허용)
        processedQuery = processedQuery.replaceAll("[^\\w\\s가-힣]", "");
        
        // 3. 연속된 공백을 하나로 변환
        processedQuery = processedQuery.replaceAll("\\s+", " ");
        
        // 4. 너무 짧은 단어 필터링 (2글자 미만 제거)
        String[] words = processedQuery.split(" ");
        StringBuilder filteredQuery = new StringBuilder();
        
        for (String word : words) {
            if (word.length() >= 2) {
                if (filteredQuery.length() > 0) {
                    filteredQuery.append(" ");
                }
                filteredQuery.append(word);
            }
        }
        
        // 5. 결과가 비어있으면 원본 반환 (최소 2글자)
        if (filteredQuery.length() == 0 && processedQuery.length() >= 2) {
            return processedQuery;
        }
        
        return filteredQuery.toString();
    }

    /**
     * 검색어를 임베딩으로 변환하여 유사한 상품들을 검색
     * @param searchRequest 검색 요청
     * @return 검색 결과 리스트
     */
    public List<SearchResponseDto> searchByEmbedding(SearchRequestDto searchRequest) {
        try {
            log.info("=== SearchService.searchByEmbedding 시작 (임베딩 기반 유사도 검색) ===");
            
            String query = searchRequest.getQuery();
            int limit = searchRequest.getLimit() != null ? searchRequest.getLimit() : 10;
            
            // 검색어 전처리
            query = preprocessQuery(query);
            
            log.info("원본 검색어: '{}'", searchRequest.getQuery());
            log.info("전처리된 검색어: '{}'", query);
            log.info("제한 개수: {}", limit);
            log.info("검색 방식: 임베딩 기반 유사도 검색 (AI 기반)");
            
            if (query == null || query.trim().isEmpty() || query.trim().length() < 2) {
                log.error("검색어가 비어있거나 너무 짧습니다.");
                throw new IllegalArgumentException("검색어가 비어있거나 너무 짧습니다. (최소 2글자 필요)");
            }
            
            log.info("AI 서비스 임베딩 검색 API 호출 시작: '{}', limit: {}", query, limit);
            
            // AI 서비스의 임베딩 검색 API 호출
            List<SearchResponseDto> results = callAIServiceEmbeddingSearch(query, limit);
            
            log.info("AI 서비스 임베딩 검색 완료: {}개 결과", results.size());
            log.info("=== SearchService.searchByEmbedding 완료 (임베딩 기반 유사도 검색) ===");
            
            return results;
            
        } catch (Exception e) {
            log.error("임베딩 기반 유사도 검색 실패: {}", e.getMessage(), e);
            throw new RuntimeException("임베딩 기반 유사도 검색 중 오류가 발생했습니다: " + e.getMessage());
        }
    }
    
    /**
     * AI 서비스의 임베딩 검색 API 호출
     */
    private List<SearchResponseDto> callAIServiceEmbeddingSearch(String query, int limit) {
        try {
            String aiServiceUrl = "http://ai:9000/search-embeddings";
            
            log.info("=== AI 서비스 임베딩 검색 호출 시작 ===");
            log.info("AI 서비스 URL: {}", aiServiceUrl);
            log.info("검색어: {}", query);
            log.info("제한 개수: {}", limit);
            
            // 요청 데이터 생성
            Map<String, Object> requestData = new HashMap<>();
            requestData.put("query", query);
            requestData.put("limit", limit);
            
            log.info("AI 서비스 요청 데이터: {}", requestData);
            
            // ObjectMapper를 사용하여 JSON 직렬화 확인
            ObjectMapper objectMapper = new ObjectMapper();
            String jsonRequest = objectMapper.writeValueAsString(requestData);
            log.info("JSON 직렬화된 요청 데이터: {}", jsonRequest);
            
            // RestTemplate을 사용하여 AI 서비스 호출
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestData, headers);
            
            log.info("AI 서비스 호출 시작...");
            
            ResponseEntity<Map> response = restTemplate.postForEntity(aiServiceUrl, entity, Map.class);
            
            log.info("AI 서비스 응답 상태 코드: {}", response.getStatusCode());
            log.info("AI 서비스 응답 바디: {}", response.getBody());
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> responseBody = response.getBody();
                Boolean success = (Boolean) responseBody.get("success");
                
                if (success != null && success) {
                    List<Map<String, Object>> results = (List<Map<String, Object>>) responseBody.get("results");
                    log.info("AI 서비스 응답 성공: {}개 결과", results != null ? results.size() : 0);
                    
                    // AI 서비스 응답을 SearchResponseDto로 변환
                    return convertAIServiceResponseToSearchResponseDto(results);
                } else {
                    log.warn("AI 서비스 응답 실패: {}", responseBody.get("message"));
                    return new ArrayList<>();
                }
            } else {
                log.error("AI 서비스 호출 실패: 상태 코드 {}", response.getStatusCode());
                return new ArrayList<>();
            }
            
        } catch (Exception e) {
            log.error("AI 서비스 임베딩 검색 API 호출 실패: {}", e.getMessage(), e);
            log.error("스택 트레이스: ", e);
            return new ArrayList<>();
        }
    }
    
    /**
     * AI 서비스 응답을 SearchResponseDto로 변환
     */
    private List<SearchResponseDto> convertAIServiceResponseToSearchResponseDto(List<Map<String, Object>> aiResults) {
        List<SearchResponseDto> results = new ArrayList<>();
        
        if (aiResults == null) {
            return results;
        }
        
        for (Map<String, Object> aiProduct : aiResults) {
            try {
                String type = (String) aiProduct.get("type");
                String name = (String) aiProduct.get("name");
                String title = (String) aiProduct.get("title");
                
                // 네이버 상품과 일반 상품을 모두 처리
                SearchResponseDto dto = SearchResponseDto.builder()
                        .id(((Number) aiProduct.get("id")).longValue())
                        .productId(type.equals("naver") ? (String) aiProduct.get("product_id") : String.valueOf(aiProduct.get("id"))) // 네이버 상품은 AI 서비스에서 받은 product_id 사용
                        .title(title != null ? title : name) // title이 없으면 name 사용
                        .description((String) aiProduct.get("description"))
                        .price(((Number) aiProduct.get("price")).longValue())
                        .imageUrl((String) aiProduct.get("image_url"))
                        .mallName((String) aiProduct.get("seller")) // seller 필드 사용
                        .productUrl((String) aiProduct.get("product_url"))
                        .brand((String) aiProduct.get("brand"))
                        .maker((String) aiProduct.get("maker"))
                        .category1((String) aiProduct.get("category1"))
                        .category2((String) aiProduct.get("category2"))
                        .category3((String) aiProduct.get("category3"))
                        .category4((String) aiProduct.get("category4"))
                        .reviewCount(((Number) aiProduct.get("review_count")).intValue())
                        .rating(((Number) aiProduct.get("rating")).doubleValue())
                        .searchCount(((Number) aiProduct.get("search_count")).intValue())
                        .similarity(((Number) aiProduct.get("similarity")).doubleValue())
                        .build();
                
                results.add(dto);
                
            } catch (Exception e) {
                log.warn("AI 서비스 응답 변환 실패: {}", e.getMessage());
            }
        }
        
        return results;
    }

    /**
     * Object[] (상품 ID + 유사도 점수)를 SearchResponseDto로 변환
     */
    private SearchResponseDto convertToSearchResponseDtoFromId(Object[] result) {
        try {
            log.info("DTO 변환 시작: Object[] 길이 = {}", result.length);
            
            // Object[] 구조: [id, similarity]
            Long id = safeCastToLong(result[0]);
            Double distance = safeCastToDouble(result[1]); // Euclidean distance
            
            // Euclidean distance를 유사도 점수로 변환 (0~1 범위)
            // 거리가 0에 가까울수록 유사도 1, 거리가 클수록 유사도 0에 가까워짐
            Double similarity = convertDistanceToSimilarity(distance);
            
            log.info("상품 ID: {}, 원본 거리: {}, 변환된 유사도: {}", id, distance, similarity);
            
            // ID로 상품 조회
            NaverProduct product = naverProductRepository.findById(id).orElse(null);
            if (product == null) {
                log.warn("상품을 찾을 수 없습니다: id = {}", id);
                return null;
            }
            
            log.info("상품 조회 완료: {}", product.getTitle());
            
            SearchResponseDto dto = SearchResponseDto.builder()
                    .id(product.getId())
                    .productId(product.getProductId())
                    .title(product.getTitle())
                    .description(product.getDescription())
                    .price(product.getPrice())
                    .imageUrl(product.getImageUrl())
                    .mallName(product.getMallName())
                    .productUrl(product.getProductUrl())
                    .brand(product.getBrand())
                    .maker(product.getMaker())
                    .category1(product.getCategory1())
                    .category2(product.getCategory2())
                    .category3(product.getCategory3())
                    .category4(product.getCategory4())
                    .reviewCount(product.getReviewCount())
                    .rating(product.getRating())
                    .searchCount(product.getSearchCount())
                    .createdAt(product.getCreatedAt())
                    .updatedAt(product.getUpdatedAt())
                    .relatedProductId(product.getRelatedProduct() != null ? product.getRelatedProduct().getId() : null)
                    .similarity(similarity) // 변환된 유사도 점수 사용
                    .build();
            
            log.info("DTO 변환 완료: {}", dto.getTitle());
            return dto;
            
        } catch (Exception e) {
            log.error("DTO 변환 중 오류 발생: {}", e.getMessage(), e);
            return null; // 개별 상품 변환 실패 시 null 반환하여 필터링
        }
    }
    

    /**
     * Euclidean distance를 유사도 점수(0~1)로 변환
     * @param distance Euclidean distance
     * @return 유사도 점수 (0~1, 1에 가까울수록 유사)
     */
    private Double convertDistanceToSimilarity(Double distance) {
        if (distance == null) return 0.0;
        
        // 거리가 0에 가까울수록 유사도 1, 거리가 클수록 유사도 0에 가까워짐
        // 일반적으로 1536차원 벡터에서 거리 1.0 이하가 매우 유사한 것으로 간주
        // 거리 2.0 이상은 덜 유사한 것으로 간주
        
        if (distance <= 0.5) {
            // 매우 유사 (거리 0.5 이하)
            return 1.0 - (distance / 0.5) * 0.1; // 0.9 ~ 1.0
        } else if (distance <= 1.0) {
            // 유사 (거리 0.5 ~ 1.0)
            return 0.9 - ((distance - 0.5) / 0.5) * 0.3; // 0.6 ~ 0.9
        } else if (distance <= 2.0) {
            // 보통 (거리 1.0 ~ 2.0)
            return 0.6 - ((distance - 1.0) / 1.0) * 0.4; // 0.2 ~ 0.6
        } else {
            // 덜 유사 (거리 2.0 이상)
            return Math.max(0.1, 0.2 - ((distance - 2.0) / 2.0) * 0.1); // 0.1 ~ 0.2
        }
    }
    
    // 안전한 타입 변환 헬퍼 메서드들
    private Long safeCastToLong(Object obj) {
        if (obj == null) return null;
        if (obj instanceof Long) return (Long) obj;
        if (obj instanceof Double) return ((Double) obj).longValue();
        if (obj instanceof Integer) return ((Integer) obj).longValue();
        return Long.valueOf(obj.toString());
    }
    
    private String safeCastToString(Object obj) {
        return obj == null ? null : obj.toString();
    }
    
    private Integer safeCastToInteger(Object obj) {
        if (obj == null) return null;
        if (obj instanceof Integer) return (Integer) obj;
        if (obj instanceof Long) return ((Long) obj).intValue();
        if (obj instanceof Double) return ((Double) obj).intValue();
        return Integer.valueOf(obj.toString());
    }
    
    private Double safeCastToDouble(Object obj) {
        if (obj == null) return null;
        if (obj instanceof Double) return (Double) obj;
        if (obj instanceof Long) return ((Long) obj).doubleValue();
        if (obj instanceof Integer) return ((Integer) obj).doubleValue();
        return Double.valueOf(obj.toString());
    }
    
    private LocalDateTime safeCastToLocalDateTime(Object obj) {
        if (obj == null) return null;
        if (obj instanceof LocalDateTime) return (LocalDateTime) obj;
        if (obj instanceof java.sql.Timestamp) {
            return ((java.sql.Timestamp) obj).toLocalDateTime();
        }
        return LocalDateTime.parse(obj.toString());
    }
}
