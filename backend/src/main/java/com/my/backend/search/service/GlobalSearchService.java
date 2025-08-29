package com.my.backend.search.service;

import com.my.backend.pet.entity.MyPet;
import com.my.backend.pet.repository.MyPetRepository;
import com.my.backend.insurance.entity.InsuranceProduct;
import com.my.backend.insurance.repository.InsuranceProductRepository;
import com.my.backend.search.dto.PetBasedSearchDto;
import com.my.backend.search.dto.SearchRequestDto;
import com.my.backend.search.dto.SearchResponseDto;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Map;
import java.util.HashMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.HttpEntity;
import org.springframework.http.ResponseEntity;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class GlobalSearchService {

    private final MyPetRepository myPetRepository;
    private final InsuranceProductRepository insuranceProductRepository;

    /**
     * 통합 검색 수행
     */
    public SearchResponseDto performSearch(Long userId, SearchRequestDto request) {
        log.info("Performing search for user: {}, query: {}, petId: {}, type: {}", 
                userId, request.getQuery(), request.getPetId(), request.getSearchType());

        // MyPet 정보 조회
        PetBasedSearchDto petInfo = getPetInfo(userId, request.getPetId());

        // 검색 타입별 분기 처리 (AI 서비스 위임)
        List<Object> results = new ArrayList<>();
        List<Object> recommendations = new ArrayList<>();

        switch (request.getSearchType()) {
            case "store":
                results = searchStore(request.getQuery(), petInfo);
                recommendations = getStoreRecommendations(petInfo);
                break;
            case "insurance":
                results = searchInsurance(request.getQuery(), petInfo);
                recommendations = getInsuranceRecommendations(petInfo);
                break;
            default:
                log.warn("Unknown search type: {}", request.getSearchType());
                break;
        }

        return SearchResponseDto.builder()
                .results(results)
                .recommendations(recommendations)
                .petInfo(petInfo != null ? petInfo.getName() + " (" + petInfo.getBreed() + ")" : null)
                .totalCount(results.size())
                .build();
    }

    /**
     * MyPet 정보 조회
     */
    private PetBasedSearchDto getPetInfo(Long userId, Long petId) {
        if (petId == null) return null;
        
        Optional<MyPet> myPet = myPetRepository.findByMyPetIdAndOwnerId(petId, userId);
        return myPet.map(this::convertToPetSearchDto).orElse(null);
    }



    /**
     * Store 검색 - AI 서비스 호출
     */
    private List<Object> searchStore(String query, PetBasedSearchDto petInfo) {
        log.info("Searching store with query: {}, pet: {}", query, petInfo);
        
        try {
            // AI 서비스의 MyPet 태깅 검색 호출
            String aiServiceUrl = "http://ai:9000/search/mypet";
            
            // 요청 데이터 생성
            Map<String, Object> requestData = new HashMap<>();
            requestData.put("query", query);
            requestData.put("petId", petInfo.getMyPetId());
            requestData.put("limit", 20);
            
            // RestTemplate을 사용하여 AI 서비스 호출
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestData, headers);
            
            log.info("AI 서비스 호출 URL: {}", aiServiceUrl);
            log.info("AI 서비스 요청 데이터: {}", requestData);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(aiServiceUrl, entity, Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> responseBody = response.getBody();
                Boolean success = (Boolean) responseBody.get("success");
                
                if (success != null && success) {
                    List<Map<String, Object>> results = (List<Map<String, Object>>) responseBody.get("data");
                    log.info("AI 서비스 MyPet 검색 성공: {}개 결과", results != null ? results.size() : 0);
                    return new ArrayList<>(results);
                } else {
                    log.warn("AI 서비스 MyPet 검색 실패: {}", responseBody.get("message"));
                    return new ArrayList<>();
                }
            } else {
                log.error("AI 서비스 MyPet 검색 호출 실패: 상태 코드 {}", response.getStatusCode());
                return new ArrayList<>();
            }
            
        } catch (Exception e) {
            log.error("AI 서비스 MyPet 검색 중 오류: {}", e.getMessage(), e);
            return new ArrayList<>();
        }
    }

    /**
     * Store 추천 - AI 서비스 위임
     */
    private List<Object> getStoreRecommendations(PetBasedSearchDto petInfo) {
        if (petInfo == null) return new ArrayList<>();
        
        log.info("Getting store recommendations for pet: {}", petInfo);
        
        // AI 서비스의 MyPet 태깅 시스템을 사용하므로 빈 리스트 반환
        // 실제 추천은 AI 서비스(embedding_update.py)에서 수행
        log.info("Delegating store recommendations to AI service (embedding_update.py)");
        return new ArrayList<>();
    }

    /**
     * Insurance 검색 - AI 서비스에 위임
     */
    private List<Object> searchInsurance(String query, PetBasedSearchDto petInfo) {
        log.info("Searching insurance with query: {}, pet: {}", query, petInfo);
        
        try {
            // AI 서비스 호출하여 고급 필터링 수행
            RestTemplate restTemplate = new RestTemplate();
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            // AI 서비스 요청 데이터 구성
            Map<String, Object> requestData = new HashMap<>();
            requestData.put("query", query);
            if (petInfo != null) {
                requestData.put("petId", petInfo.getMyPetId());
            }
            
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestData, headers);
            
            String aiEndpoint = "http://ai:9000/chatbot/insurance";
            log.info("AI 서비스 호출: {}", aiEndpoint);
            
            ResponseEntity<Map> response = restTemplate.postForEntity(aiEndpoint, entity, Map.class);
            
            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> responseBody = response.getBody();
                String aiAnswer = (String) responseBody.get("answer");
                log.info("AI 서비스 응답: {}", aiAnswer);
                
                // AI 응답에서 추천된 보험사명 추출하여 필터링
                List<InsuranceProduct> allProducts = insuranceProductRepository.findAll();
                List<InsuranceProduct> filteredProducts = filterProductsByAIResponse(allProducts, aiAnswer);
                
                log.info("AI 필터링 결과: {}개 상품", filteredProducts.size());
                return new ArrayList<>(filteredProducts);
            } else {
                log.warn("AI 서비스 호출 실패: {}", response.getStatusCode());
                // AI 서비스 실패 시 모든 상품 반환
                List<InsuranceProduct> allProducts = insuranceProductRepository.findAll();
                return new ArrayList<>(allProducts);
            }
            
        } catch (Exception e) {
            log.error("AI 서비스 호출 중 오류: {}", e.getMessage(), e);
            // 오류 발생 시 모든 상품 반환
            List<InsuranceProduct> allProducts = insuranceProductRepository.findAll();
            return new ArrayList<>(allProducts);
        }
    }
    
    /**
     * AI 응답을 기반으로 보험 상품 필터링
     */
    private List<InsuranceProduct> filterProductsByAIResponse(List<InsuranceProduct> products, String aiAnswer) {
        if (aiAnswer == null || aiAnswer.isEmpty()) {
            return products;
        }
        
        List<InsuranceProduct> filteredProducts = new ArrayList<>();
        String answerLower = aiAnswer.toLowerCase();
        
        // AI 응답에서 언급된 보험사명 추출
        String[] mentionedCompanies = {
            "삼성화재", "NH농협", "KB손해보험", "현대해상", "메리츠화재", 
            "DB손해보험", "롯데손해보험", "한화손해보험", "흥국화재", 
            "AXA손해보험", "교보손해보험"
        };
        
        for (InsuranceProduct product : products) {
            String companyName = product.getCompany().toLowerCase();
            
            // AI 응답에서 언급된 보험사인지 확인
            for (String company : mentionedCompanies) {
                if (answerLower.contains(company.toLowerCase()) && 
                    companyName.contains(company.toLowerCase())) {
                    filteredProducts.add(product);
                    break;
                }
            }
        }
        
        // AI 응답에서 언급된 상품이 없으면 모든 상품 반환
        if (filteredProducts.isEmpty()) {
            return products;
        }
        
        return filteredProducts;
    }

    /**
     * Insurance 추천 - AI 서비스에 위임
     */
    private List<Object> getInsuranceRecommendations(PetBasedSearchDto petInfo) {
        if (petInfo == null) return new ArrayList<>();
        
        log.info("Getting insurance recommendations for pet: {}", petInfo);
        
        // AI 서비스의 고급 추천 시스템을 사용하므로 빈 리스트 반환
        // 실제 추천은 AI 서비스(insurance_rag.py)에서 수행
        log.info("Delegating insurance recommendations to AI service");
        return new ArrayList<>();
    }



    // TODO: 모든 필터링 로직은 AI 서비스로 위임
    // - 보험: insurance_rag.py
    // - 스토어: embedding_update.py

    /**
     * MyPet을 PetBasedSearchDto로 변환
     */
    private PetBasedSearchDto convertToPetSearchDto(MyPet myPet) {
        return PetBasedSearchDto.builder()
                .myPetId(myPet.getMyPetId())
                .name(myPet.getName())
                .breed(myPet.getBreed())
                .type(myPet.getType())
                .age(myPet.getAge())
                .weight(myPet.getWeight())
                .build();
    }
}