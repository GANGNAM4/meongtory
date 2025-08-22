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
    public Long saveOrUpdateNaverProduct(NaverProductDto naverProductDto) {
        try {
            log.info("네이버 상품 저장/업데이트 시작: {}", naverProductDto.getProductId());
            log.info("받은 데이터: {}", naverProductDto);
            
            // 필수 필드 검증
            if (naverProductDto.getProductId() == null || naverProductDto.getProductId().trim().isEmpty()) {
                throw new IllegalArgumentException("productId는 필수입니다.");
            }
            if (naverProductDto.getTitle() == null || naverProductDto.getTitle().trim().isEmpty()) {
                throw new IllegalArgumentException("title은 필수입니다.");
            }
            if (naverProductDto.getPrice() == null || naverProductDto.getPrice() <= 0) {
                throw new IllegalArgumentException("price는 0보다 커야 합니다.");
            }
            
            Optional<NaverProduct> existingProduct = naverProductRepository.findByProductId(naverProductDto.getProductId());
            
            if (existingProduct.isPresent()) {
                // 기존 상품 업데이트
                log.info("기존 네이버 상품 업데이트: {}", naverProductDto.getProductId());
                NaverProduct product = existingProduct.get();
                product.setTitle(naverProductDto.getTitle());
                product.setDescription(naverProductDto.getDescription());
                product.setPrice(naverProductDto.getPrice());
                product.setImageUrl(naverProductDto.getImageUrl());
                product.setMallName(naverProductDto.getMallName());
                product.setProductUrl(naverProductDto.getProductUrl());
                product.setBrand(naverProductDto.getBrand() != null ? naverProductDto.getBrand() : "");
                product.setMaker(naverProductDto.getMaker() != null ? naverProductDto.getMaker() : "");
                product.setCategory1(naverProductDto.getCategory1() != null ? naverProductDto.getCategory1() : "");
                product.setCategory2(naverProductDto.getCategory2() != null ? naverProductDto.getCategory2() : "");
                product.setCategory3(naverProductDto.getCategory3() != null ? naverProductDto.getCategory3() : "");
                product.setCategory4(naverProductDto.getCategory4() != null ? naverProductDto.getCategory4() : "");
                product.setReviewCount(naverProductDto.getReviewCount() != null ? naverProductDto.getReviewCount() : 0);
                product.setRating(naverProductDto.getRating() != null ? naverProductDto.getRating() : 0.0);
                product.setSearchCount(naverProductDto.getSearchCount() != null ? naverProductDto.getSearchCount() : 0);
                
                NaverProduct savedProduct = naverProductRepository.save(product);
                log.info("네이버 상품 업데이트 완료: {}", savedProduct.getId());
                return savedProduct.getId();
            } else {
                // 새 상품 생성
                log.info("새 네이버 상품 생성: {}", naverProductDto.getProductId());
                NaverProduct newProduct = NaverProduct.builder()
                        .productId(naverProductDto.getProductId())
                        .title(naverProductDto.getTitle())
                        .description(naverProductDto.getDescription())
                        .price(naverProductDto.getPrice())
                        .imageUrl(naverProductDto.getImageUrl())
                        .mallName(naverProductDto.getMallName())
                        .productUrl(naverProductDto.getProductUrl())
                        .brand(naverProductDto.getBrand() != null ? naverProductDto.getBrand() : "")
                        .maker(naverProductDto.getMaker() != null ? naverProductDto.getMaker() : "")
                        .category1(naverProductDto.getCategory1() != null ? naverProductDto.getCategory1() : "")
                        .category2(naverProductDto.getCategory2() != null ? naverProductDto.getCategory2() : "")
                        .category3(naverProductDto.getCategory3() != null ? naverProductDto.getCategory3() : "")
                        .category4(naverProductDto.getCategory4() != null ? naverProductDto.getCategory4() : "")
                        .reviewCount(naverProductDto.getReviewCount() != null ? naverProductDto.getReviewCount() : 0)
                        .rating(naverProductDto.getRating() != null ? naverProductDto.getRating() : 0.0)
                        .searchCount(naverProductDto.getSearchCount() != null ? naverProductDto.getSearchCount() : 0)
                        .build();
                
                NaverProduct savedProduct = naverProductRepository.save(newProduct);
                log.info("네이버 상품 생성 완료: {}", savedProduct.getId());
                return savedProduct.getId();
            }
        } catch (Exception e) {
            log.error("네이버 상품 저장/업데이트 실패: {}", e.getMessage(), e);
            throw new RuntimeException("네이버 상품 저장에 실패했습니다: " + e.getMessage(), e);
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
                .category1(item.getCategory1() != null ? item.getCategory1() : "")
                .category2(item.getCategory2() != null ? item.getCategory2() : "")
                .category3(item.getCategory3() != null ? item.getCategory3() : "")
                .category4(item.getCategory4() != null ? item.getCategory4() : "")
                .reviewCount(parseInteger(item.getReviewCount()))
                .rating(parseDouble(item.getRating()))
                .searchCount(parseInteger(item.getSearchCount()))
                .build();
    }

    private void updateNaverProduct(NaverProduct product, NaverShoppingItemDto item) {
        product.setTitle(item.getTitle());
        product.setDescription(item.getTitle());
        product.setPrice(parsePrice(item.getLprice()));
        product.setImageUrl(item.getImage());
        product.setMallName(item.getMallName());
        product.setProductUrl(item.getLink());
        product.setBrand(item.getBrand() != null ? item.getBrand() : "");
        product.setMaker(item.getMaker() != null ? item.getMaker() : "");
        product.setCategory1(item.getCategory1() != null ? item.getCategory1() : "");
        product.setCategory2(item.getCategory2() != null ? item.getCategory2() : "");
        product.setCategory3(item.getCategory3() != null ? item.getCategory3() : "");
        product.setCategory4(item.getCategory4() != null ? item.getCategory4() : "");
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
}
