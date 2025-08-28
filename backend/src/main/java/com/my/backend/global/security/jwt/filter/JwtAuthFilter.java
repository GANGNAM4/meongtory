package com.my.backend.global.security.jwt.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.my.backend.global.dto.GlobalResDto;
import com.my.backend.global.security.jwt.util.JwtUtil;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Enumeration;

@Slf4j
@RequiredArgsConstructor
@Component
public class JwtAuthFilter extends OncePerRequestFilter {
    private final JwtUtil jwtUtil;
    private final UserDetailsService userDetailsService;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) throws ServletException {
        String path = request.getRequestURI();
        boolean shouldNotFilter = path.equals("/api/health") || // 추가: ELB HealthChecker용
                path.startsWith("/actuator/") || // 추가: Actuator 엔드포인트
                path.equals("/api/accounts/register") ||
                path.equals("/api/accounts/login") ||
                path.equals("/api/accounts/refresh") ||
                path.startsWith("/oauth2/") || // 추가: OAuth2 요청
                path.startsWith("/login/oauth2/"); // 추가: OAuth2 리다이렉트
        log.info("JwtAuthFilter: shouldNotFilter for path {}: {}", path, shouldNotFilter);
        return shouldNotFilter;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        Enumeration<String> headerNames = request.getHeaderNames();
        log.info("🔥 Incoming request headers:");
        while (headerNames.hasMoreElements()) {
            String headerName = headerNames.nextElement();
            log.info("{}: {}", headerName, request.getHeader(headerName));
        }

        log.info("Request Content-Type: {}", request.getContentType());
        String accessToken = jwtUtil.getHeaderToken(request, "Access_Token");
        String refreshToken = jwtUtil.getHeaderToken(request, "Refresh_Token");

        log.info("Access Token from header: {}", accessToken);
        log.info("Refresh Token from header: {}", refreshToken);
        log.info("Raw Access_Token from header: {}", request.getHeader("Access_Token"));
        log.info("Parsed Access Token: {}", accessToken);

        if (accessToken != null) {
            if (!jwtUtil.tokenValidation(accessToken)) {
                log.warn("Token validation failed for Access Token: {}", accessToken);
                jwtExceptionHandler(response, "AccessToken Expired", HttpStatus.UNAUTHORIZED);
                return;
            }
            String email = jwtUtil.getEmailFromToken(accessToken);
            log.info("Extracted email from Access Token: {}", email);
            setAuthentication(email);
            log.info("Authentication set for Access Token: {}", SecurityContextHolder.getContext().getAuthentication());
        } else if (refreshToken != null) {
            if (!jwtUtil.refreshTokenValidation(refreshToken)) {
                log.warn("Token validation failed for Refresh Token: {}", refreshToken);
                jwtExceptionHandler(response, "RefreshToken Expired", HttpStatus.BAD_REQUEST);
                return;
            }
            String email = jwtUtil.getEmailFromToken(refreshToken);
            log.info("Extracted email from Refresh Token: {}", email);
            setAuthentication(email);
            log.info("Authentication set for Refresh Token: {}", SecurityContextHolder.getContext().getAuthentication());
        } else {
            log.info("No valid tokens provided - Proceeding without authentication");
        }

        filterChain.doFilter(request, response);
    }

    public void setAuthentication(String email) {
        try {
            Authentication authentication = jwtUtil.createAuthentication(email);
            if (authentication == null) {
                log.error("Failed to create authentication for email: {}", email);
                return;
            }
            SecurityContextHolder.getContext().setAuthentication(authentication);
            log.info("Authentication successfully set in SecurityContext: {}", authentication);
        } catch (Exception e) {
            log.error("Error setting authentication for email: {}. Exception: {}", email, e.getMessage());
        }
    }

    public void jwtExceptionHandler(HttpServletResponse response, String msg, HttpStatus status) {
        response.setStatus(status.value());
        response.setContentType("application/json");
        try {
            String json = new ObjectMapper().writeValueAsString(new GlobalResDto(msg, status.value()));
            response.getWriter().write(json);
        } catch (Exception e) {
            log.error(e.getMessage());
        }
    }
}