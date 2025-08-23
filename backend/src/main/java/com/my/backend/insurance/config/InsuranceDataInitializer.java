package com.my.backend.insurance.config;

import com.my.backend.insurance.dto.InsuranceProductDto;
import com.my.backend.insurance.service.InsuranceService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
@RequiredArgsConstructor
public class InsuranceDataInitializer {

    private final InsuranceService insuranceService;

    @PostConstruct
    public void init() {
        if (insuranceService.findAll().isEmpty()) {
            insuranceService.upsert(InsuranceProductDto.builder()
                    .company("삼성화재")
                    .productName("펫보험 기본형")
                    .description("반려동물 기본적인 치료비를 보장합니다")
                    .features(List.of("입원비/수술비 최대 1000만 원", "진료비 보장률 70%까지 선택가능", "특진료비보장(응급실 등) 응급시 더안전하게"))
                    .logoUrl("")
                    .redirectUrl("https://www.samsungfire.com/")
                    .build());
        }
    }
}

