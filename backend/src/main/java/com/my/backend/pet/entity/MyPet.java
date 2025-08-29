package com.my.backend.pet.entity;

import com.my.backend.account.entity.Account;
import com.my.backend.account.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "my_pet")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = false)
public class MyPet extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "my_pet_id")
    private Long myPetId;

    // Account와의 관계 설정
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id", nullable = false)
    private Account owner;

    @Column(name = "name", nullable = false)
    private String name;

    @Column(name = "breed")
    private String breed;

    @Column(name = "age")
    private Integer age;

    @Enumerated(EnumType.STRING)
    @Column(name = "gender")
    private Gender gender;

    @Column(name = "type")
    private String type; // 강아지, 고양이 등

    @Column(name = "weight")
    private Double weight;

    @Column(name = "image_url")
    private String imageUrl; // 이미지 URL 저장

    @Builder.Default
    @Column(name = "vaccinated")
    private Boolean vaccinated = false;

    @Builder.Default
    @Column(name = "neutered")
    private Boolean neutered = false;

    // 의료기록 관련 필드들 추가
    @Column(name = "medical_history", columnDefinition = "TEXT")
    private String medicalHistory;
    
    @Column(name = "vaccinations", columnDefinition = "TEXT")
    private String vaccinations;
    
    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;
    
    @Column(name = "microchip_id")
    private String microchipId;
    
    @Column(name = "special_needs", columnDefinition = "TEXT")
    private String specialNeeds;

    public enum Gender {
        MALE, FEMALE, UNKNOWN
    }
} 