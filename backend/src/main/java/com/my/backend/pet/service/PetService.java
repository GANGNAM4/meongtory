package com.my.backend.pet.service;

import com.my.backend.pet.entity.Pet;
import com.my.backend.pet.repository.PetRepository;
import com.my.backend.s3.S3Service;
import com.my.backend.visitReservation.repository.AdoptionRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class PetService {
    
    private final PetRepository petRepository;
    private final S3Service s3Service;
    private final AdoptionRequestRepository adoptionRequestRepository;
    
    // 통합된 펫 조회 (모든 필터링 지원)
    public List<Pet> getAllPets() {
        return petRepository.findAll();
    }
    
    // 필터링된 펫 조회 (통합)
    public List<Pet> getPetsWithFilters(String name, String breed, Pet.Gender gender, 
                                       Boolean adopted, Boolean vaccinated, Boolean neutered,
                                       String status, String type, String location,
                                       Integer minAge, Integer maxAge, Integer limit, Long lastId) {
        // TODO: 실제 필터링 로직 구현
        return petRepository.findPetsWithFilters();
    }
    

    
    // 펫 상세 조회
    public Optional<Pet> getPetById(Long petId) {
        return petRepository.findById(petId);
    }
    

    
    // 펫 등록
    @Transactional
    public Pet createPet(Pet pet) {
        
        // 이미지가 Base64 형태로 전달된 경우 S3에 업로드
        if (pet.getImageUrl() != null && pet.getImageUrl().startsWith("data:")) {
            try {
                // Base64 이미지를 S3에 업로드하고 URL 반환
                String s3ImageUrl = s3Service.uploadBase64Image(pet.getImageUrl());
                pet.setImageUrl(s3ImageUrl);
            } catch (Exception e) {
                log.error("S3 업로드 실패: {}", e.getMessage());
                e.printStackTrace();
                // S3 업로드 실패 시 기본 이미지 사용
                pet.setImageUrl("/placeholder.svg?height=300&width=300");
            }
        } else {
            log.info("Base64 이미지가 아님 - S3 업로드 건너뜀");
        }
        
        return petRepository.save(pet);
    }
    
    // 펫 정보 수정
    @Transactional
    public Pet updatePet(Long petId, Pet petDetails) {
        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new RuntimeException("Pet not found with id: " + petId));
        
        // 기존 이미지 URL 저장
        String oldImageUrl = pet.getImageUrl();
        
        pet.setName(petDetails.getName());
        pet.setBreed(petDetails.getBreed());
        pet.setAge(petDetails.getAge());
        pet.setGender(petDetails.getGender());
        pet.setVaccinated(petDetails.getVaccinated());
        pet.setDescription(petDetails.getDescription());
        pet.setAdopted(petDetails.getAdopted());
        pet.setWeight(petDetails.getWeight());
        pet.setLocation(petDetails.getLocation());
        pet.setMicrochipId(petDetails.getMicrochipId());
        pet.setMedicalHistory(petDetails.getMedicalHistory());
        pet.setVaccinations(petDetails.getVaccinations());
        pet.setNotes(petDetails.getNotes());
        pet.setSpecialNeeds(petDetails.getSpecialNeeds());
        pet.setPersonality(petDetails.getPersonality());
        pet.setRescueStory(petDetails.getRescueStory());
        pet.setAiBackgroundStory(petDetails.getAiBackgroundStory());
        pet.setStatus(petDetails.getStatus());
        pet.setType(petDetails.getType());
        pet.setNeutered(petDetails.getNeutered());
        
        // 이미지가 Base64 형태로 전달된 경우 S3에 업로드
        if (petDetails.getImageUrl() != null && petDetails.getImageUrl().startsWith("data:")) {
            try {
                // Base64 이미지를 S3에 업로드하고 URL 반환
                String s3ImageUrl = s3Service.uploadBase64Image(petDetails.getImageUrl());
                pet.setImageUrl(s3ImageUrl);
                
                // 기존 S3 이미지가 있으면 삭제 (입양 펫용)
                if (oldImageUrl != null && oldImageUrl.startsWith("https://")) {
                    try {
                        String fileName = oldImageUrl.substring(oldImageUrl.lastIndexOf("/") + 1);
                        s3Service.deleteAdoptionPetImage(fileName);
                    } catch (Exception e) {
                        log.error("기존 입양 펫 S3 이미지 삭제 실패: {}", e.getMessage());
                    }
                }
            } catch (Exception e) {
                log.error("S3 업로드 실패: {}", e.getMessage());
                e.printStackTrace();
                // S3 업로드 실패 시 기존 이미지 유지
                pet.setImageUrl(oldImageUrl);
            }
        } else if (petDetails.getImageUrl() != null) {
            // Base64가 아닌 경우 그대로 설정
            pet.setImageUrl(petDetails.getImageUrl());
            log.info("Base64 이미지가 아님 - S3 업로드 건너뜀");
        } else {
            // imageUrl이 null인 경우 기존 이미지 유지
            log.info("imageUrl이 null - 기존 이미지 유지: {}", oldImageUrl);
        }
        return petRepository.save(pet);
    }
    
    // 펫 이미지 URL 업데이트
    @Transactional
    public Pet updatePetImageUrl(Long petId, String imageUrl) {
        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new RuntimeException("Pet not found with id: " + petId));
        
        pet.setImageUrl(imageUrl);
        
        return petRepository.save(pet);
    }
    
    // 펫 입양 상태 변경
    @Transactional
    public Pet updateAdoptionStatus(Long petId, Boolean adopted) {
        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new RuntimeException("Pet not found with id: " + petId));
        
        pet.setAdopted(adopted);
        return petRepository.save(pet);
    }
    
    // 펫 삭제
    @Transactional
    public void deletePet(Long petId) {
        Pet pet = petRepository.findById(petId)
                .orElseThrow(() -> new RuntimeException("Pet not found with id: " + petId));
        
        
        // 관련된 입양신청들 먼저 삭제
        try {
            // 해당 펫에 대한 모든 입양신청 삭제
            int deletedRequests = adoptionRequestRepository.deleteByPetId(petId);
        } catch (Exception e) {
            log.error("입양신청 삭제 중 오류: {}", e.getMessage());
            throw new RuntimeException("입양신청 삭제 중 오류가 발생했습니다: " + e.getMessage());
        }
        
        // S3 이미지 삭제 (입양 펫용)
        if (pet.getImageUrl() != null && pet.getImageUrl().startsWith("https://")) {
            try {
                // URL에서 파일명 추출
                String fileName = pet.getImageUrl().substring(pet.getImageUrl().lastIndexOf("/") + 1);
                s3Service.deleteAdoptionPetImage(fileName);
            } catch (Exception e) {
                log.error("입양 펫 S3 이미지 삭제 실패: {}", e.getMessage());
                // 삭제 실패해도 계속 진행
            }
        }
        
        petRepository.delete(pet);
    }
} 