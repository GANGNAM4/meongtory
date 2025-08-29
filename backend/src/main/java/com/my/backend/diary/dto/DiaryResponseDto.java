package com.my.backend.diary.dto;

import com.my.backend.diary.entity.Diary;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Getter
@Setter
@Builder
public class DiaryResponseDto {
    private Long diaryId;
    private Long userId;
    private Long petId; // MyPet의 ID 추가
    private String petName; // MyPet의 이름 추가
    private String title;
    private String text;
    private String audioUrl;
    private String imageUrl;
    private String[] categories;
    private String createdAt;
    private String updatedAt;

    public static DiaryResponseDto from(Diary diary) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");
        
        // getUser()가 null일 수 있는 경우 처리
        Long userId = null;
        if (diary.getUser() != null) {
            userId = diary.getUser().getId();
        }
        
        // getPet()이 null일 수 있는 경우 처리
        Long petId = null;
        String petName = null;
        if (diary.getPet() != null) {
            petId = diary.getPet().getMyPetId();
            petName = diary.getPet().getName();
        }
        
        return DiaryResponseDto.builder()
                .diaryId(diary.getDiaryId())
                .userId(userId)
                .petId(petId)
                .petName(petName)
                .title(diary.getTitle())
                .text(diary.getText())
                .audioUrl(diary.getAudioUrl())
                .imageUrl(diary.getImageUrl())
                .categories(diary.getCategories())
                .createdAt(diary.getCreatedAt() != null ? diary.getCreatedAt().format(formatter) : null)
                .updatedAt(diary.getUpdatedAt() != null ? diary.getUpdatedAt().format(formatter) : null)
                .build();
    }
}
