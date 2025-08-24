package com.my.backend.account.oauth2;

import com.my.backend.global.security.jwt.dto.TokenDto;
import com.my.backend.global.security.jwt.util.JwtUtil;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
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

    @Value("${frontend.url:https://meongtory.shop}")
    private String frontendUrl;

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                        Authentication authentication) throws IOException {
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        String email = userDetails.getUsername();
        log.info("OAuth2 로그인 성공: {}", email);

        TokenDto tokenDto = jwtUtil.createAllToken(email, userDetails.getAccount().getRole());
        String targetUrl = String.format(
                "%s/?success=true&accessToken=%s&refreshToken=%s",
                frontendUrl,
                URLEncoder.encode(tokenDto.getAccessToken(), StandardCharsets.UTF_8),
                URLEncoder.encode(tokenDto.getRefreshToken(), StandardCharsets.UTF_8)
        );
        log.info("Redirecting to: {}", targetUrl);
        response.addHeader("Access_Token", tokenDto.getAccessToken());
        response.addHeader("Refresh_Token", tokenDto.getRefreshToken());
        getRedirectStrategy().sendRedirect(request, response, targetUrl);
    }
}