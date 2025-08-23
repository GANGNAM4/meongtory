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
        InsuranceProduct entity = repository.findByCompanyAndProductName(dto.getCompany(), dto.getProductName())
                .orElse(new InsuranceProduct());

        // 엔티티 업데이트
        entity.setCompany(dto.getCompany());
        entity.setProductName(dto.getProductName());
        entity.setDescription(dto.getDescription());
        entity.setFeatures(String.join(",", dto.getFeatures() != null ? dto.getFeatures() : List.of()));
        entity.setRedirectUrl(dto.getRedirectUrl());

        // 로고가 없거나 placeholder인 경우 크롤링 시도
        if (entity.getLogoUrl() == null || entity.getLogoUrl().isEmpty() || entity.getLogoUrl().contains("placeholder")) {
            String crawledLogo = logoService.crawlAndProcessLogo(dto.getCompany());
            if (crawledLogo != null) {
                entity.setLogoUrl(crawledLogo);
                entity.setLogoVersion(entity.getLogoVersion() != null ? entity.getLogoVersion() + 1 : 1);
                entity.setLogoUpdatedAt(java.time.LocalDateTime.now());
            }
        }

        InsuranceProduct saved = repository.save(entity);
        return toDto(saved);
    }

    /**
     * 모든 보험사의 로고를 크롤링하여 업데이트
     */
    @Transactional
    public void updateAllLogos() {
        List<InsuranceProduct> allProducts = repository.findAll();
        int updatedCount = 0;
        
        for (InsuranceProduct product : allProducts) {
            String crawledLogo = logoService.crawlAndProcessLogo(product.getCompany());
            if (crawledLogo != null) {
                product.setLogoUrl(crawledLogo);
                product.setLogoVersion(product.getLogoVersion() != null ? product.getLogoVersion() + 1 : 1);
                product.setLogoUpdatedAt(java.time.LocalDateTime.now());
                log.info("보험사 로고 업데이트 성공: {}", product.getCompany());
                updatedCount++;
            } else {
                log.warn("보험사 로고 크롤링 실패: {}", product.getCompany());
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
}

