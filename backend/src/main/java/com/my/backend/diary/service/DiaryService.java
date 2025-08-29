package com.my.backend.diary.service;

import com.my.backend.account.entity.Account;
import com.my.backend.account.repository.AccountRepository;
import com.my.backend.diary.dto.DiaryRequestDto;
import com.my.backend.diary.dto.DiaryResponseDto;
import com.my.backend.diary.dto.DiaryUpdateDto;
import com.my.backend.diary.entity.Diary;
import com.my.backend.diary.repository.DiaryRepository;
import com.my.backend.pet.entity.MyPet;
import com.my.backend.pet.repository.MyPetRepository;
import com.my.backend.s3.S3Service;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Slf4j
public class DiaryService {

    private final DiaryRepository diaryRepository;
    private final AccountRepository accountRepository;
    private final MyPetRepository myPetRepository;
    private final RestTemplate restTemplate;
    private final S3Service s3Service;
    private final ObjectMapper objectMapper;
    
    @Value("${ai.service.url}")
    private String aiServiceUrl;

    public DiaryResponseDto createDiary(DiaryRequestDto dto) {
        Account user = accountRepository.findById(dto.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        
        // MyPet 정보 가져오기 (petId가 제공된 경우)
        MyPet pet = null;
        if (dto.getPetId() != null) {
            pet = myPetRepository.findByMyPetIdAndOwnerId(dto.getPetId(), dto.getUserId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Pet not found or not owned by user"));
        }
        
        Diary diary = new Diary();
        diary.setUser(user);
        diary.setPet(pet);
        diary.setTitle(dto.getTitle());
        diary.setText(dto.getText());
        diary.setAudioUrl(dto.getAudioUrl());
        diary.setImageUrl(dto.getImageUrl());

        // 텍스트 및 이미지 기반 카테고리 분류
        String[] textCategories = classifyDiaryContent(dto.getText());
        String[] imageCategories = classifyDiaryImage(dto.getImageUrl());
        // 카테고리 병합 (중복 제거)
        String[] categories = Stream.concat(
                Arrays.stream(textCategories),
                Arrays.stream(imageCategories)
        ).distinct().toArray(String[]::new);
        diary.setCategories(categories);

        return DiaryResponseDto.from(diaryRepository.save(diary));
    }

    public String uploadImage(MultipartFile imageFile) {
        try {
            // S3에 이미지 업로드 (/diary/images/ 폴더에 저장)
            String imageUrl = s3Service.uploadDiaryImage(imageFile.getOriginalFilename(), imageFile.getBytes());
            log.info("이미지 업로드 성공: {}", imageUrl);
            return imageUrl;
        } catch (Exception e) {
            log.error("이미지 업로드 중 오류 발생: {}", e.getMessage(), e);
            throw new RuntimeException("이미지 업로드 중 오류 발생: " + e.getMessage());
        }
    }

    // [수정] 이미지 기반 카테고리 분류: S3에서 다운로드 후 FastAPI 호출
    private String[] classifyDiaryImage(String imageUrl) {
        try {
            if (imageUrl == null || imageUrl.trim().isEmpty()) {
                return new String[0];
            }

            // S3에서 이미지 다운로드
            byte[] imageBytes = s3Service.downloadFile(imageUrl);
            log.info("File downloaded successfully from S3: {} ({} bytes)", imageUrl, imageBytes.length);

            String classifyUrl = aiServiceUrl + "/classify-image";
            log.info("이미지 분류 시작 - AI 서비스 URL: {}", classifyUrl);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new ByteArrayResource(imageBytes) {
                @Override
                public String getFilename() {
                    return imageUrl.substring(imageUrl.lastIndexOf("/") + 1);
                }
            });

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                    classifyUrl,
                    requestEntity,
                    Map.class
            );

            log.info("AI 서비스 응답 - 상태 코드: {}, 응답 본문: {}", response.getStatusCode(), response.getBody());

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                // [수정] AI 응답에서 category 추출 및 한국어 태그로 매핑
                Map<String, Object> clipResult = (Map<String, Object>) response.getBody().get("clip_result");
                String category = (String) clipResult.get("category");

                // 영어 카테고리를 한국어 태그로 변환
                Map<String, String> categoryToTag = new HashMap<>();
                categoryToTag.put("dog medicine", "약");
                categoryToTag.put("dog food", "사료");
                categoryToTag.put("dog toy", "장난감");
                categoryToTag.put("dog clothing", "옷");
                categoryToTag.put("dog accessory", "용품");
                categoryToTag.put("dog treat", "간식");

                String koreanTag = categoryToTag.getOrDefault(category, "기타");
                log.info("이미지 분류 성공 - 영어 카테고리: {}, 한국어 태그: {}", category, koreanTag);
                return new String[]{koreanTag};
            } else {
                log.error("AI 서비스에서 이미지 분류 실패 - 상태 코드: {}", response.getStatusCode());
                return new String[0];
            }
        } catch (Exception e) {
            log.error("이미지 분류 중 오류 발생: {}", e.getMessage(), e);
            return new String[0];
        }
    }


    public DiaryResponseDto getDiary(Long id) {
        Diary diary = diaryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Diary not found"));

        if (diary.getIsDeleted()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Diary not found");
        }

        return DiaryResponseDto.from(diary);
    }

    public List<DiaryResponseDto> getUserDiaries(Long userId) {
        Account user = accountRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        return diaryRepository.findByUserAndIsDeletedFalseOrderByCreatedAtDesc(user).stream()
                .map(DiaryResponseDto::from)
                .collect(Collectors.toList());
    }

    public List<DiaryResponseDto> getAllDiaries() {
        return diaryRepository.findByIsDeletedFalseOrderByCreatedAtDesc().stream()
                .map(DiaryResponseDto::from)
                .collect(Collectors.toList());
    }

    public DiaryResponseDto updateDiary(Long id, DiaryUpdateDto dto, Long currentUserId, String userRole) {
        Diary diary = diaryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Diary not found"));

        if (diary.getIsDeleted()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Diary not found");
        }

        // 관리자가 아니고 본인의 일기가 아닌 경우 수정 불가
        if (!"ADMIN".equals(userRole) && !diary.getUser().getId().equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only update your own diary");
        }

        diary.setTitle(dto.getTitle());
        diary.setText(dto.getText());
        diary.setAudioUrl(dto.getAudioUrl());
        diary.setImageUrl(dto.getImageUrl());

        // 내용이 변경된 경우 카테고리 재분류
        String[] categories = classifyDiaryContent(dto.getText());
        diary.setCategories(categories);

        return DiaryResponseDto.from(diaryRepository.save(diary));
    }

    public void deleteDiary(Long id, Long currentUserId, String userRole) {
        Diary diary = diaryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "다이어리를 찾을 수 없습니다."));

        if (diary.getIsDeleted()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "다이어리를 찾을 수 없습니다.");
        }

        // 관리자가 아니고 본인의 일기가 아닌 경우 삭제 불가
        if (!"ADMIN".equals(userRole) && !diary.getUser().getId().equals(currentUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only delete your own diary");
        }

        diaryRepository.delete(diary);
    }

    public String transcribeAudio(MultipartFile audioFile) {
        try {
            // AI 서비스 URL 구성
            String transcribeUrl = aiServiceUrl + "/transcribe";
            log.info("음성 변환 시작 - AI 서비스 URL: {}", transcribeUrl);
            log.info("음성 파일 정보 - 이름: {}, 크기: {} bytes", audioFile.getOriginalFilename(), audioFile.getSize());

            // 헤더 설정
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);

            // 파일 데이터 설정
            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("file", new org.springframework.core.io.ByteArrayResource(audioFile.getBytes()) {
                @Override
                public String getFilename() {
                    return audioFile.getOriginalFilename();
                }
            });

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            log.info("AI 서비스로 요청 전송 중...");

            // AI 서비스 호출
            ResponseEntity<TranscribeResponse> response = restTemplate.postForEntity(
                transcribeUrl,
                requestEntity,
                TranscribeResponse.class
            );

            log.info("AI 서비스 응답 - 상태 코드: {}, 응답 본문: {}", response.getStatusCode(), response.getBody());

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                String transcribedText = response.getBody().getTranscript();
                log.info("음성 변환 성공 - 변환된 텍스트: {}", transcribedText);
                return transcribedText;
            } else {
                log.error("AI 서비스에서 음성 변환 실패 - 상태 코드: {}", response.getStatusCode());
                throw new RuntimeException("AI 서비스에서 음성 변환 실패");
            }

        } catch (Exception e) {
            log.error("음성 변환 중 오류 발생: {}", e.getMessage(), e);
            throw new RuntimeException("음성 변환 중 오류 발생: " + e.getMessage());
        }
    }

    public String uploadAudio(MultipartFile audioFile) {
        try {
            // 오디오 파일을 S3에 업로드 (/diary/audio/ 폴더에 저장)
            String audioUrl = s3Service.uploadDiaryAudio(audioFile.getOriginalFilename(), audioFile.getBytes());
            return audioUrl;
        } catch (Exception e) {
            throw new RuntimeException("오디오 업로드 중 오류 발생: " + e.getMessage());
        }
    }

    // 카테고리 분류 메서드
    private String[] classifyDiaryContent(String content) {
        try {
            if (content == null || content.trim().isEmpty()) {
                return new String[0];
            }

            // AI 서비스 URL 구성
            String classifyUrl = aiServiceUrl + "/classify-category";
            log.info("카테고리 분류 시작 - AI 서비스 URL: {}", classifyUrl);

            // 요청 데이터 구성
            CategoryClassificationRequest request = new CategoryClassificationRequest();
            request.setContent(content);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<CategoryClassificationRequest> requestEntity = new HttpEntity<>(request, headers);

            log.info("AI 서비스로 카테고리 분류 요청 전송 중...");

            // AI 서비스 호출
            ResponseEntity<CategoryClassificationResponse> response = restTemplate.postForEntity(
                classifyUrl,
                requestEntity,
                CategoryClassificationResponse.class
            );

            log.info("AI 서비스 응답 - 상태 코드: {}, 응답 본문: {}", response.getStatusCode(), response.getBody());

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                String[] categories = response.getBody().getCategories();
                log.info("카테고리 분류 성공 - 분류된 카테고리: {}", (Object) categories);
                return categories != null ? categories : new String[0];
            } else {
                log.error("AI 서비스에서 카테고리 분류 실패 - 상태 코드: {}", response.getStatusCode());
                return new String[0];
            }

        } catch (Exception e) {
            log.error("카테고리 분류 중 오류 발생: {}", e.getMessage(), e);
            return new String[0];
        }
    }

    // 카테고리별 일기 조회 메서드
    public List<DiaryResponseDto> getDiariesByCategory(String category, Long userId, String userRole) {
        if ("ADMIN".equals(userRole)) {
            return diaryRepository.findByCategory(category).stream()
                    .map(DiaryResponseDto::from)
                    .collect(Collectors.toList());
        } else {
            return diaryRepository.findByCategoryAndUser(category, userId).stream()
                    .map(DiaryResponseDto::from)
                    .collect(Collectors.toList());
        }
    }

    // 카테고리 분류 요청 DTO
    public static class CategoryClassificationRequest {
        private String content;

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }
    }

    // 카테고리 분류 응답 DTO
    public static class CategoryClassificationResponse {
        private String[] categories;

        public String[] getCategories() {
            return categories;
        }

        public void setCategories(String[] categories) {
            this.categories = categories;
        }
    }

    // 음성 변환 응답 DTO
    public static class TranscribeResponse {
        private String transcript;

        public String getTranscript() {
            return transcript;
        }

        public void setTranscript(String transcript) {
            this.transcript = transcript;
        }
    }
}
