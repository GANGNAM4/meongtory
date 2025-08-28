package com.my.backend.emotion.controller;

import lombok.RequiredArgsConstructor;
import com.my.backend.emotion.dto.EmotionAnalysisResponseDto;
import com.my.backend.emotion.dto.EmotionFeedbackRequestDto;
import com.my.backend.emotion.dto.EmotionFeedbackStatsDto;
import com.my.backend.emotion.dto.FeedbackForTrainingDto;
import com.my.backend.emotion.service.EmotionService;
import com.my.backend.global.dto.ResponseDto;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/emotion")
@RequiredArgsConstructor
@CrossOrigin(origins = "*")
public class EmotionController {
    
    private final EmotionService emotionService;
    
    // === 감정 분석 API ===
    @PostMapping("/analyze")
    public ResponseEntity<ResponseDto<EmotionAnalysisResponseDto>> analyzeEmotion(
            @RequestParam("image") MultipartFile image) {
        try {
            EmotionAnalysisResponseDto result = emotionService.analyzeEmotion(image);
            return ResponseEntity.ok(ResponseDto.success(result));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(ResponseDto.fail("EMOTION_ERROR", "감정 분석 실패: " + e.getMessage()));
        }
    }
    
    // === 피드백 관련 API ===
    
    // 1. 피드백 제출 (사용자용 - 이미지 필수)
    @PostMapping("/feedback")
    public ResponseEntity<ResponseDto<String>> submitFeedback(
            @RequestParam("predictedEmotion") String predictedEmotion,
            @RequestParam("isCorrectPrediction") Boolean isCorrectPrediction,
            @RequestParam("predictionConfidence") Float predictionConfidence,
            @RequestParam(value = "correctEmotion", required = false) String correctEmotion,
            @RequestParam("image") MultipartFile image) {
        try {
            // 이미지 필수 체크
            if (image == null || image.isEmpty()) {
                return ResponseEntity.badRequest()
                    .body(ResponseDto.fail("IMAGE_REQUIRED", "피드백 저장을 위해 이미지가 필요합니다"));
            }
            
            // DTO 생성
            EmotionFeedbackRequestDto feedbackRequest = new EmotionFeedbackRequestDto();
            feedbackRequest.setPredictedEmotion(predictedEmotion);
            feedbackRequest.setIsCorrectPrediction(isCorrectPrediction);
            feedbackRequest.setPredictionConfidence(predictionConfidence);
            feedbackRequest.setCorrectEmotion(correctEmotion);
            
            // S3에 이미지 업로드하고 피드백 저장
            emotionService.saveFeedback(feedbackRequest, image);
            
            return ResponseEntity.ok(ResponseDto.success("피드백이 저장되었습니다"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(ResponseDto.fail("FEEDBACK_ERROR", "피드백 저장 실패: " + e.getMessage()));
        }
    }
    
    // 2. 재학습용 피드백 데이터 제공 (AI 서비스용)
    @GetMapping("/feedback/training-data")
    public ResponseEntity<ResponseDto<FeedbackForTrainingDto>> getFeedbackForTraining() {
        try {
            FeedbackForTrainingDto result = emotionService.getFeedbackForTraining();
            return ResponseEntity.ok(ResponseDto.success(result));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(ResponseDto.fail("TRAINING_DATA_ERROR", "학습 데이터 조회 실패: " + e.getMessage()));
        }
    }
    
    // 3. 피드백을 학습에 사용됨으로 표시 (AI 서비스용)
    @PostMapping("/feedback/mark-as-used")
    public ResponseEntity<ResponseDto<String>> markFeedbackAsUsed() {
        try {
            emotionService.markUnusedFeedbackAsUsed();
            return ResponseEntity.ok(ResponseDto.success("피드백을 학습에 사용됨으로 표시했습니다"));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(ResponseDto.fail("MARK_USED_ERROR", "피드백 사용 표시 실패: " + e.getMessage()));
        }
    }
    
    // === 대시보드용 API ===
    
    // 4. 피드백 통계 조회 (관리자 대시보드용)
    @GetMapping("/feedback/stats")
    public ResponseEntity<ResponseDto<EmotionFeedbackStatsDto>> getFeedbackStats() {
        try {
            EmotionFeedbackStatsDto stats = emotionService.getFeedbackStats();
            return ResponseEntity.ok(ResponseDto.success(stats));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(ResponseDto.fail("STATS_ERROR", "피드백 통계 조회 실패: " + e.getMessage()));
        }
    }
    
    // === AI 모델 재학습 API ===
    
    // 5. AI 모델 재학습 시작 (관리자용)
    @PostMapping("/retrain")
    public ResponseEntity<ResponseDto<String>> startModelRetraining() {
        try {
            String result = emotionService.startModelRetraining();
            return ResponseEntity.ok(ResponseDto.success(result));
        } catch (Exception e) {
            return ResponseEntity.badRequest()
                .body(ResponseDto.fail("RETRAIN_ERROR", "모델 재학습 시작 실패: " + e.getMessage()));
        }
    }
}
