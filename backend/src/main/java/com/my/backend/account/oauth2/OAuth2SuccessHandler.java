package com.my.backend.account.oauth2;

import com.my.backend.account.entity.Account;
import com.my.backend.account.repository.AccountRepository;
import com.my.backend.global.security.jwt.dto.TokenDto;
import com.my.backend.global.security.jwt.util.JwtUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

@Slf4j
@Component
@RequiredArgsConstructor
public class OAuth2SuccessHandler extends SimpleUrlAuthenticationSuccessHandler {
    private final JwtUtil jwtUtil;
    private final AccountRepository accountRepository; // 추가: 사용자 정보 조회용

    // 환경변수 대신 직접 도메인 설정
    private final String frontendUrl = "https://meongtory.shop";

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        String email = userDetails.getUsername();
        log.info("OAuth2 로그인 성공: {}", email);

        // 추가: 사용자 정보 조회
        Account account = accountRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalStateException("사용자 정보를 찾을 수 없습니다."));

        TokenDto tokenDto = jwtUtil.createAllToken(email, userDetails.getAccount().getRole());
        String targetUrl = String.format(
                "%s/?success=true&accessToken=%s&refreshToken=%s&email=%s&name=%s&role=%s",
                frontendUrl,
                URLEncoder.encode(tokenDto.getAccessToken(), StandardCharsets.UTF_8),
                URLEncoder.encode(tokenDto.getRefreshToken(), StandardCharsets.UTF_8),
                URLEncoder.encode(email, StandardCharsets.UTF_8),
                URLEncoder.encode(account.getName(), StandardCharsets.UTF_8),
                URLEncoder.encode(account.getRole(), StandardCharsets.UTF_8)
        );
        log.info("Redirecting to: {}", targetUrl);
        response.addHeader("Access_Token", tokenDto.getAccessToken());
        response.addHeader("Refresh_Token", tokenDto.getRefreshToken());
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}