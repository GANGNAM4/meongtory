package com.my.backend.recent.service;

import com.my.backend.account.entity.Account;
import com.my.backend.recent.dto.RecentProductDto;
import com.my.backend.insurance.entity.InsuranceProduct;
import com.my.backend.recent.entity.RecentProduct;
import com.my.backend.insurance.repository.InsuranceProductRepository;
import com.my.backend.recent.repository.RecentProductRepository;
import com.my.backend.store.entity.Product;
import com.my.backend.store.entity.NaverProduct;
import com.my.backend.store.repository.ProductRepository;
import com.my.backend.store.repository.NaverProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class RecentProductService {

    private final RecentProductRepository recentProductRepository;
    private final InsuranceProductRepository insuranceProductRepository;
    private final ProductRepository productRepository;
    private final NaverProductRepository naverProductRepository;

    public List<RecentProductDto> getRecentProducts(Long accountId, String productType) {
        List<RecentProduct> recentProducts = recentProductRepository
                .findByAccountIdAndProductTypeOrderByViewedAtDesc(accountId, productType);
        
        return recentProducts.stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public void addToRecentProducts(Long accountId, Long productId, String productType) {
        System.out.println("=== RecentProductService.addToRecentProducts ===");
        System.out.println("accountId: " + accountId);
        System.out.println("productId: " + productId);
        System.out.println("productType: " + productType);
        
        // 이미 있는지 확인
        RecentProduct existing = recentProductRepository
                .findByAccountIdAndProductTypeAndProductId(accountId, productType, productId);
        
        if (existing != null) {
            System.out.println("기존 항목 발견, 삭제 중...");
            // 기존 항목 삭제 (나중에 다시 추가하여 최신순으로 정렬)
            recentProductRepository.delete(existing);
        }

        // Account 객체 생성
        Account account = new Account();
        account.setId(accountId);

        // 새로운 최근 본 상품 생성
        RecentProduct recentProduct;
        
        if ("insurance".equals(productType)) {
            // 보험 상품 조회
            InsuranceProduct insuranceProduct = insuranceProductRepository.findById(productId)
                    .orElseThrow(() -> new IllegalArgumentException("보험 상품을 찾을 수 없습니다: " + productId));
            
            recentProduct = RecentProduct.builder()
                    .account(account)
                    .insuranceProduct(insuranceProduct)
                    .productType(productType)
                    .build();
        } else if ("store".equals(productType)) {
            // 스토어 상품 조회 (일반 상품 또는 네이버 상품)
            System.out.println("=== 스토어 상품 조회 ===");
            System.out.println("스토어 상품 조회 시도 - productId: " + productId);
            
            try {
                // 먼저 일반 상품에서 조회
                Product storeProduct = productRepository.findById(productId).orElse(null);
                
                if (storeProduct != null) {
                    // 일반 상품인 경우
                    System.out.println("일반 상품 조회 성공 - 상품명: " + storeProduct.getName());
                    System.out.println("일반 상품 ID: " + storeProduct.getId());
                    
                    recentProduct = RecentProduct.builder()
                            .account(account)
                            .storeProduct(storeProduct)
                            .productType(productType)
                            .build();
                } else {
                    // 네이버 상품에서 조회
                    NaverProduct naverProduct = naverProductRepository.findById(productId)
                            .orElseThrow(() -> new IllegalArgumentException("스토어 상품을 찾을 수 없습니다: " + productId));
                    
                    System.out.println("네이버 상품 조회 성공 - 상품명: " + naverProduct.getTitle());
                    System.out.println("네이버 상품 ID: " + naverProduct.getId());
                    
                    recentProduct = RecentProduct.builder()
                            .account(account)
                            .naverProduct(naverProduct)
                            .productType(productType)
                            .build();
                }
                        
                System.out.println("RecentProduct 생성 완료");
            } catch (Exception e) {
                System.out.println("스토어 상품 조회 실패: " + e.getMessage());
                throw e;
            }
        } else {
            throw new IllegalArgumentException("지원하지 않는 상품 타입입니다: " + productType);
        }

        recentProductRepository.save(recentProduct);

        // 최대 15개만 유지
        List<RecentProduct> allRecent = recentProductRepository
                .findByAccountIdAndProductTypeOrderByViewedAtDesc(accountId, productType);
        
        if (allRecent.size() > 15) {
            List<RecentProduct> toDelete = allRecent.subList(15, allRecent.size());
            recentProductRepository.deleteAll(toDelete);
        }
    }

    @Transactional
    public void clearRecentProducts(Long accountId, String productType) {
        recentProductRepository.deleteByAccountIdAndProductType(accountId, productType);
    }

    private RecentProductDto toDto(RecentProduct entity) {
        if ("insurance".equals(entity.getProductType()) && entity.getInsuranceProduct() != null) {
            InsuranceProduct product = entity.getInsuranceProduct();
            return RecentProductDto.builder()
                    .id(entity.getId())
                    .productId(product.getId())
                    .productType(entity.getProductType())
                    .company(product.getCompany())
                    .productName(product.getProductName())
                    .description(product.getDescription())
                    .logoUrl(product.getLogoUrl())
                    .price(null) // 보험 상품은 가격 정보가 없음
                    .viewedAt(entity.getViewedAt())
                    .build();
        } else if ("store".equals(entity.getProductType())) {
            if (entity.getStoreProduct() != null) {
                // 일반 상품인 경우
                Product product = entity.getStoreProduct();
                return RecentProductDto.builder()
                        .id(entity.getId())
                        .productId(product.getId())
                        .productType(entity.getProductType())
                        .company(null) // 스토어 상품은 회사 정보가 없음
                        .productName(product.getName())
                        .description(product.getDescription())
                        .logoUrl(product.getImageUrl())
                        .price(product.getPrice()) // 가격 정보 추가
                        .viewedAt(entity.getViewedAt())
                        .build();
            } else if (entity.getNaverProduct() != null) {
                // 네이버 상품인 경우
                NaverProduct naverProduct = entity.getNaverProduct();
                return RecentProductDto.builder()
                        .id(entity.getId())
                        .productId(naverProduct.getId()) // PK 사용
                        .naverProductId(naverProduct.getProductId()) // 네이버 상품 ID 사용
                        .productType(entity.getProductType())
                        .company(naverProduct.getMallName()) // 네이버 상품은 mallName을 company로 사용
                        .productName(removeHtmlTags(naverProduct.getTitle()))
                        .description(removeHtmlTags(naverProduct.getDescription()))
                        .logoUrl(naverProduct.getImageUrl())
                        .price(naverProduct.getPrice()) // 가격 정보 추가
                        .viewedAt(entity.getViewedAt())
                        .build();
            } else {
                throw new IllegalArgumentException("유효하지 않은 RecentProduct 엔티티입니다.");
            }
        } else {
            throw new IllegalArgumentException("유효하지 않은 RecentProduct 엔티티입니다.");
        }
    }
    
    /**
     * HTML 태그를 제거하는 유틸리티 메서드
     */
    private String removeHtmlTags(String text) {
        if (text == null) {
            return null;
        }
        return text.replaceAll("<[^>]*>", "");
    }
} 