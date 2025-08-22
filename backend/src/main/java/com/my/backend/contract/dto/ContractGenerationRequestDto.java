package com.my.backend.contract.dto;

import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.List;
import java.util.Map;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ContractGenerationRequestDto {
    
    private Long templateId;
    private List<Map<String, Object>> templateSections; // 템플릿의 실제 조항들
    private List<Map<String, Object>> customSections; // 추가할 커스텀 조항들
    private List<Long> removedSections;
    private PetInfoDto petInfo;
    private UserInfoDto userInfo;
    private String additionalInfo;
    private String content; // AI가 생성한 계약서 내용
    private ShelterInfoDto shelterInfo; // 추가된 필드
    
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PetInfoDto {
        private Long petId; // petId 추가 (옵셔널)
        private String name;
        private String breed;
        private String age;
        private String gender;
        private String healthStatus;
        private Double weight;
        private Boolean vaccinated;
        private Boolean neutered;
    }
    
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class UserInfoDto {
        private String name;
        private String phone;
        private String email;
    }
    
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class ShelterInfoDto {
        private String name;
        private String representative;
        private String address;
        private String phone;
    }
} 