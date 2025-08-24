package com.my.backend.insurance.service;

import com.my.backend.insurance.dto.InsuranceProductDto;
import com.my.backend.insurance.entity.InsuranceProduct;
import com.my.backend.insurance.repository.InsuranceProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class InsuranceService {

    private final InsuranceProductRepository repository;
    private final InsuranceLogoService logoService;

    public List<InsuranceProductDto> findAll() {
        return repository.findAll().stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public InsuranceProductDto findById(Long id) {
        InsuranceProduct entity = repository.findById(id).orElse(null);
        return entity != null ? toDto(entity) : null;
    }

    @Transactional
    public InsuranceProductDto upsert(InsuranceProductDto dto) {
        // 데이터 검증 및 정리
        dto = sanitizeDto(dto);
        
        InsuranceProduct entity = repository.findByCompanyAndProductName(dto.getCompany(), dto.getProductName())
                .orElse(new InsuranceProduct());

        // 엔티티 업데이트
        entity.setCompany(dto.getCompany());
        entity.setProductName(dto.getProductName());
        entity.setDescription(dto.getDescription());
        entity.setFeatures(String.join(",", dto.getFeatures() != null ? dto.getFeatures() : List.of()));
        entity.setRedirectUrl(dto.getRedirectUrl());

        // 실시간 로고 URL 설정
        if (dto.getLogoUrl() != null && !dto.getLogoUrl().isEmpty() && !dto.getLogoUrl().contains("placeholder")) {
            entity.setLogoUrl(dto.getLogoUrl());
            log.info("실시간 로고 URL 설정: {} -> {}", dto.getCompany(), dto.getLogoUrl());
        } else {
            // 기본 로고 URL 사용
            String defaultLogoUrl = logoService.getCompanyLogoUrl(dto.getCompany());
            entity.setLogoUrl(defaultLogoUrl);
            log.info("기본 로고 URL 설정: {} -> {}", dto.getCompany(), defaultLogoUrl);
        }

        InsuranceProduct saved = repository.save(entity);
        return toDto(saved);
    }

    /**
     * 모든 보험사의 로고를 기본 로고로 업데이트
     */
    @Transactional
    public void updateAllLogos() {
        List<InsuranceProduct> allProducts = repository.findAll();
        int updatedCount = 0;
        
        for (InsuranceProduct product : allProducts) {
            String defaultLogoUrl = logoService.getCompanyLogoUrl(product.getCompany());
            if (defaultLogoUrl != null && !defaultLogoUrl.equals(product.getLogoUrl())) {
                product.setLogoUrl(defaultLogoUrl);
                log.info("보험사 로고 업데이트 성공: {} -> {}", product.getCompany(), defaultLogoUrl);
                updatedCount++;
            } else {
                log.info("보험사 로고 업데이트 불필요: {}", product.getCompany());
            }
        }
        repository.saveAll(allProducts);
        log.info("모든 보험사 로고 업데이트 완료 - 업데이트: {}", updatedCount);
    }

    /**
     * 여러 보험 상품을 일괄 upsert
     */
    @Transactional
    public void upsertAll(List<InsuranceProductDto> dtos) {
        for (InsuranceProductDto dto : dtos) {
            upsert(dto);
        }
    }

    private InsuranceProductDto toDto(InsuranceProduct entity) {
        List<String> features = entity.getFeatures() == null || entity.getFeatures().isBlank()
                ? List.of()
                : List.of(entity.getFeatures().split(","));
                
        return InsuranceProductDto.builder()
                .id(entity.getId())
                .company(entity.getCompany())
                .productName(entity.getProductName())
                .description(entity.getDescription())
                .features(features)
                .logoUrl(entity.getLogoUrl())
                .redirectUrl(entity.getRedirectUrl())
                .build();
    }
    
    /**
     * DTO 데이터 검증 및 정리
     */
    private InsuranceProductDto sanitizeDto(InsuranceProductDto dto) {
        if (dto == null) {
            throw new IllegalArgumentException("InsuranceProductDto는 null이 될 수 없습니다.");
        }
        
        // 회사명 검증
        String company = dto.getCompany();
        if (company == null || company.trim().isEmpty()) {
            throw new IllegalArgumentException("보험사명은 필수입니다.");
        }
        company = company.trim().substring(0, Math.min(company.length(), 100));
        
        // 상품명 검증 및 정리
        String productName = dto.getProductName();
        if (productName == null || productName.trim().isEmpty()) {
            productName = company + " 펫보험";
        }
        productName = sanitizeProductName(productName);
        
        // 설명 정리
        String description = dto.getDescription();
        if (description == null || description.trim().isEmpty()) {
            description = company + " 펫보험 상품";
        }
        description = sanitizeDescription(description);
        
        // 리다이렉트 URL 정리
        String redirectUrl = dto.getRedirectUrl();
        if (redirectUrl != null && redirectUrl.length() > 500) {
            redirectUrl = redirectUrl.substring(0, 500);
        }
        
        return InsuranceProductDto.builder()
                .id(dto.getId())
                .company(company)
                .productName(productName)
                .description(description)
                .features(dto.getFeatures())
                .logoUrl(dto.getLogoUrl())
                .redirectUrl(redirectUrl)
                .build();
    }
    
    private String sanitizeProductName(String productName) {
        if (productName == null) return "펫보험 상품";
        
        productName = productName.trim();
        
        // 특수 문자 및 불필요한 텍스트 제거
        productName = productName.replaceAll("[|].*$", ""); // | 이후 텍스트 제거
        productName = productName.replaceAll("\\s*\\([^)]*\\)\\s*", ""); // 괄호 내용 제거
        productName = productName.replaceAll("\\s*\\[[^\\]]*\\]\\s*", ""); // 대괄호 내용 제거
        productName = productName.replaceAll("\\s+", " "); // 연속 공백 정리
        productName = productName.trim();
        
        // 길이 제한 (DB 필드 길이보다 여유있게)
        if (productName.length() > 450) {
            productName = productName.substring(0, 450).trim();
            // 마지막 단어가 잘린 경우 마지막 공백까지만 유지
            int lastSpace = productName.lastIndexOf(' ');
            if (lastSpace > 200) { // 최소 길이 확보
                productName = productName.substring(0, lastSpace);
            }
            productName = productName.trim() + "...";
        }
        
        return productName;
    }
    
    private String sanitizeDescription(String description) {
        if (description == null) return "펫보험 상품 정보";
        
        description = description.trim();
        description = description.replaceAll("\\s+", " "); // 연속 공백 정리
        
        // 길이 제한 (DB 필드 길이보다 여유있게)
        if (description.length() > 950) {
            description = description.substring(0, 950).trim();
            // 마지막 단어가 잘린 경우 마지막 공백까지만 유지
            int lastSpace = description.lastIndexOf(' ');
            if (lastSpace > 400) { // 최소 길이 확보
                description = description.substring(0, lastSpace);
            }
            description = description.trim() + "...";
        }
        
        return description;
    }
}

