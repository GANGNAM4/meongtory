package com.my.backend.global.security;

import com.my.backend.account.oauth2.CustomOAuth2UserService;
import com.my.backend.account.oauth2.OAuth2SuccessHandler;
import com.my.backend.global.security.jwt.filter.JwtAuthFilter;
import com.my.backend.global.security.jwt.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityCustomizer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizationRequestRepository;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

import static org.springframework.security.config.Customizer.withDefaults;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
@Slf4j
public class WebSecurityConfig {
    private final JwtAuthFilter jwtAuthFilter;
    private final CustomOAuth2UserService customOAuth2UserService;
    private final OAuth2SuccessHandler oauth2SuccessHandler;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public WebSecurityCustomizer ignoringCustomizer() {
        log.info("Configuring ignored paths for WebSecurity");
        return (web) -> web.ignoring().requestMatchers(
                "/h2-console/**",
                "/api/health",
                "/actuator/**"
                // OAuth2 경로는 제거 - Spring Security가 처리하도록 함
        );
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        log.info("Configuring CORS for allowed origins");
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(Arrays.asList(
                "http://localhost:3000",
                "https://meongtory.shop",
                "http://frontend:3000",
                "http://localhost:*"));
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*", "Authorization", "Content-Type", "Access_Token", "Refresh_Token"));
        configuration.setAllowCredentials(true);
        configuration.addExposedHeader("Access_Token");
        configuration.addExposedHeader("Refresh_Token");
        configuration.addExposedHeader("Authorization");
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity httpSecurity) throws Exception {
        log.info("Configuring SecurityFilterChain for OAuth2 and JWT");
        httpSecurity
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/accounts/register",
                                "/api/accounts/login",
                                "/api/accounts/refresh",
                                "/api/verifyAmount",
                                "/api/confirm",
                                "/api/saveAmount",
                                "/api/cancel",
                                "/api/payment/**",
                                "/api/accounts/me",
                                "/login/**",
                                "/oauth2/**",
                                "/oauth2/authorization/**",
                                "/file/**",
                                "/test",
                                "/ws/**",
                                "/post/**",
                                "/api/products/**",
                                "/api/naver-shopping/**",
                                "/api/orders/**",
                                "/api/diary/**",
                                "/api/ai/**",
                                "/api/breed/**",
                                "/api/emotion/**",
                                "/api/pets/**",
                                "/api/community/**",
                                "/api/carts/**",
                                "/api/insurance/**",
                                "/api/recent/**",
                                "/api/chatbot/**",
                                "/api/mypet/internal/**",
                                "/error",
                                "/actuator/**",
                                "/api/naver-shopping/**",
                                "/api/search/**",
                                "/api/embedding/**",
                                "/api/health",
                                "/login/oauth2/code/**"
                        ).permitAll()
                        .requestMatchers("/api/orders/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/travel-plans/**", "/chat").authenticated()
                        .anyRequest().authenticated())
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint((request, response, authException) -> {
                            log.error("Authentication error for URI {}: {}", request.getRequestURI(), authException.getMessage());
                            response.setStatus(HttpStatus.UNAUTHORIZED.value());
                            response.setContentType("application/json");
                            response.getWriter().write("{\"error\": \"Unauthorized\", \"message\": \"Authentication required\"}");
                        }))
                .securityContext(context -> context.requireExplicitSave(false))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.IF_REQUIRED))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .oauth2Login(oauth2 -> oauth2
                        .userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
                        .successHandler(oauth2SuccessHandler)
                        .failureHandler((request, response, exception) -> {
                            log.error("OAuth2 authentication failed for URI {}: {}", request.getRequestURI(), exception.getMessage());
                            response.setStatus(HttpStatus.UNAUTHORIZED.value());
                            response.setContentType("application/json");
                            response.getWriter().write("{\"error\": \"OAuth2 authentication failed\", \"message\": \"" + exception.getMessage() + "\"}");
                        })
                        .authorizationEndpoint(auth -> auth
                                .authorizationRequestRepository(new HttpSessionOAuth2AuthorizationRequestRepository())));

        return httpSecurity.build();
    }
}
