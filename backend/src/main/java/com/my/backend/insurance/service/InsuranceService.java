package com.my.backend.insurance.service;

import com.my.backend.insurance.dto.InsuranceProductDto;
import com.my.backend.insurance.entity.InsuranceProduct;
import com.my.backend.insurance.repository.InsuranceProductRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class InsuranceService {

    private final InsuranceProductRepository repository;

    public List<InsuranceProductDto> findAll() {
        return repository.findAll().stream().map(this::toDto).collect(Collectors.toList());
    }

    public InsuranceProductDto findById(Long id) {
        return repository.findById(id).map(this::toDto).orElse(null);
    }

    @Transactional
    public InsuranceProductDto create(InsuranceProductDto dto) {
        InsuranceProduct entity = new InsuranceProduct();
        entity.setCompany(dto.getCompany());
        entity.setProductName(dto.getProductName());
        entity.setDescription(dto.getDescription());
        entity.setFeatures(String.join(",", dto.getFeatures() != null ? dto.getFeatures() : List.of()));
        entity.setLogoUrl(dto.getLogoUrl());
        entity.setRedirectUrl(dto.getRedirectUrl());
        InsuranceProduct saved = repository.save(entity);
        return toDto(saved);
    }

    private InsuranceProductDto toDto(InsuranceProduct entity) {
        List<String> features = entity.getFeatures() == null || entity.getFeatures().isBlank()
                ? List.of()
                : Arrays.asList(entity.getFeatures().split(","));
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

