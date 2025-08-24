package com.my.backend.storeai.service;

import com.my.backend.pet.entity.MyPet;
import com.my.backend.pet.service.MyPetService;
import com.my.backend.pet.dto.MyPetListResponseDto;
import com.my.backend.store.entity.Product;
import com.my.backend.store.entity.Category;
import com.my.backend.store.service.ProductService;
import com.my.backend.store.service.NaverShoppingService;
import com.my.backend.store.dto.NaverProductDto;
import com.my.backend.store.dto.NaverShoppingSearchRequestDto;
import com.my.backend.store.entity.ProductSource;
import com.my.backend.store.entity.NaverProduct;
import com.my.backend.store.repository.NaverProductRepository;
import com.my.backend.storeai.dto.ProductRecommendationResponseDto;
import com.my.backend.storeai.enums.RecommendationType;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class StoreAiService {
    
    private final ProductService productService;
    private final MyPetService myPetService;
    private final NaverShoppingService naverShoppingService;
    private final NaverProductRepository naverProductRepository;
    private final RestTemplate restTemplate;
    
    // 1. 상품 상세페이지용 추천
    public List<ProductRecommendationResponseDto> getProductRecommendations(
        Long productId, Long accountId, Long myPetId, RecommendationType type) {
        
        log.info("상품 추천 요청 - productId: {}, accountId: {}, myPetId: {}, type: {}", 
                productId, accountId, myPetId, type);
        
        // 1) 현재 상품 정보 조회 (productId가 null이면 null)
        Product currentProduct = null;
        if (productId != null) {
            try {
                currentProduct = productService.getProduct(productId);
                log.info("현재 상품 조회 성공: {}", currentProduct != null ? currentProduct.getName() : "null");
            } catch (Exception e) {
                log.error("상품 조회 실패: {}", e.getMessage());
            }
        }
        
        // 2) 사용자 펫 정보 조회
        MyPetListResponseDto myPetsResponse = null;
        List<MyPet> userPets = new ArrayList<>();
        MyPet selectedPet = null;
        
        try {
            myPetsResponse = myPetService.getMyPets(accountId);
            log.info("펫 정보 조회 성공 - 펫 개수: {}", myPetsResponse.getMyPets().size());
            
            userPets = myPetsResponse.getMyPets().stream()
                .map(dto -> MyPet.builder()
                    .myPetId(dto.getMyPetId())
                    .name(dto.getName())
                    .breed(dto.getBreed())
                    .age(dto.getAge())
                    .type(dto.getType())
                    .build())
                .collect(Collectors.toList());
            
            selectedPet = getSelectedPet(userPets, myPetId);
            log.info("선택된 펫: {}", selectedPet != null ? 
                    String.format("ID=%d, 이름=%s, 품종=%s, 나이=%d", 
                    selectedPet.getMyPetId(), selectedPet.getName(), selectedPet.getBreed(), selectedPet.getAge()) : "null");
            
        } catch (Exception e) {
            log.error("펫 정보 조회 실패: {}", e.getMessage());
        }
        
        // 3) AI 추천 시스템 호출
        String aiRecommendation = callAiRecommendationService(currentProduct, selectedPet, type);
        
        // 4) 추천 상품 목록 생성
        List<Product> recommendedProducts = generateRecommendations(currentProduct, selectedPet, type, aiRecommendation);
        
        return buildRecommendationResponses(recommendedProducts, selectedPet, aiRecommendation, type);
    }
    
    // 2. 사용자 펫 기반 전체 추천
    public Map<String, List<ProductRecommendationResponseDto>> getMyPetsRecommendations(Long accountId) {
        MyPetListResponseDto myPetsResponse = myPetService.getMyPets(accountId);
        List<MyPet> userPets = myPetsResponse.getMyPets().stream()
            .map(dto -> {
                MyPet pet = new MyPet();
                pet.setMyPetId(dto.getMyPetId());
                pet.setName(dto.getName());
                pet.setBreed(dto.getBreed());
                pet.setAge(dto.getAge());
                pet.setType(dto.getType());
                return pet;
            })
            .collect(Collectors.toList());
        Map<String, List<ProductRecommendationResponseDto>> result = new HashMap<>();
        
        for (MyPet pet : userPets) {
            List<ProductRecommendationResponseDto> petRecommendations = 
                getPetSpecificRecommendations(pet, RecommendationType.BREED_SPECIFIC);
            result.put(pet.getName(), petRecommendations);
        }
        
        return result;
    }
    
    // 3. 타입별 추천
    public List<ProductRecommendationResponseDto> getRecommendationsByType(Long accountId, RecommendationType type) {
        MyPetListResponseDto myPetsResponse = myPetService.getMyPets(accountId);
        List<MyPet> userPets = myPetsResponse.getMyPets().stream()
            .map(dto -> {
                MyPet pet = new MyPet();
                pet.setMyPetId(dto.getMyPetId());
                pet.setName(dto.getName());
                pet.setBreed(dto.getBreed());
                pet.setAge(dto.getAge());
                pet.setType(dto.getType());
                return pet;
            })
            .collect(Collectors.toList());
        List<ProductRecommendationResponseDto> allRecommendations = new ArrayList<>();
        
        for (MyPet pet : userPets) {
            List<ProductRecommendationResponseDto> petRecommendations = getPetSpecificRecommendations(pet, type);
            allRecommendations.addAll(petRecommendations);
        }
        
        return allRecommendations.stream()
            .sorted((p1, p2) -> Double.compare(p2.getMatchScore(), p1.getMatchScore()))
            .limit(10)
            .collect(Collectors.toList());
    }
    
    // 4. AI 서버 호출
    private String callAiRecommendationService(Product product, MyPet pet, RecommendationType type) {
        String aiServerUrl = "http://ai:9000/storeai/recommend";
        
        Map<String, Object> requestData = new HashMap<>();
        
        // 펫 정보가 없으면 AI 서버 호출을 건너뛰고 기본 메시지 반환
        if (pet == null) {
            log.warn("펫 정보가 없어 AI 서버 호출을 건너뜁니다.");
            return "펫 정보를 등록하면 더 정확한 추천을 받을 수 있습니다.";
        }
        
        // AI 서버에서 필수 파라미터로 요구하는 age와 breed에 기본값 제공
        requestData.put("age", pet.getAge() != null ? pet.getAge() : 3); // 기본 나이 3살
        requestData.put("breed", pet.getBreed() != null && !pet.getBreed().trim().isEmpty() ? pet.getBreed() : "믹스견"); // 기본 품종 믹스견
        requestData.put("petType", pet.getType() != null ? pet.getType().toLowerCase() : "dog");
        requestData.put("productCategory", product != null ? product.getCategory().toString() : null);
        requestData.put("productName", product != null ? product.getName() : null);
        requestData.put("recommendationType", type.toString());
        
        log.info("AI 서버 호출 요청 데이터: {}", requestData);
        
        try {
            log.info("AI 서버 호출 시작: {}", aiServerUrl);
            ResponseEntity<String> response = restTemplate.postForEntity(aiServerUrl, requestData, String.class);
            log.info("AI 서버 응답 상태: {}, 응답: {}", response.getStatusCode(), response.getBody());
            return response.getBody();
        } catch (Exception e) {
            log.error("AI 서버 호출 실패: {}", e.getMessage(), e);
            // AI 서버 호출 실패 시에도 기본 추천은 계속 진행
            return "AI 추천을 생성할 수 없습니다.";
        }
    }
    
    // 5. 추천 상품 생성 (네이버 상품만 추천)
    private List<Product> generateRecommendations(Product currentProduct, MyPet pet, 
                                                RecommendationType type, String aiSuggestion) {
        // 네이버 API 상품만 가져오기 (멍토리 상품은 제외)
        List<Product> recommendations = getNaverProducts(pet, type);
        
        // 네이버 상품이 없으면 빈 리스트 반환
        if (recommendations.isEmpty()) {
            log.warn("네이버 상품을 찾을 수 없습니다.");
            return new ArrayList<>();
        }
        
        return filterAndSortByAiSuggestion(recommendations, aiSuggestion, pet);
    }
    
    // 6. 보완재 상품 찾기
    private List<Product> findComplementaryProducts(Product currentProduct) {
        List<Product> complementary = new ArrayList<>();
        
        switch (currentProduct.getCategory()) {
            case 사료:
                complementary.addAll(productService.findByCategory(Category.간식));
                complementary.addAll(productService.findByCategory(Category.건강관리));
                break;
            case 간식:
                complementary.addAll(productService.findByCategory(Category.장난감));
                complementary.addAll(productService.findByCategory(Category.용품));
                break;
            case 장난감:
                complementary.addAll(productService.findByCategory(Category.간식));
                break;
        }
        
        return complementary;
    }
    
    // 7. 품종별 특화 상품 찾기
    private List<Product> findBreedSpecificProducts(MyPet pet) {
        if (pet == null) return productService.getAllProducts();
        
        List<Product> breedSpecific = new ArrayList<>();
        
        // 품종별 특화 상품 검색
        if (pet.getBreed().contains("푸들")) {
            breedSpecific.addAll(productService.findByNameContaining("푸들"));
            breedSpecific.addAll(productService.findByCategory(Category.용품));
        } else if (pet.getBreed().contains("골든리트리버")) {
            breedSpecific.addAll(productService.findByNameContaining("골든"));
            breedSpecific.addAll(productService.findByCategory(Category.사료));
        } else {
            // 특정 품종이 없으면 전체 상품에서 추천
            breedSpecific.addAll(productService.getAllProducts());
        }
        
        return breedSpecific;
    }
    
    // 8. 나이별 특화 상품 찾기
    private List<Product> findAgeSpecificProducts(MyPet pet) {
        if (pet == null) return productService.getAllProducts();
        
        List<Product> ageSpecific = new ArrayList<>();
        
        if (pet.getAge() <= 1) {
            // 유아용
            ageSpecific.addAll(productService.findByNameContaining("유아"));
            ageSpecific.addAll(productService.findByNameContaining("퍼피"));
        } else if (pet.getAge() <= 3) {
            // 성장기
            ageSpecific.addAll(productService.findByNameContaining("성장"));
        } else if (pet.getAge() >= 7) {
            // 시니어
            ageSpecific.addAll(productService.findByNameContaining("시니어"));
        }
        
        // 나이별 특화 상품이 없으면 전체 상품에서 추천
        if (ageSpecific.isEmpty()) {
            ageSpecific.addAll(productService.getAllProducts());
        }
        
        return ageSpecific;
    }
    
    // 9. 계절별 상품 찾기
    private List<Product> findSeasonalProducts(Product currentProduct) {
        List<Product> seasonal = new ArrayList<>();
        int currentMonth = LocalDate.now().getMonthValue();
        
        if (currentMonth >= 6 && currentMonth <= 8) {
            // 여름
            seasonal.addAll(productService.findByNameContaining("쿨"));
            seasonal.addAll(productService.findByNameContaining("시원"));
        } else if (currentMonth >= 12 || currentMonth <= 2) {
            // 겨울
            seasonal.addAll(productService.findByNameContaining("보온"));
            seasonal.addAll(productService.findByNameContaining("따뜻"));
        }
        
        // 계절별 상품이 없으면 전체 상품에서 추천
        if (seasonal.isEmpty()) {
            seasonal = productService.getAllProducts();
        }
        
        return seasonal;
    }
    
    // 10. AI 제안을 바탕으로 필터링 및 정렬
    private List<Product> filterAndSortByAiSuggestion(List<Product> products, String aiSuggestion, MyPet pet) {
        List<Product> filteredProducts = products.stream()
            .filter(product -> isRelevantProduct(product, aiSuggestion, pet))
            .sorted((p1, p2) -> Double.compare(calculateMatchScore(p2, pet), calculateMatchScore(p1, pet)))
            .limit(5)
            .collect(Collectors.toList());
        
        // AI 서버 호출 실패 시에도 상품 반환
        if (filteredProducts.isEmpty() && !products.isEmpty()) {
            filteredProducts = products.stream()
                .sorted((p1, p2) -> Double.compare(calculateMatchScore(p2, pet), calculateMatchScore(p1, pet)))
                .limit(5)
                .collect(Collectors.toList());
        }
        
        return filteredProducts;
    }
    
    // 11. 관련 상품인지 확인
    private boolean isRelevantProduct(Product product, String aiSuggestion, MyPet pet) {
        if (aiSuggestion == null) return true;
        
        String suggestion = aiSuggestion.toLowerCase();
        String productName = product.getName().toLowerCase();
        String productDesc = product.getDescription().toLowerCase();
        
        return suggestion.contains(productName) || 
               productName.contains(suggestion) ||
               productDesc.contains(suggestion);
    }
    
    // 12. 매칭 점수 계산
    private double calculateMatchScore(Product product, MyPet pet) {
        if (pet == null) return 0.5;
        
        double score = 0.5; // 기본 점수
        
        // 품종 매칭
        if (product.getName().contains(pet.getBreed())) {
            score += 0.3;
        }
        
        // 나이 매칭
        if (pet.getAge() <= 1 && product.getName().contains("유아")) {
            score += 0.2;
        } else if (pet.getAge() >= 7 && product.getName().contains("시니어")) {
            score += 0.2;
        }
        
        return Math.min(score, 1.0);
    }
    
    // 13. 선택된 펫 가져오기
    private MyPet getSelectedPet(List<MyPet> userPets, Long myPetId) {
        if (myPetId != null) {
            return userPets.stream()
                .filter(pet -> pet.getMyPetId().equals(myPetId))
                .findFirst()
                .orElse(userPets.isEmpty() ? null : userPets.get(0));
        }
        return userPets.isEmpty() ? null : userPets.get(0);
    }
    
    // 14. 펫별 특정 추천
    private List<ProductRecommendationResponseDto> getPetSpecificRecommendations(MyPet pet, RecommendationType type) {
        List<Product> products = generateRecommendations(null, pet, type, null);
        return buildRecommendationResponses(products, pet, null, type);
    }
    
    // 15. 추천 응답 생성
    private List<ProductRecommendationResponseDto> buildRecommendationResponses(
        List<Product> products, MyPet pet, String aiSuggestion, RecommendationType type) {
        
        return products.stream()
            .map(product -> {
                // 네이버 상품의 경우 externalProductId를 productId로 사용
                Long productId = product.getSource() == ProductSource.NAVER && product.getExternalProductId() != null
                    ? Long.parseLong(product.getExternalProductId())
                    : product.getId();
                
                return ProductRecommendationResponseDto.builder()
                    .productId(productId)
                    .name(product.getName())
                    .description(product.getDescription())
                    .price(product.getPrice())
                    .imageUrl(product.getImageUrl())
                    .category(product.getCategory())
                    .source(product.getSource())
                    .externalProductUrl(product.getExternalProductUrl())
                    .externalMallName(product.getExternalMallName())
                    .recommendationReason(generateRecommendationReason(product, pet, type))
                    .aiExplanation(aiSuggestion)
                    .matchScore(calculateMatchScore(product, pet))
                    .recommendationType(type)
                    .isAiGenerated(true)
                    .myPetId(pet != null ? pet.getMyPetId() : null)
                    .petName(pet != null ? pet.getName() : null)
                    .petBreed(pet != null ? pet.getBreed() : null)
                    .petAge(pet != null ? pet.getAge() : null)
                    .build();
            })
            .collect(Collectors.toList());
    }
    
    // 16. 네이버 API 상품 가져오기 (다양한 키워드로 검색)
    private List<Product> getNaverProducts(MyPet pet, RecommendationType type) {
        List<Product> naverProducts = new ArrayList<>();
        
        try {
            // 여러 키워드로 검색하여 다양한 상품 가져오기
            List<String> searchKeywords = generateMultipleSearchKeywords(pet, type);
            
            for (String searchKeyword : searchKeywords) {
                try {
                    // 네이버 쇼핑 API로 상품 검색
                    var searchRequest = NaverShoppingSearchRequestDto.builder()
                        .query(searchKeyword)
                        .display(5) // 각 키워드당 5개씩
                        .start(1)
                        .sort("sim")
                        .build();
                    
                    var naverResponse = naverShoppingService.searchProducts(searchRequest);
                    
                    if (naverResponse != null && naverResponse.getItems() != null) {
                        // 네이버 상품을 Product 엔티티로 변환하고 DB에 저장
                        for (var item : naverResponse.getItems()) {
                            // 중복 상품 체크
                            boolean isDuplicate = naverProducts.stream()
                                .anyMatch(p -> p.getExternalProductId() != null && 
                                             p.getExternalProductId().equals(item.getProductId()));
                            
                            if (!isDuplicate) {
                                // 먼저 네이버 상품을 DB에 저장
                                NaverProduct savedNaverProduct = saveNaverProductToDb(item);
                                
                                // Product 엔티티로 변환
                                Product product = Product.builder()
                                    .name(item.getTitle())
                                    .description(item.getTitle())
                                    .price(parsePrice(item.getLprice()))
                                    .imageUrl(item.getImage())
                                    .category(Category.용품) // 기본값
                                    .source(ProductSource.NAVER)
                                    .externalProductId(item.getProductId()) // 네이버 상품 ID를 externalProductId로 저장
                                    .externalProductUrl(item.getLink())
                                    .externalMallName(item.getMallName())
                                    .build();
                                naverProducts.add(product);
                            }
                        }
                    }
                } catch (Exception e) {
                    log.error("키워드 '{}'로 네이버 API 검색 실패: {}", searchKeyword, e.getMessage());
                }
            }
        } catch (Exception e) {
            log.error("네이버 API 상품 가져오기 실패: {}", e.getMessage());
        }
        
        return naverProducts;
    }
    
    // 17. 여러 검색 키워드 생성 (네이버 상품 다양성 확보)
    private List<String> generateMultipleSearchKeywords(MyPet pet, RecommendationType type) {
        List<String> keywords = new ArrayList<>();
        
        if (pet == null) {
            // 펫 정보가 없으면 기본 키워드들
            keywords.add("반려동물 용품");
            keywords.add("강아지 간식");
            keywords.add("고양이 사료");
            keywords.add("반려동물 장난감");
            keywords.add("강아지 의류");
            return keywords;
        }
        
        // 펫 타입에 따른 기본 키워드
        String petType = pet.getType() != null ? pet.getType().toLowerCase() : "dog";
        String petTypeKorean = petType.equals("dog") ? "강아지" : "고양이";
        
        // 품종별 키워드
        if (pet.getBreed() != null && !pet.getBreed().trim().isEmpty()) {
            keywords.add(pet.getBreed() + " " + petTypeKorean + " 용품");
            keywords.add(pet.getBreed() + " " + petTypeKorean + " 간식");
            keywords.add(pet.getBreed() + " " + petTypeKorean + " 사료");
        }
        
        // 나이별 키워드
        if (pet.getAge() != null) {
            if (pet.getAge() <= 1) {
                keywords.add("유아용 " + petTypeKorean + " 사료");
                keywords.add("퍼피 " + petTypeKorean + " 용품");
            } else if (pet.getAge() >= 7) {
                keywords.add("시니어 " + petTypeKorean + " 사료");
                keywords.add("시니어 " + petTypeKorean + " 건강관리");
            }
        }
        
        // 계절별 키워드
        int currentMonth = LocalDate.now().getMonthValue();
        if (currentMonth >= 6 && currentMonth <= 8) {
            keywords.add("여름 " + petTypeKorean + " 용품");
            keywords.add("쿨링 " + petTypeKorean + " 매트");
        } else if (currentMonth >= 12 || currentMonth <= 2) {
            keywords.add("겨울 " + petTypeKorean + " 의류");
            keywords.add("보온 " + petTypeKorean + " 매트");
        }
        
        // 추천 타입별 키워드
        switch (type) {
            case BREED_SPECIFIC:
                if (pet.getBreed() != null) {
                    keywords.add(pet.getBreed() + " 전용 " + petTypeKorean + " 용품");
                }
                break;
            case AGE_SPECIFIC:
                if (pet.getAge() != null) {
                    if (pet.getAge() <= 1) {
                        keywords.add("유아용 " + petTypeKorean + " 장난감");
                    } else if (pet.getAge() >= 7) {
                        keywords.add("시니어 " + petTypeKorean + " 영양제");
                    }
                }
                break;
            case SEASONAL:
                if (currentMonth >= 6 && currentMonth <= 8) {
                    keywords.add("여름 " + petTypeKorean + " 쿨링");
                } else if (currentMonth >= 12 || currentMonth <= 2) {
                    keywords.add("겨울 " + petTypeKorean + " 보온");
                }
                break;
        }
        
        // 기본 카테고리 키워드들 추가
        String[] categories = {"용품", "의류", "건강관리", "사료", "간식", "장난감", "영양제"};
        for (String category : categories) {
            keywords.add(petTypeKorean + " " + category);
        }
        
        // 중복 제거 및 최대 8개 키워드로 제한
        return keywords.stream()
            .distinct()
            .limit(8)
            .collect(Collectors.toList());
    }
    
    // 18. 단일 검색 키워드 생성 (기존 메서드 유지)
    private String generateSearchKeyword(MyPet pet, RecommendationType type) {
        if (pet == null) {
            return "반려동물 용품";
        }
        
        StringBuilder keyword = new StringBuilder();
        
        switch (type) {
            case BREED_SPECIFIC:
                keyword.append(pet.getBreed()).append(" ");
                break;
            case AGE_SPECIFIC:
                if (pet.getAge() <= 1) {
                    keyword.append("유아용 ");
                } else if (pet.getAge() >= 7) {
                    keyword.append("시니어 ");
                }
                break;
            case SEASONAL:
                int currentMonth = LocalDate.now().getMonthValue();
                if (currentMonth >= 6 && currentMonth <= 8) {
                    keyword.append("여름 ");
                } else if (currentMonth >= 12 || currentMonth <= 2) {
                    keyword.append("겨울 ");
                }
                break;
        }
        
        // 다양한 카테고리 키워드 추가
        String[] categories = {"용품", "의류", "건강관리", "사료", "간식", "장난감"};
        String randomCategory = categories[(int) (Math.random() * categories.length)];
        keyword.append("반려동물 ").append(randomCategory);
        
        return keyword.toString();
    }
    
    // 19. 네이버 상품을 DB에 저장
    private NaverProduct saveNaverProductToDb(com.my.backend.store.dto.NaverShoppingItemDto item) {
        try {
            // 이미 존재하는지 확인
            Optional<NaverProduct> existingProduct = naverProductRepository.findByProductId(item.getProductId());
            
            if (existingProduct.isPresent()) {
                log.info("네이버 상품이 이미 DB에 존재합니다: {}", item.getProductId());
                return existingProduct.get();
            }
            
            // 새 네이버 상품 생성
            NaverProduct naverProduct = NaverProduct.builder()
                // id는 자동 생성되므로 설정하지 않음
                .productId(item.getProductId())
                .title(item.getTitle())
                .description(item.getTitle())
                .price(parsePrice(item.getLprice()))
                .imageUrl(item.getImage())
                .mallName(item.getMallName())
                .productUrl(item.getLink())
                .brand(item.getBrand() != null ? item.getBrand() : "")
                .maker(item.getMaker() != null ? item.getMaker() : "")
                .category1(item.getCategory1() != null ? item.getCategory1() : "")
                .category2(item.getCategory2() != null ? item.getCategory2() : "")
                .category3(item.getCategory3() != null ? item.getCategory3() : "")
                .category4(item.getCategory4() != null ? item.getCategory4() : "")
                .reviewCount(parseInteger(item.getReviewCount()))
                .rating(parseDouble(item.getRating()))
                .searchCount(parseInteger(item.getSearchCount()))
                .build();
            
            NaverProduct savedProduct = naverProductRepository.save(naverProduct);
            log.info("네이버 상품을 DB에 저장했습니다: {}", savedProduct.getProductId());
            return savedProduct;
            
        } catch (Exception e) {
            log.error("네이버 상품 DB 저장 실패: {}", e.getMessage());
            // 저장 실패해도 Product 엔티티는 생성할 수 있도록 null 반환
            return null;
        }
    }
    
    // 20. 가격 파싱
    private Long parsePrice(String priceStr) {
        try {
            return Long.parseLong(priceStr.replaceAll("[^0-9]", ""));
        } catch (Exception e) {
            return 0L;
        }
    }
    
    // 21. 정수 파싱
    private Integer parseInteger(String str) {
        try {
            return Integer.parseInt(str.replaceAll("[^0-9]", ""));
        } catch (Exception e) {
            return 0;
        }
    }
    
    // 22. 실수 파싱
    private Double parseDouble(String str) {
        try {
            return Double.parseDouble(str);
        } catch (Exception e) {
            return 0.0;
        }
    }
    
    // 23. 추천 이유 생성
    private String generateRecommendationReason(Product product, MyPet pet, RecommendationType type) {
        if (pet == null) {
            return product.getName() + "과 관련된 상품입니다.";
        }
        
        switch (type) {
            case SIMILAR:
                return pet.getName() + "에게 유사한 " + product.getCategory() + "입니다.";
            case COMPLEMENTARY:
                return pet.getName() + "에게 보완해주는 " + product.getCategory() + "입니다.";
            case BREED_SPECIFIC:
                return pet.getBreed() + "에게 특화된 상품입니다.";
            case AGE_SPECIFIC:
                return pet.getAge() + "살 " + pet.getName() + "에게 적합한 상품입니다.";
            case SEASONAL:
                return "현재 계절에 맞는 상품입니다.";
            default:
                return pet.getName() + "에게 추천하는 상품입니다.";
        }
    }
}
