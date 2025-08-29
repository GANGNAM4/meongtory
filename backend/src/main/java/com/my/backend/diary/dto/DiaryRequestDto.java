package com.my.backend.diary.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DiaryRequestDto {
    private Long userId;
    private Long petId;
    private String title;
    private String text;
    private String audioUrl;
    private String imageUrl;
}
