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
        return (web) -> web.ignoring().requestMatchers("/h2-console/**");
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(Arrays.asList("http://localhost:3000",
                "http://localhost:3001",
                "http://43.201.8.4:3000",
                "http://frontend:3000"
                )); // 명시적으로 허용
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("*", "Authorization", "Content-Type"));
        configuration.setAllowCredentials(true);
        configuration.addExposedHeader("Access_Token");
        configuration.addExposedHeader("Refresh_Token");
        configuration.addExposedHeader("Authorization");
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity httpSecurity) throws Exception {
        httpSecurity
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(
                                "/api/accounts/register",
                                "/api/accounts/login",
                                "/api/accounts/refresh",
                                "/api/verifyAmount",
                                "/api/accounts/me",
                                "/login/**",
                                "/oauth2/**",
                                "/file/**",
                                "/test",
                                "/ws/**",
                                "/post/**",
                                "/api/products/**",
                                "/api/orders/**",
                                "/api/diary/**",
                                "/api/ai/**",
                                "/api/community/**",
                                "/api/carts/**",
                                "/error",
                                "/actuator/**"
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
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .oauth2Login(oauth2 -> oauth2
                        .userInfoEndpoint(userInfo -> userInfo.userService(customOAuth2UserService))
                        .successHandler(oauth2SuccessHandler)
                        .failureHandler((request, response, exception) -> {
                            log.error("OAuth2 authentication failed: {}", exception.getMessage());
                            response.setStatus(HttpStatus.UNAUTHORIZED.value());
                            response.setContentType("application/json");
                            response.getWriter().write("{\"error\": \"OAuth2 authentication failed\", \"message\": \"" + exception.getMessage() + "\"}");
                        }));

        return httpSecurity.build();
    }
}