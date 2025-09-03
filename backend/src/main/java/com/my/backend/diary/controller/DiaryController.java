package com.my.backend.diary.controller;

import com.my.backend.diary.dto.DiaryRequestDto;
import com.my.backend.diary.dto.DiaryResponseDto;
import com.my.backend.diary.dto.DiaryUpdateDto;
import com.my.backend.diary.service.DiaryService;
import com.my.backend.global.security.user.UserDetailsImpl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.List;

@RestController
@RequestMapping("/api/diary")
@RequiredArgsConstructor
@Slf4j
public class DiaryController {

    private final DiaryService diaryService;

    @PostMapping
    public ResponseEntity<DiaryResponseDto> createDiary(@RequestBody DiaryRequestDto dto) {
        return ResponseEntity.ok(diaryService.createDiary(dto));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DiaryResponseDto> getDiary(@PathVariable Long id) {
        return ResponseEntity.ok(diaryService.getDiary(id));
    }

    @GetMapping
    public ResponseEntity<Page<DiaryResponseDto>> getDiaries(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "7") int size,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "latest") String sort,
            @RequestParam(required = false) String date) {
        
        // 현재 로그인한 사용자 정보 가져오기
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        Long userId = userDetails.getAccount().getId();
        String userRole = userDetails.getAccount().getRole();
        
        // 정렬 기준 설정 (기본값: latest -> createdAt DESC)
        Sort sortObj;
        if ("latest".equals(sort)) {
            sortObj = Sort.by(Sort.Direction.DESC, "createdAt");
        } else if ("oldest".equals(sort)) {
            sortObj = Sort.by(Sort.Direction.ASC, "createdAt");
        } else {
            // 기본값은 latest
            sortObj = Sort.by(Sort.Direction.DESC, "createdAt");
        }
        
        Pageable pageable = PageRequest.of(page, size, sortObj);
        Page<DiaryResponseDto> result;
        
        // 날짜 파라미터가 있으면 날짜별 조회
        if (date != null && !date.trim().isEmpty()) {
            result = diaryService.getDiariesByDateWithPaging(date, userId, userRole, pageable);
        }
        // 카테고리 파라미터가 있으면 카테고리별 조회
        else if (category != null && !category.trim().isEmpty()) {
            result = diaryService.getDiariesByCategory(category, userId, userRole, pageable);
        } else {
            // 관리자인 경우 모든 일기 반환, 일반 사용자는 자신의 일기만 반환
            if ("ADMIN".equals(userRole)) {
                result = diaryService.getAllDiariesWithPaging(pageable);
            } else {
                result = diaryService.getUserDiariesWithPaging(userId, pageable);
            }
        }
        
        return ResponseEntity.ok(result);
    }

    @GetMapping("/user/{userId}")
    public ResponseEntity<List<DiaryResponseDto>> getUserDiaries(@PathVariable Long userId) {
        return ResponseEntity.ok(diaryService.getUserDiaries(userId));
    }

    @PutMapping("/{id}")
    public ResponseEntity<DiaryResponseDto> updateDiary(@PathVariable Long id, @RequestBody DiaryUpdateDto dto) {
        // 현재 로그인한 사용자 정보 가져오기
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        Long currentUserId = userDetails.getAccount().getId();
        String userRole = userDetails.getAccount().getRole();
        
        try {
            DiaryResponseDto result = diaryService.updateDiary(id, dto, currentUserId, userRole);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            throw e;
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDiary(@PathVariable Long id) {
        // 현재 로그인한 사용자 정보 가져오기
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        Long currentUserId = userDetails.getAccount().getId();
        String userRole = userDetails.getAccount().getRole();
        
        diaryService.deleteDiary(id, currentUserId, userRole);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/voice")
    public ResponseEntity<String> transcribeVoice(@RequestParam("audio") MultipartFile audioFile) {
        try {
            String transcribedText = diaryService.transcribeAudio(audioFile);
            return ResponseEntity.ok(transcribedText);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("음성 변환에 실패했습니다: " + e.getMessage());
        }
    }

    @PostMapping("/audio")
    public ResponseEntity<String> uploadAudio(@RequestParam("file") MultipartFile audioFile) {
        try {
            String audioUrl = diaryService.uploadAudio(audioFile);
            return ResponseEntity.ok(audioUrl);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("오디오 업로드에 실패했습니다: " + e.getMessage());
        }
    }
    @PostMapping("/upload")
    public ResponseEntity<DiaryResponseDto> uploadDiary(
            @RequestParam("file") MultipartFile file,
            @RequestParam("title") String title,
            @RequestParam(value = "text", required = false) String text,
            @RequestParam(value = "audio", required = false) MultipartFile audioFile) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        UserDetailsImpl userDetails = (UserDetailsImpl) authentication.getPrincipal();
        Long userId = userDetails.getAccount().getId();

        DiaryRequestDto dto = new DiaryRequestDto();
        dto.setUserId(userId);
        dto.setTitle(title);
        dto.setText(text);

        if (audioFile != null && !audioFile.isEmpty()) {
            String audioUrl = diaryService.uploadAudio(audioFile);
            dto.setAudioUrl(audioUrl);
        }

        if (file != null && !file.isEmpty()) {
            String imageUrl = diaryService.uploadImage(file);
            dto.setImageUrl(imageUrl);
        }

        return ResponseEntity.ok(diaryService.createDiary(dto));
    }
}
