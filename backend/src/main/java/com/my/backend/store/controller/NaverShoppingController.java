package com.my.backend.store.controller;

import com.my.backend.account.service.AccountService;
import com.my.backend.global.dto.ResponseDto;
import com.my.backend.store.dto.NaverProductDto;
import com.my.backend.store.dto.NaverShoppingSearchRequestDto;
import com.my.backend.store.service.CartService;
import com.my.backend.store.service.NaverShoppingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.my.backend.global.security.user.UserDetailsImpl;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/naver-shopping")
@RequiredArgsConstructor
@Slf4j
public class NaverShoppingController {
    private final NaverShoppingService naverShoppingService;
    private final CartService cartService;
    private final AccountService accountService;

    /**
     * 네이버 쇼핑 실시간 검색
     */
    @PostMapping("/search")
    public ResponseEntity<ResponseDto> searchProducts(@RequestBody NaverShoppingSearchRequestDto requestDto) {
        try {
            var response = naverShoppingService.searchProducts(requestDto);
            return ResponseEntity.ok(ResponseDto.success(response));
        } catch (Exception e) {
            log.error("네이버 쇼핑 검색 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(ResponseDto.fail("SEARCH_FAILED", "네이버 쇼핑 검색에 실패했습니다: " + e.getMessage()));
        }
    }

    /**
     * 저장된 네이버 상품 키워드 검색
     */
    @GetMapping("/products/search")
    public ResponseEntity<ResponseDto> searchNaverProducts(
            @RequestParam String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<NaverProductDto> products = naverShoppingService.searchNaverProductsByKeyword(keyword, page, size);
            return ResponseEntity.ok(ResponseDto.success(products));
        } catch (Exception e) {
            log.error("네이버 상품 검색 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(ResponseDto.fail("SEARCH_FAILED", "네이버 상품 검색에 실패했습니다: " + e.getMessage()));
        }
    }

    /**
     * 카테고리별 네이버 상품 검색
     */
    @GetMapping("/products/category/{category}")
    public ResponseEntity<ResponseDto> searchByCategory(
            @PathVariable String category,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<NaverProductDto> products = naverShoppingService.searchNaverProductsByCategory(category, page, size);
            return ResponseEntity.ok(ResponseDto.success(products));
        } catch (Exception e) {
            log.error("카테고리별 네이버 상품 검색 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(ResponseDto.fail("CATEGORY_SEARCH_FAILED", "카테고리별 네이버 상품 검색에 실패했습니다: " + e.getMessage()));
        }
    }

    /**
     * 가격 범위별 네이버 상품 검색
     */
    @GetMapping("/products/price-range")
    public ResponseEntity<ResponseDto> searchByPriceRange(
            @RequestParam Long minPrice,
            @RequestParam Long maxPrice,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            Page<NaverProductDto> products = naverShoppingService.searchNaverProductsByPriceRange(minPrice, maxPrice, page, size);
            return ResponseEntity.ok(ResponseDto.success(products));
        } catch (Exception e) {
            log.error("가격 범위별 네이버 상품 검색 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(ResponseDto.fail("PRICE_RANGE_SEARCH_FAILED", "가격 범위별 네이버 상품 검색에 실패했습니다: " + e.getMessage()));
        }
    }

    /**
     * 인기 네이버 상품 조회
     */
    @GetMapping("/products/popular")
    public ResponseEntity<ResponseDto> getPopularProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        try {
            log.info("인기 네이버 상품 조회 요청: page={}, size={}", page, size);
            
            Page<NaverProductDto> products = naverShoppingService.getPopularProducts(page, size);
            return ResponseEntity.ok(ResponseDto.success(products));
        } catch (Exception e) {
            log.error("인기 네이버 상품 조회 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(ResponseDto.fail("POPULAR_PRODUCTS_FAILED", "인기 네이버 상품 조회에 실패했습니다: " + e.getMessage()));
        }
    }

    /**
     * 모든 네이버 상품 조회
     */
    @GetMapping("/products/all")
    public ResponseEntity<ResponseDto> getAllNaverProducts(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "1000") int size) {
        try {
            log.info("모든 네이버 상품 조회 요청: page={}, size={}", page, size);
            
            Page<NaverProductDto> products = naverShoppingService.getAllNaverProducts(page, size);
            return ResponseEntity.ok(ResponseDto.success(products));
        } catch (Exception e) {
            log.error("모든 네이버 상품 조회 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(ResponseDto.fail("ALL_PRODUCTS_FAILED", "모든 네이버 상품 조회에 실패했습니다: " + e.getMessage()));
        }
    }

    /**
     * 네이버 상품 상세 조회
     */
    @GetMapping("/products/{productId}")
    public ResponseEntity<ResponseDto> getNaverProduct(@PathVariable String productId) {
        try {
            NaverProductDto product = naverShoppingService.getNaverProductByProductId(productId);
            if (product == null) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok(ResponseDto.success(product));
        } catch (Exception e) {
            log.error("네이버 상품 상세 조회 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(ResponseDto.fail("PRODUCT_NOT_FOUND", "네이버 상품을 찾을 수 없습니다: " + e.getMessage()));
        }
    }



    /**
     * 현재 인증된 사용자의 ID를 가져오는 헬퍼 메서드
     */
    private Long getCurrentUserId(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        if (userDetails == null || userDetails.getAccount() == null) {
            throw new IllegalArgumentException("로그인이 필요합니다");
        }
        return userDetails.getAccount().getId();
    }

    /**
     * 네이버 상품을 카트에 추가 (상품 정보와 함께)
     */
    @PostMapping("/cart/add")
    public ResponseEntity<ResponseDto> addToCartWithProduct(@RequestBody NaverProductDto naverProductDto,
                                                           @RequestParam(defaultValue = "1") int quantity,
                                                           @AuthenticationPrincipal UserDetailsImpl userDetails) {
        try {
            Long accountId = getCurrentUserId(userDetails);
            
            // 네이버 상품을 데이터베이스에 저장하거나 업데이트
            NaverShoppingService.NaverProductSaveResult result = naverShoppingService.saveOrUpdateNaverProduct(naverProductDto);
            
            if (result.getProductId() == null) {
                return ResponseEntity.badRequest().body(ResponseDto.fail("SAVE_FAILED", "네이버 상품 저장에 실패했습니다: " + result.getMessage()));
            }
            
            // 카트에 추가
            cartService.addNaverProductToCart(accountId, result.getProductId(), quantity);
            
            return ResponseEntity.ok(ResponseDto.success("네이버 상품을 카트에 추가했습니다"));
        } catch (Exception e) {
            log.error("네이버 상품 카트 추가 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(ResponseDto.fail("CART_ADD_FAILED", "네이버 상품을 카트에 추가하는데 실패했습니다: " + e.getMessage()));
        }
    }

    /**
     * 네이버 상품을 카트에 추가 (기존 방식 - 호환성 유지)
     */
    @PostMapping("/cart/{naverProductId}")
    public ResponseEntity<ResponseDto> addToCart(
            @PathVariable Long naverProductId,
            @RequestParam(defaultValue = "1") int quantity,
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        try {
            Long accountId = getCurrentUserId(userDetails);
            
            // 카트에 추가 (네이버 상품이 없으면 예외 발생)
            cartService.addNaverProductToCart(accountId, naverProductId, quantity);
            
            return ResponseEntity.ok(ResponseDto.success("네이버 상품을 카트에 추가했습니다"));
        } catch (Exception e) {
            log.error("네이버 상품 카트 추가 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(ResponseDto.fail("CART_ADD_FAILED", "네이버 상품을 카트에 추가하는데 실패했습니다: " + e.getMessage()));
        }
    }

    /**
     * 네이버 상품을 기존 상품과 연결
     */
    @PostMapping("/link/{naverProductId}/product/{productId}")
    public ResponseEntity<ResponseDto> linkToProduct(
            @PathVariable Long naverProductId,
            @PathVariable Long productId) {
        try {
            naverShoppingService.linkToProduct(naverProductId, productId);
            return ResponseEntity.ok(ResponseDto.success("네이버 상품과 기존 상품이 연결되었습니다"));
        } catch (Exception e) {
            log.error("네이버 상품 연결 실패: {}", e.getMessage());
            return ResponseEntity.badRequest().body(ResponseDto.fail("LINK_FAILED", "네이버 상품 연결에 실패했습니다: " + e.getMessage()));
        }
    }

    /**
     * 네이버 상품을 DB에 저장
     */
    @PostMapping("/save")
    public ResponseEntity<ResponseDto> saveNaverProduct(@RequestBody NaverProductDto naverProductDto) {
        try {
            log.info("네이버 상품 저장 요청 받음: {}", naverProductDto.getTitle());
            
            // 필수 필드 검증
            if (naverProductDto == null) {
                return ResponseEntity.badRequest().body(ResponseDto.fail("INVALID_REQUEST", "요청 데이터가 null입니다."));
            }
            
            if (naverProductDto.getProductId() == null || naverProductDto.getProductId().trim().isEmpty()) {
                log.warn("productId가 비어있어 저장을 건너뜁니다: {}", naverProductDto.getTitle());
                return ResponseEntity.ok(ResponseDto.success(new NaverShoppingService.NaverProductSaveResult(null, false, "productId가 비어있음")));
            }
            
            if (naverProductDto.getTitle() == null || naverProductDto.getTitle().trim().isEmpty()) {
                log.warn("title이 비어있어 저장을 건너뜁니다: {}", naverProductDto.getProductId());
                return ResponseEntity.ok(ResponseDto.success(new NaverShoppingService.NaverProductSaveResult(null, false, "title이 비어있음")));
            }
            
            if (naverProductDto.getPrice() == null || naverProductDto.getPrice() <= 0) {
                log.warn("가격이 0 이하여서 저장을 건너뜁니다: {} - {}", naverProductDto.getTitle(), naverProductDto.getPrice());
                return ResponseEntity.ok(ResponseDto.success(new NaverShoppingService.NaverProductSaveResult(null, false, "가격이 0 이하")));
            }
            
            NaverShoppingService.NaverProductSaveResult result = naverShoppingService.saveOrUpdateNaverProduct(naverProductDto);
            
            if (result.getProductId() != null) {
                log.info("네이버 상품 저장 성공: {} (새 상품: {})", result.getProductId(), result.isNewProduct());
                return ResponseEntity.ok(ResponseDto.success(result));
            } else {
                log.warn("네이버 상품 저장 실패: {}", result.getMessage());
                return ResponseEntity.ok(ResponseDto.success(result));
            }
        } catch (Exception e) {
            log.error("네이버 상품 저장 중 예외 발생: {} - {}", naverProductDto.getTitle(), e.getMessage());
            return ResponseEntity.ok(ResponseDto.success(new NaverShoppingService.NaverProductSaveResult(null, false, "저장 실패: " + e.getMessage())));
        }
    }

    /**
     * 네이버 상품 삭제
     */
    @DeleteMapping("/products/{id}")
    public ResponseEntity<ResponseDto> deleteNaverProduct(@PathVariable Long id) {
        try {
            log.info("네이버 상품 삭제 요청 받음: {}", id);
            
            if (id == null || id <= 0) {
                return ResponseEntity.badRequest().body(ResponseDto.fail("INVALID_ID", "유효하지 않은 상품 ID입니다."));
            }
            
            naverShoppingService.deleteNaverProduct(id);
            log.info("네이버 상품 삭제 성공: {}", id);
            return ResponseEntity.ok(ResponseDto.success("네이버 상품이 성공적으로 삭제되었습니다."));
        } catch (Exception e) {
            log.error("네이버 상품 삭제 실패: {}", e.getMessage(), e);
            return ResponseEntity.badRequest().body(ResponseDto.fail("DELETE_FAILED", "네이버 상품 삭제에 실패했습니다: " + e.getMessage()));
        }
    }
}
