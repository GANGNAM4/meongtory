package com.my.backend.emotion.service;

import com.my.backend.emotion.dto.EmotionAnalysisResponseDto;
import com.my.backend.emotion.dto.EmotionFeedbackRequestDto;
import com.my.backend.emotion.dto.EmotionFeedbackStatsDto;
import com.my.backend.emotion.dto.FeedbackForTrainingDto;
import com.my.backend.emotion.entity.EmotionFeedback;
import com.my.backend.emotion.repository.EmotionFeedbackRepository;
import com.my.backend.s3.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EmotionService {
    
    private final RestTemplate restTemplate;
    private final EmotionFeedbackRepository feedbackRepository;
    private final S3Service s3Service;
    
    @Value("${ai.service.url}")
    private String aiServiceUrl;
    
    // === 감정 분석 기능 ===
    public EmotionAnalysisResponseDto analyzeEmotion(MultipartFile image) throws Exception {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.MULTIPART_FORM_DATA);
        
        MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
        body.add("image", new ByteArrayResource(image.getBytes()) {
            @Override
            public String getFilename() {
                return image.getOriginalFilename();
            }
        });
        
        HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
        
        ResponseEntity<EmotionAnalysisResponseDto> response = restTemplate.postForEntity(
            aiServiceUrl + "/api/ai/analyze-emotion",
            requestEntity,
            EmotionAnalysisResponseDto.class
        );
        
        return response.getBody();
    }
    
    // === 피드백 저장 기능 (이미지 포함) ===
    @Transactional
    public void saveFeedback(EmotionFeedbackRequestDto request, MultipartFile imageFile) throws Exception {
        // 이미지를 S3에 업로드 (emotion 전용 폴더에 저장)
        String imageUrl;
        if (imageFile != null && !imageFile.isEmpty()) {
            // S3에 emotion 피드백 이미지 업로드 
            imageUrl = uploadEmotionFeedbackImage(imageFile);
        } else {
            // 이미지가 없는 경우 요청에서 받은 URL 사용 (기존 호환성)
            imageUrl = request.getImageUrl();
        }
        
        // EmotionFeedback 엔티티 생성
        EmotionFeedback feedback = new EmotionFeedback();
        feedback.setImageUrl(imageUrl);
        feedback.setPredictedEmotion(request.getPredictedEmotion());
        feedback.setCorrectEmotion(request.getCorrectEmotion());
        feedback.setIsCorrectPrediction(request.getIsCorrectPrediction());
        feedback.setPredictionConfidence(request.getPredictionConfidence());
        feedback.setIsUsedForTraining(false);
        
        feedbackRepository.save(feedback);
    }
    
    // 감정 피드백 이미지를 S3에 업로드
    private String uploadEmotionFeedbackImage(MultipartFile imageFile) throws Exception {
        try {
            // S3Service의 감정 피드백 전용 업로드 메서드 사용
            return s3Service.uploadEmotionFeedbackImage(imageFile);
        } catch (Exception e) {
            throw new Exception("감정 피드백 이미지 업로드 실패: " + e.getMessage());
        }
    }
    
    // === AI 서비스용: 재학습 데이터 제공 ===
    @Transactional(readOnly = true)
    public FeedbackForTrainingDto getFeedbackForTraining() {
        // 아직 학습에 사용되지 않은 피드백들 조회
        List<EmotionFeedback> unusedFeedbacks = feedbackRepository.findByIsUsedForTrainingFalse();
        
        // 긍정 피드백 (올바른 예측들)
        List<FeedbackForTrainingDto.TrainingDataItem> positiveFeedback = unusedFeedbacks.stream()
            .filter(EmotionFeedback::getIsCorrectPrediction)
            .map(feedback -> new FeedbackForTrainingDto.TrainingDataItem(
                feedback.getImageUrl(),
                feedback.getPredictedEmotion(), // 예측이 맞았으므로 예측값 사용
                feedback.getPredictionConfidence()
            ))
            .collect(Collectors.toList());
        
        // 부정 피드백 (틀린 예측들)
        List<FeedbackForTrainingDto.TrainingDataItem> negativeFeedback = unusedFeedbacks.stream()
            .filter(feedback -> !feedback.getIsCorrectPrediction())
            .map(feedback -> new FeedbackForTrainingDto.TrainingDataItem(
                feedback.getImageUrl(),
                feedback.getCorrectEmotion(), // 사용자가 수정한 올바른 라벨 사용
                feedback.getPredictionConfidence()
            ))
            .collect(Collectors.toList());
        
        return new FeedbackForTrainingDto(
            positiveFeedback,
            negativeFeedback,
            unusedFeedbacks.size()
        );
    }
    
    // === AI 서비스에 재학습 요청 ===
    @Transactional
    public String startModelRetraining() throws Exception {
        try {
            // 재학습 가능 여부 확인
            EmotionFeedbackStatsDto stats = getFeedbackStats();
            if (!stats.getShouldRetrain()) {
                throw new Exception("재학습할 데이터가 부족합니다 (최소 10개 필요)");
            }
            
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            
            // 재학습 요청 본문 생성 (AI 서비스에서 기대하는 RetrainRequest 형식)
            String requestBody = "{\"min_feedback_count\": 10}";
            HttpEntity<String> requestEntity = new HttpEntity<>(requestBody, headers);
            
            // AI 서비스에 재학습 요청 (감정 분석과 동일한 방식)
            ResponseEntity<String> response = restTemplate.postForEntity(
                aiServiceUrl + "/api/ai/retrain-emotion-model",
                requestEntity,
                String.class
            );
            
            if (response.getStatusCode().is2xxSuccessful()) {
                System.out.println("✅ AI 서비스 재학습 요청 성공");
                return response.getBody();
            } else {
                throw new Exception("AI 서비스 재학습 요청 실패: " + response.getStatusCode());
            }
            
        } catch (Exception e) {
            System.err.println("❌ AI 서비스 재학습 요청 실패: " + e.getMessage());
            throw new Exception("모델 재학습 시작 실패: " + e.getMessage());
        }
    }
    
    // === 피드백 사용 완료 표시 기능 ===
    @Transactional
    public void markUnusedFeedbackAsUsed() {
        // 아직 학습에 사용되지 않은 피드백들을 모두 사용됨으로 표시
        List<EmotionFeedback> unusedFeedbacks = feedbackRepository.findByIsUsedForTrainingFalse();
        
        for (EmotionFeedback feedback : unusedFeedbacks) {
            feedback.setIsUsedForTraining(true);
        }
        
        feedbackRepository.saveAll(unusedFeedbacks);
        
        // 로그 출력
        System.out.println("✅ " + unusedFeedbacks.size() + "개 피드백을 학습 사용 완료로 표시했습니다.");
    }
    
    // === 대시보드용: 피드백 통계 조회 ===
    @Transactional(readOnly = true)
    public EmotionFeedbackStatsDto getFeedbackStats() {
        // 전체 피드백 수
        Long totalFeedback = feedbackRepository.count();
        
        // 정확한/부정확한 예측 수
        Long correctPredictions = feedbackRepository.countByIsCorrectPredictionTrue();
        Long incorrectPredictions = feedbackRepository.countByIsCorrectPredictionFalse();
        
        // 재학습용 미사용 피드백 수
        Long unusedPositiveFeedback = feedbackRepository.countByIsCorrectPredictionTrueAndIsUsedForTrainingFalse();
        Long unusedNegativeFeedback = feedbackRepository.countByIsCorrectPredictionFalseAndIsUsedForTrainingFalse();
        
        // 전체 정확도 계산 (%)
        Double overallAccuracy = totalFeedback > 0 ? 
            (correctPredictions.doubleValue() / totalFeedback.doubleValue()) * 100.0 : 0.0;
        
        // 재학습 필요 여부 (미사용 피드백이 10개 이상인경우)
        Boolean shouldRetrain = (unusedPositiveFeedback + unusedNegativeFeedback) >= 10;
        
        return new EmotionFeedbackStatsDto(
            unusedPositiveFeedback,
            unusedNegativeFeedback,
            shouldRetrain,
            totalFeedback,
            correctPredictions,
            incorrectPredictions,
            Math.round(overallAccuracy * 100.0) / 100.0 // 소수점 2자리까지
        );
    }
}
