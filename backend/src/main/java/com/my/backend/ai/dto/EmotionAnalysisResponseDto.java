package com.my.backend.ai.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class EmotionAnalysisResponseDto {
    private String emotion;
    private String emotionKorean;
    private Double confidence;
    private Map<String, Double> emotions; // 모든 감정의 확률 분포
}