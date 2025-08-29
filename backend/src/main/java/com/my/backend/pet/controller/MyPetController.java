package com.my.backend.pet.controller;

import com.my.backend.global.dto.ResponseDto;
import com.my.backend.global.security.user.UserDetailsImpl;
import com.my.backend.pet.dto.MyPetListResponseDto;
import com.my.backend.pet.dto.MyPetRequestDto;
import com.my.backend.pet.dto.MyPetResponseDto;
import com.my.backend.pet.dto.MyPetSearchDto;
import com.my.backend.pet.service.MyPetService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/mypet")
@RequiredArgsConstructor
public class MyPetController {

    private final MyPetService myPetService;

    // 펫 등록
    @PostMapping
    public ResponseEntity<ResponseDto<MyPetResponseDto>> registerMyPet(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestBody MyPetRequestDto requestDto) {
        try {
            Long ownerId = userDetails.getId();
            MyPetResponseDto response = myPetService.registerMyPet(ownerId, requestDto);
            return ResponseEntity.ok(ResponseDto.success(response));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDto.fail("ERROR", e.getMessage()));
        }
    }

    // 펫 수정
    @PutMapping("/{myPetId}")
    public ResponseEntity<ResponseDto<MyPetResponseDto>> updateMyPet(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long myPetId,
            @RequestBody MyPetRequestDto requestDto) {
        try {
            Long ownerId = userDetails.getId();
            MyPetResponseDto response = myPetService.updateMyPet(myPetId, ownerId, requestDto);
            return ResponseEntity.ok(ResponseDto.success(response));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDto.fail("ERROR", e.getMessage()));
        }
    }

    // 펫 삭제
    @DeleteMapping("/{myPetId}")
    public ResponseEntity<ResponseDto<Void>> deleteMyPet(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long myPetId) {
        try {
            Long ownerId = userDetails.getId();
            myPetService.deleteMyPet(myPetId, ownerId);
            return ResponseEntity.ok(ResponseDto.success(null));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDto.fail("ERROR", e.getMessage()));
        }
    }

    // 사용자의 모든 펫 조회
    @GetMapping
    public ResponseEntity<ResponseDto<MyPetListResponseDto>> getMyPets(
            @AuthenticationPrincipal UserDetailsImpl userDetails) {
        try {
            Long ownerId = userDetails.getId();
            MyPetListResponseDto response = myPetService.getMyPets(ownerId);
            return ResponseEntity.ok(ResponseDto.success(response));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDto.fail("ERROR", e.getMessage()));
        }
    }

    // 특정 펫 조회
    @GetMapping("/{myPetId}")
    public ResponseEntity<ResponseDto<MyPetResponseDto>> getMyPet(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @PathVariable Long myPetId) {
        try {
            Long ownerId = userDetails.getId();
            MyPetResponseDto response = myPetService.getMyPet(myPetId, ownerId);
            return ResponseEntity.ok(ResponseDto.success(response));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDto.fail("ERROR", e.getMessage()));
        }
    }

    // 이미지 업로드
    @PostMapping("/upload-image")
    public ResponseEntity<ResponseDto<String>> uploadPetImage(
            @RequestParam("file") MultipartFile file) {
        try {
            String imageUrl = myPetService.uploadPetImage(file);
            return ResponseEntity.ok(ResponseDto.success(imageUrl));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDto.fail("ERROR", e.getMessage()));
        }
    }

    // MyPet 검색 (자동완성용)
    @GetMapping("/search")
    public ResponseEntity<ResponseDto<List<MyPetSearchDto>>> searchMyPets(
            @AuthenticationPrincipal UserDetailsImpl userDetails,
            @RequestParam String keyword) {
        try {
            Long ownerId = userDetails.getId();
            List<MyPetSearchDto> results = myPetService.searchMyPets(ownerId, keyword);
            return ResponseEntity.ok(ResponseDto.success(results));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDto.fail("ERROR", e.getMessage()));
        }
    }

    // 내부 통신용 펫 조회 (AI 서비스에서 사용)
    @GetMapping("/internal/{myPetId}")
    public ResponseEntity<ResponseDto<MyPetResponseDto>> getMyPetInternal(
            @PathVariable Long myPetId,
            @RequestHeader(value = "X-Internal-Key", required = false) String internalKey) {
        try {
            // 내부 통신 키 검증
            String expectedKey = System.getenv("INTERNAL_API_KEY");
            if (expectedKey == null || !expectedKey.equals(internalKey)) {
                return ResponseEntity.status(403).body(ResponseDto.fail("ERROR", "Unauthorized internal access"));
            }
            
            MyPetResponseDto response = myPetService.getMyPetInternal(myPetId);
            return ResponseEntity.ok(ResponseDto.success(response));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ResponseDto.fail("ERROR", e.getMessage()));
        }
    }
} 