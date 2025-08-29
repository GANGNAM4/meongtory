package com.my.backend.account.controller;

import com.my.backend.account.dto.AccountRegisterRequestDto;
import com.my.backend.account.dto.LoginRequestDto;
import com.my.backend.account.dto.LoginResponseDto;
import com.my.backend.account.entity.Account;
import com.my.backend.account.entity.RefreshToken;
import com.my.backend.account.repository.AccountRepository;
import com.my.backend.account.repository.RefreshTokenRepository;
import com.my.backend.account.service.AccountService;
import com.my.backend.global.dto.GlobalResDto;
import com.my.backend.global.dto.ResponseDto;
import com.my.backend.global.security.jwt.dto.TokenDto;
import com.my.backend.global.security.jwt.util.JwtUtil;
import com.my.backend.global.security.user.UserDetailsImpl;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;

@RestController
@RequestMapping("/api/accounts")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
@Slf4j
public class AccountController {
    private final AccountService accountService;
    private final JwtUtil jwtUtil;
    private final AccountRepository accountRepository;
    private final RefreshTokenRepository refreshTokenRepository;

    //회원가입
    @PostMapping("/register")
    public ResponseEntity<ResponseDto<?>> register(@RequestBody @Valid AccountRegisterRequestDto request) {
        log.info("회원가입 요청 수신: email={}, name={}", request.getEmail(), request.getName());
        try {
            ResponseDto<?> response = accountService.register(request);
            log.info("회원가입 성공: email={}, response={}", request.getEmail(), response);
            return ResponseEntity.status(HttpStatus.CREATED).body(response); // 201 Created
        } catch (Exception e) {
            log.error("회원가입 실패: email={}, error={}", request.getEmail(), e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(ResponseDto.fail("REGISTRATION_FAILED", e.getMessage()));
        }
    }

    //로그인
    @PostMapping("/login")
    public ResponseDto<?> login(@RequestBody @Valid LoginRequestDto loginReqDto) {
        try {
            LoginResponseDto loginResponse = accountService.accountLogin(loginReqDto);
            return ResponseDto.success(loginResponse);
        } catch (Exception e) {
            return ResponseDto.fail("LOGIN_FAILED", e.getMessage());
        }
    }

    //로그아웃
    @PostMapping("/logout")
    public ResponseDto<?> logout(@AuthenticationPrincipal UserDetailsImpl userDetails)throws Exception{
        String email = userDetails.getAccount().getEmail();
        accountService.accountLogout(email);
        return ResponseDto.success("로그아웃이 완료되었습니다.");
    }

    @GetMapping("/me")
    public ResponseDto<?> getUserInfo(@AuthenticationPrincipal UserDetailsImpl userDetails) throws IOException {
        if (userDetails == null) {
            return ResponseDto.fail("UNAUTHORIZED", "인증이 필요합니다.");
        }
        String email = userDetails.getUsername();
        return ResponseDto.success(accountService.getUserInfoByEmail(email));
    }

    @PostMapping("/refresh")
    public ResponseDto<?> refreshToken(@RequestBody Map<String, String> request) {
        log.info("리프레시 토큰 요청 수신");
        try {
            String refreshToken = request.get("refreshToken");
            if (refreshToken == null || refreshToken.isEmpty()) {
                log.warn("리프레시 토큰이 제공되지 않음");
                return ResponseDto.fail("INVALID_REFRESH_TOKEN", "리프레시 토큰이 필요합니다.");
            }
            String email = jwtUtil.getEmailFromToken(refreshToken);
            Account account = accountRepository.findByEmail(email)
                    .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 계정입니다: " + email));
            if (!jwtUtil.refreshTokenValidation(refreshToken)) {
                log.warn("유효하지 않은 리프레시 토큰: {}", refreshToken);
                return ResponseDto.fail("INVALID_REFRESH_TOKEN", "유효하지 않은 리프레시 토큰입니다.");
            }
            // 새 액세스 토큰과 리프레시 토큰 생성
            TokenDto tokenDto = jwtUtil.createAllToken(email, account.getRole());
            // DB에 새 리프레시 토큰 저장
            RefreshToken newRefreshToken = RefreshToken.builder()
                    .accountEmail(email)
                    .refreshToken(tokenDto.getRefreshToken())
                    .build();
            refreshTokenRepository.save(newRefreshToken);
            log.info("액세스 토큰 및 리프레시 토큰 갱신 성공: email={}", email);
            return ResponseDto.success(tokenDto);
        } catch (Exception e) {
            log.error("액세스 토큰 갱신 실패: {}", e.getMessage());
            return ResponseDto.fail("REFRESH_FAILED", e.getMessage());
        }
    }
}