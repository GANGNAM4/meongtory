package com.my.backend.store.service;

import com.my.backend.config.NaverApiConfig;
import com.my.backend.store.dto.NaverProductDto;
import com.my.backend.store.dto.NaverShoppingItemDto;
import com.my.backend.store.dto.NaverShoppingResponseDto;
import com.my.backend.store.dto.NaverShoppingSearchRequestDto;
import com.my.backend.store.entity.NaverProduct;
import com.my.backend.store.entity.Product;
import com.my.backend.store.repository.NaverProductRepository;
import com.my.backend.store.repository.ProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.RestClientException;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class NaverShoppingService {

    private final NaverApiConfig naverApiConfig;
    private final RestTemplate naverRestTemplate;
    private final NaverProductRepository naverProductRepository;
    private final ProductRepository productRepository;

    @Value("${naver.api.shopping-url}")
    private String naverShoppingUrl;

    /**
     * 네이버 쇼핑 API에서 상품 검색
     */
    public NaverShoppingResponseDto searchProducts(NaverShoppingSearchRequestDto requestDto) {
        try {
            HttpHeaders headers = naverApiConfig.getNaverApiHeaders();
            
            URI uri = UriComponentsBuilder
                    .fromHttpUrl(naverShoppingUrl)
                    .queryParam("query", requestDto.getQuery())
                    .queryParam("display", requestDto.getDisplay())
                    .queryParam("start", requestDto.getStart())
                    .queryParam("sort", requestDto.getSort())
                    .build()
                    .encode()
                    .toUri();

            log.info("네이버 쇼핑 API 호출 URL: {}", uri);
            log.info("네이버 쇼핑 API 헤더: X-Naver-Client-Id={}, X-Naver-Client-Secret={}", 
                    headers.getFirst("X-Naver-Client-Id"), 
                    headers.getFirst("X-Naver-Client-Secret") != null ? "***" : "null");

            HttpEntity<String> entity = new HttpEntity<>(headers);
            
            ResponseEntity<NaverShoppingResponseDto> response = naverRestTemplate.exchange(
                    uri, 
                    HttpMethod.GET, 
                    entity, 
                    NaverShoppingResponseDto.class
            );

            log.info("네이버 쇼핑 API 호출 성공: {}", requestDto.getQuery());
            return response.getBody();
            
        } catch (Exception e) {
            log.error("네이버 쇼핑 API 호출 실패: {}", e.getMessage(), e);
            if (e instanceof RestClientException) {
                log.error("RestClientException 상세: {}", e.getCause() != null ? e.getCause().getMessage() : "원인 없음");
            }
            // 더 자세한 에러 정보 로깅
            if (e instanceof org.springframework.web.client.HttpClientErrorException) {
                org.springframework.web.client.HttpClientErrorException httpEx = (org.springframework.web.client.HttpClientErrorException) e;
                log.error("HTTP 상태 코드: {}", httpEx.getStatusCode());
                log.error("응답 바디: {}", httpEx.getResponseBodyAsString());
            }
            throw new RuntimeException("네이버 쇼핑 API 호출에 실패했습니다.", e);
        }
    }

    /**
     * 네이버 쇼핑 상품을 DB에 저장
     */
    @Transactional
    public void saveNaverProducts(List<NaverShoppingItemDto> items) {
        for (NaverShoppingItemDto item : items) {
            try {
                // 이미 존재하는 상품인지 확인
                Optional<NaverProduct> existingProduct = naverProductRepository.findByProductId(item.getProductId());
                
                if (existingProduct.isPresent()) {
                    // 기존 상품 정보 업데이트
                    NaverProduct product = existingProduct.get();
                    updateNaverProduct(product, item);
                } else {
                    // 새 상품 생성
                    NaverProduct newProduct = createNaverProductFromItem(item);
                    naverProductRepository.save(newProduct);
                }
            } catch (Exception e) {
                log.error("상품 저장 실패 - ProductId: {}, Error: {}", item.getProductId(), e.getMessage());
            }
        }
    }

    /**
     * 네이버 상품을 기존 Product와 연결
     */
    @Transactional
    public void linkToProduct(Long naverProductId, Long productId) {
        Optional<NaverProduct> naverProductOpt = naverProductRepository.findById(naverProductId);
        Optional<Product> productOpt = productRepository.findById(productId);
        
        if (naverProductOpt.isPresent() && productOpt.isPresent()) {
            NaverProduct naverProduct = naverProductOpt.get();
            Product product = productOpt.get();
            naverProduct.setRelatedProduct(product);
            naverProductRepository.save(naverProduct);
            log.info("네이버 상품과 기존 상품 연결 완료: {} -> {}", naverProductId, productId);
        }
    }

    /**
     * 키워드로 네이버 상품 검색
     */
    public Page<NaverProductDto> searchNaverProductsByKeyword(String keyword, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<NaverProduct> naverProducts = naverProductRepository.findByKeyword(keyword, pageable);
        return naverProducts.map(this::convertToDto);
    }

    /**
     * 카테고리로 네이버 상품 검색
     */
    public Page<NaverProductDto> searchNaverProductsByCategory(String category, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<NaverProduct> naverProducts = naverProductRepository.findByCategory(category, pageable);
        return naverProducts.map(this::convertToDto);
    }

    /**
     * 가격 범위로 네이버 상품 검색
     */
    public Page<NaverProductDto> searchNaverProductsByPriceRange(Long minPrice, Long maxPrice, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<NaverProduct> naverProducts = naverProductRepository.findByPriceRange(minPrice, maxPrice, pageable);
        return naverProducts.map(this::convertToDto);
    }



    /**
     * 특정 상품과 관련된 네이버 상품 조회
     */
    public List<NaverProductDto> getRelatedNaverProducts(Long productId) {
        List<NaverProduct> naverProducts = naverProductRepository.findByRelatedProductId(productId);
        return naverProducts.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    /**
     * 네이버 상품을 저장하거나 업데이트
     */
    @Transactional
    public NaverProductSaveResult saveOrUpdateNaverProduct(NaverProductDto naverProductDto) {
        try {
            log.info("네이버 상품 저장/업데이트 시작: {}", naverProductDto.getProductId());
            
            // 필수 필드 검증
            if (naverProductDto.getTitle() == null || naverProductDto.getTitle().trim().isEmpty()) {
                log.warn("title이 비어있어 저장을 건너뜁니다: {}", naverProductDto.getProductId());
                return new NaverProductSaveResult(null, false, "title이 비어있음");
            }
            if (naverProductDto.getPrice() == null || naverProductDto.getPrice() <= 0) {
                log.warn("가격이 0 이하여서 저장을 건너뜁니다: {} - {}", naverProductDto.getTitle(), naverProductDto.getPrice());
                return new NaverProductSaveResult(null, false, "가격이 0 이하");
            }
            
            Optional<NaverProduct> existingProduct = Optional.empty();
            
            // productId가 있으면 productId로 먼저 검색
            if (naverProductDto.getProductId() != null && !naverProductDto.getProductId().trim().isEmpty()) {
                existingProduct = naverProductRepository.findByProductId(naverProductDto.getProductId());
                log.info("productId로 중복 체크: {}", naverProductDto.getProductId());
            }
            
            // productId로 찾지 못했거나 productId가 없으면 title과 mallName으로 검색
            if (existingProduct.isEmpty()) {
                String mallName = naverProductDto.getMallName() != null ? naverProductDto.getMallName().trim() : "";
                if (!mallName.isEmpty()) {
                    existingProduct = naverProductRepository.findByTitleAndMallName(
                        naverProductDto.getTitle().trim(), 
                        mallName
                    );
                    log.info("title과 mallName으로 중복 체크: {} - {}", naverProductDto.getTitle(), mallName);
                }
            }
            
            if (existingProduct.isPresent()) {
                // 기존 상품 업데이트
                log.info("기존 네이버 상품 업데이트: {}", naverProductDto.getProductId() != null ? naverProductDto.getProductId() : naverProductDto.getTitle());
                NaverProduct product = existingProduct.get();
                
                // 카테고리 매핑 적용
                String mappedCategory = mapCategory(naverProductDto.getTitle(), naverProductDto.getCategory1(), naverProductDto.getCategory2(), naverProductDto.getCategory3(), naverProductDto.getCategory4());
                
                product.setTitle(naverProductDto.getTitle());
                product.setDescription(naverProductDto.getDescription());
                product.setPrice(naverProductDto.getPrice());
                product.setImageUrl(naverProductDto.getImageUrl());
                product.setMallName(naverProductDto.getMallName());
                product.setProductUrl(naverProductDto.getProductUrl());
                product.setBrand(naverProductDto.getBrand() != null ? naverProductDto.getBrand() : "");
                product.setMaker(naverProductDto.getMaker() != null ? naverProductDto.getMaker() : "");
                product.setCategory1(mappedCategory); // 매핑된 카테고리 사용
                product.setCategory2(naverProductDto.getCategory1() != null ? naverProductDto.getCategory1() : "");
                product.setCategory3(naverProductDto.getCategory2() != null ? naverProductDto.getCategory2() : "");
                product.setCategory4(naverProductDto.getCategory3() != null ? naverProductDto.getCategory3() : "");
                product.setReviewCount(naverProductDto.getReviewCount() != null ? naverProductDto.getReviewCount() : 0);
                product.setRating(naverProductDto.getRating() != null ? naverProductDto.getRating() : 0.0);
                product.setSearchCount(naverProductDto.getSearchCount() != null ? naverProductDto.getSearchCount() : 0);
                
                NaverProduct savedProduct = naverProductRepository.save(product);
                log.info("네이버 상품 업데이트 완료: {}", savedProduct.getId());
                return new NaverProductSaveResult(savedProduct.getId(), false, "기존 상품 업데이트");
            } else {
                // 새 상품 생성
                log.info("새 네이버 상품 생성: {}", naverProductDto.getProductId() != null ? naverProductDto.getProductId() : naverProductDto.getTitle());
                
                // 카테고리 매핑 적용
                String mappedCategory = mapCategory(naverProductDto.getTitle(), naverProductDto.getCategory1(), naverProductDto.getCategory2(), naverProductDto.getCategory3(), naverProductDto.getCategory4());
                
                NaverProduct newProduct = NaverProduct.builder()
                        .productId(naverProductDto.getProductId() != null ? naverProductDto.getProductId() : "")
                        .title(naverProductDto.getTitle())
                        .description(naverProductDto.getDescription())
                        .price(naverProductDto.getPrice())
                        .imageUrl(naverProductDto.getImageUrl())
                        .mallName(naverProductDto.getMallName())
                        .productUrl(naverProductDto.getProductUrl())
                        .brand(naverProductDto.getBrand() != null ? naverProductDto.getBrand() : "")
                        .maker(naverProductDto.getMaker() != null ? naverProductDto.getMaker() : "")
                        .category1(mappedCategory) // 매핑된 카테고리 사용
                        .category2(naverProductDto.getCategory1() != null ? naverProductDto.getCategory1() : "")
                        .category3(naverProductDto.getCategory2() != null ? naverProductDto.getCategory2() : "")
                        .category4(naverProductDto.getCategory3() != null ? naverProductDto.getCategory3() : "")
                        .reviewCount(naverProductDto.getReviewCount() != null ? naverProductDto.getReviewCount() : 0)
                        .rating(naverProductDto.getRating() != null ? naverProductDto.getRating() : 0.0)
                        .searchCount(naverProductDto.getSearchCount() != null ? naverProductDto.getSearchCount() : 0)
                        .build();
                
                NaverProduct savedProduct = naverProductRepository.save(newProduct);
                log.info("네이버 상품 생성 완료: {}", savedProduct.getId());
                return new NaverProductSaveResult(savedProduct.getId(), true, "새 상품 생성");
            }
        } catch (Exception e) {
            log.error("네이버 상품 저장/업데이트 실패: {} - {}", naverProductDto.getTitle(), e.getMessage());
            // 예외를 던지지 않고 null을 반환하여 조용히 처리
            return new NaverProductSaveResult(null, false, "저장 실패: " + e.getMessage());
        }
    }

    /**
     * 네이버 상품 저장 결과를 담는 내부 클래스
     */
    public static class NaverProductSaveResult {
        private final Long productId;
        private final boolean isNewProduct;
        private final String message;

        public NaverProductSaveResult(Long productId, boolean isNewProduct, String message) {
            this.productId = productId;
            this.isNewProduct = isNewProduct;
            this.message = message;
        }

        public Long getProductId() {
            return productId;
        }

        public boolean isNewProduct() {
            return isNewProduct;
        }

        public String getMessage() {
            return message;
        }
    }

    /**
     * productId로 네이버 상품 조회
     */
    @Transactional(readOnly = true)
    public NaverProductDto getNaverProductByProductId(String productId) {
        Optional<NaverProduct> naverProduct = naverProductRepository.findByProductId(productId);
        return naverProduct.map(NaverProductDto::new).orElse(null);
    }



    private NaverProduct createNaverProductFromItem(NaverShoppingItemDto item) {
        // 카테고리 매핑
        String mappedCategory = mapCategory(item.getTitle(), item.getCategory1(), item.getCategory2(), item.getCategory3(), item.getCategory4());
        
        return NaverProduct.builder()
                .productId(item.getProductId())  // 네이버의 원본 productId 저장
                .title(item.getTitle())
                .description(item.getTitle()) // 네이버 API에서는 별도 description이 없으므로 title 사용
                .price(parsePrice(item.getLprice()))
                .imageUrl(item.getImage())
                .mallName(item.getMallName())
                .productUrl(item.getLink())
                .brand(item.getBrand() != null ? item.getBrand() : "")
                .maker(item.getMaker() != null ? item.getMaker() : "")
                .category1(mappedCategory) // 매핑된 카테고리를 category1에 저장
                .category2(item.getCategory1() != null ? item.getCategory1() : "")
                .category3(item.getCategory2() != null ? item.getCategory2() : "")
                .category4(item.getCategory3() != null ? item.getCategory3() : "")
                .reviewCount(parseInteger(item.getReviewCount()))
                .rating(parseDouble(item.getRating()))
                .searchCount(parseInteger(item.getSearchCount()))
                .build();
    }

    private void updateNaverProduct(NaverProduct product, NaverShoppingItemDto item) {
        // 카테고리 매핑 적용
        String mappedCategory = mapCategory(item.getTitle(), item.getCategory1(), item.getCategory2(), item.getCategory3(), item.getCategory4());
        
        product.setTitle(item.getTitle());
        product.setDescription(item.getTitle());
        product.setPrice(parsePrice(item.getLprice()));
        product.setImageUrl(item.getImage());
        product.setMallName(item.getMallName());
        product.setProductUrl(item.getLink());
        product.setBrand(item.getBrand() != null ? item.getBrand() : "");
        product.setMaker(item.getMaker() != null ? item.getMaker() : "");
        product.setCategory1(mappedCategory); // 매핑된 카테고리 사용
        product.setCategory2(item.getCategory1() != null ? item.getCategory1() : "");
        product.setCategory3(item.getCategory2() != null ? item.getCategory2() : "");
        product.setCategory4(item.getCategory3() != null ? item.getCategory3() : "");
        product.setReviewCount(parseInteger(item.getReviewCount()));
        product.setRating(parseDouble(item.getRating()));
        product.setSearchCount(parseInteger(item.getSearchCount()));
        
        naverProductRepository.save(product);
    }

    private NaverProductDto convertToDto(NaverProduct product) {
        return NaverProductDto.builder()
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
                .build();
    }

    private Long parsePrice(String priceStr) {
        try {
            return Long.parseLong(priceStr.replaceAll("[^0-9]", ""));
        } catch (Exception e) {
            return 0L;
        }
    }

    private Integer parseInteger(String str) {
        try {
            return Integer.parseInt(str.replaceAll("[^0-9]", ""));
        } catch (Exception e) {
            return 0;
        }
    }

    private Double parseDouble(String str) {
        try {
            return Double.parseDouble(str);
        } catch (Exception e) {
            return 0.0;
        }
    }

    /**
     * 인기 네이버 상품 조회
     */
    public Page<NaverProductDto> getPopularProducts(int page, int size) {
        try {
            log.info("인기 네이버 상품 조회 시작: page={}, size={}", page, size);
            
            Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "searchCount", "reviewCount"));
            Page<NaverProduct> products = naverProductRepository.findPopularProducts(pageable);
            
            Page<NaverProductDto> productDtos = products.map(this::convertToDto);
            
            log.info("인기 네이버 상품 조회 완료: 총 {}개 상품", productDtos.getTotalElements());
            return productDtos;
            
        } catch (Exception e) {
            log.error("인기 네이버 상품 조회 실패: {}", e.getMessage(), e);
            throw new RuntimeException("인기 네이버 상품 조회에 실패했습니다: " + e.getMessage());
        }
    }

    /**
     * 모든 네이버 상품 조회
     */
    public Page<NaverProductDto> getAllNaverProducts(int page, int size) {
        try {
            log.info("모든 네이버 상품 조회 시작: page={}, size={}", page, size);
            
            Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
            Page<NaverProduct> products = naverProductRepository.findAll(pageable);
            
            Page<NaverProductDto> productDtos = products.map(this::convertToDto);
            
            log.info("모든 네이버 상품 조회 완료: 총 {}개 상품", productDtos.getTotalElements());
            return productDtos;
            
        } catch (Exception e) {
            log.error("모든 네이버 상품 조회 실패: {}", e.getMessage(), e);
            throw new RuntimeException("모든 네이버 상품 조회에 실패했습니다: " + e.getMessage());
        }
    }

    /**
     * 네이버 상품 개수 조회
     */
    public long getNaverProductCount() {
        try {
            log.info("네이버 상품 개수 조회 시작");
            
            long count = naverProductRepository.count();
            
            log.info("네이버 상품 개수 조회 완료: 총 {}개 상품", count);
            return count;
            
        } catch (Exception e) {
            log.error("네이버 상품 개수 조회 실패: {}", e.getMessage(), e);
            throw new RuntimeException("네이버 상품 개수 조회에 실패했습니다: " + e.getMessage());
        }
    }

    /**
     * 네이버 상품 삭제
     */
    @Transactional
    public void deleteNaverProduct(Long id) {
        log.info("네이버 상품 삭제 시작: {}", id);
        
        NaverProduct naverProduct = naverProductRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("네이버 상품을 찾을 수 없습니다: " + id));
        
        log.info("삭제할 네이버 상품: {}", naverProduct.getTitle());
        
        try {
            // 관련된 장바구니 항목들 먼저 삭제
            // CartService에서 네이버 상품 관련 장바구니 삭제 로직이 있다면 여기서 호출
            // 또는 직접 CartRepository를 주입받아서 처리
            
            // 네이버 상품 삭제
            naverProductRepository.delete(naverProduct);
            log.info("네이버 상품 삭제 완료: {}", id);
            
        } catch (Exception e) {
            log.error("네이버 상품 삭제 중 오류 발생: {}", e.getMessage(), e);
            throw new RuntimeException("네이버 상품 삭제에 실패했습니다: " + e.getMessage());
        }
    }

    /**
     * 상품 제목과 카테고리를 기반으로 우리 시스템의 카테고리로 매핑
     */
    private String mapCategory(String title, String category1, String category2, String category3, String category4) {
        if (title == null) title = "";
        if (category1 == null) category1 = "";
        if (category2 == null) category2 = "";
        if (category3 == null) category3 = "";
        if (category4 == null) category4 = "";
        
        String combinedText = (title + " " + category1 + " " + category2 + " " + category3 + " " + category4).toLowerCase();
        
        log.info("카테고리 매핑 - 제목: {}, 카테고리: {}, {}, {}, {}", title, category1, category2, category3, category4);
        
        // 사료 카테고리
        if (combinedText.contains("사료") || combinedText.contains("feed") || combinedText.contains("dog food") || combinedText.contains("cat food") ||
            combinedText.contains("펫푸드") || combinedText.contains("pet food")) {
            log.info("사료 카테고리로 매핑됨: {}", title);
            return "사료";
        }
        
        // 간식 카테고리
        if (combinedText.contains("간식") || combinedText.contains("트릿") || combinedText.contains("snack") || combinedText.contains("treat") ||
            combinedText.contains("껌") || combinedText.contains("chew") || combinedText.contains("biscuit")) {
            log.info("간식 카테고리로 매핑됨: {}", title);
            return "간식";
        }
        
        // 장난감 카테고리
        if (combinedText.contains("장난감") || combinedText.contains("공") || combinedText.contains("로프") || combinedText.contains("toy") || combinedText.contains("ball") ||
            combinedText.contains("인형") || combinedText.contains("doll") || combinedText.contains("플러시") || combinedText.contains("plush")) {
            log.info("장난감 카테고리로 매핑됨: {}", title);
            return "장난감";
        }
        
        // 의류 카테고리 (더 포괄적으로)
        if (combinedText.contains("옷") || combinedText.contains("코트") || combinedText.contains("신발") || combinedText.contains("후드") || 
            combinedText.contains("원피스") || combinedText.contains("티셔츠") || combinedText.contains("패딩") || combinedText.contains("비옷") ||
            combinedText.contains("clothes") || combinedText.contains("coat") || combinedText.contains("shoes") || combinedText.contains("hood") ||
            combinedText.contains("의류") || combinedText.contains("패션") || combinedText.contains("fashion") || combinedText.contains("wear") ||
            combinedText.contains("조끼") || combinedText.contains("vest") || combinedText.contains("스웨터") || combinedText.contains("sweater") ||
            combinedText.contains("양말") || combinedText.contains("socks") || combinedText.contains("모자") || combinedText.contains("hat") ||
            combinedText.contains("카프") || combinedText.contains("scarf") || combinedText.contains("넥타이") || combinedText.contains("tie")) {
            log.info("의류 카테고리로 매핑됨: {}", title);
            return "의류";
        }
        
        // 건강관리 카테고리 (더 포괄적으로)
        if (combinedText.contains("영양제") || combinedText.contains("비타민") || combinedText.contains("오메가") || combinedText.contains("프로바이오틱스") ||
            combinedText.contains("관절") || combinedText.contains("피부") || combinedText.contains("눈") || combinedText.contains("치아") || combinedText.contains("털") ||
            combinedText.contains("supplement") || combinedText.contains("vitamin") || combinedText.contains("omega") || combinedText.contains("probiotic") ||
            combinedText.contains("건강") || combinedText.contains("health") || combinedText.contains("케어") || combinedText.contains("care") ||
            combinedText.contains("미네랄") || combinedText.contains("mineral") || combinedText.contains("칼슘") || combinedText.contains("calcium") ||
            combinedText.contains("글루코사민") || combinedText.contains("glucosamine") || combinedText.contains("콘드로이틴") || combinedText.contains("chondroitin") ||
            combinedText.contains("유산균") || combinedText.contains("lactobacillus") || combinedText.contains("면역력") || combinedText.contains("immune") ||
            combinedText.contains("항산화") || combinedText.contains("antioxidant") || combinedText.contains("오메가3") || combinedText.contains("omega3") ||
            combinedText.contains("오메가6") || combinedText.contains("omega6") || combinedText.contains("오메가9") || combinedText.contains("omega9")) {
            log.info("건강관리 카테고리로 매핑됨: {}", title);
            return "건강관리";
        }
        
        // 용품 카테고리 (기본값)
        log.info("용품 카테고리로 매핑됨 (기본값): {}", title);
        return "용품";
    }
}
