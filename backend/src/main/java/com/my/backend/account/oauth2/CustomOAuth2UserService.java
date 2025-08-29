package com.my.backend.account.oauth2;

import com.my.backend.account.entity.Account;
import com.my.backend.account.entity.RefreshToken;
import com.my.backend.account.repository.AccountRepository;
import com.my.backend.account.repository.RefreshTokenRepository;
import com.my.backend.account.service.AccountService;
import com.my.backend.global.security.jwt.dto.TokenDto;
import com.my.backend.global.security.jwt.util.JwtUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest;
import org.springframework.security.oauth2.client.userinfo.OAuth2UserService;
import org.springframework.security.oauth2.core.OAuth2AuthenticationException;
import org.springframework.security.oauth2.core.user.OAuth2User;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomOAuth2UserService implements OAuth2UserService<OAuth2UserRequest, OAuth2User> {
    private final AccountRepository accountRepository;
    private final JwtUtil jwtUtil;
    private final RefreshTokenRepository refreshTokenRepository;

    @Override
    public OAuth2User loadUser(OAuth2UserRequest userRequest) throws OAuth2AuthenticationException {
        log.info("Starting OAuth2 user load for client: {}", userRequest.getClientRegistration().getRegistrationId());
        log.info("ClientRegistration: clientId={}, redirectUri={}",
                userRequest.getClientRegistration().getClientId(),
                userRequest.getClientRegistration().getRedirectUri());

        try {
            OAuth2UserService<OAuth2UserRequest, OAuth2User> delegate = new DefaultOAuth2UserService();
            OAuth2User oAuth2User = delegate.loadUser(userRequest);
            log.info("OAuth2 User Attributes: {}", oAuth2User.getAttributes());

            String registrationId = userRequest.getClientRegistration().getRegistrationId();
            log.info("Processing OAuth2 provider: {}", registrationId);

            OAuth2UserInfo oAuth2UserInfo = getOAuth2UserInfo(registrationId, oAuth2User.getAttributes());

            String email = oAuth2UserInfo.getEmail();
            String name = oAuth2UserInfo.getName();
            String provider = oAuth2UserInfo.getProvider();
            String providerId = oAuth2UserInfo.getProviderId();
            log.info("User Info - Email: {}, Name: {}, Provider: {}, ProviderId: {}", email, name, provider, providerId);

            Account account = accountRepository.findByProviderAndProviderId(provider, providerId)
                    .orElseGet(() -> {
                        String finalEmail = email != null ? email : provider + "_" + providerId + "@kakao.com";
                        Account newAccount = new Account(finalEmail, name, provider, providerId);
                        log.info("Creating new account for email: {}", finalEmail);
                        return accountRepository.save(newAccount);
                    });

            TokenDto tokenDto = jwtUtil.createAllToken(account.getEmail(), account.getRole());
            RefreshToken refreshToken = RefreshToken.builder()
                    .accountEmail(account.getEmail())
                    .refreshToken(tokenDto.getRefreshToken())
                    .build();
            refreshTokenRepository.save(refreshToken);
            log.info("OAuth2 로그인 성공: {}, AccessToken: {}, RefreshToken: {}",
                    account.getEmail(), tokenDto.getAccessToken(), tokenDto.getRefreshToken());

            return new CustomUserDetails(account, oAuth2User.getAttributes());
        } catch (OAuth2AuthenticationException e) {
            log.error("OAuth2 Authentication failed: {}", e.getMessage(), e);
            throw e;
        } catch (Exception e) {
            log.error("Unexpected error in OAuth2 processing: {}", e.getMessage(), e);
            throw new OAuth2AuthenticationException("OAuth2 처리 중 오류: " + e.getMessage());
        }
    }

    private OAuth2UserInfo getOAuth2UserInfo(String registrationId, Map<String, Object> attributes) {
        log.info("Processing OAuth2 user info for provider: {}", registrationId);
        if ("google".equals(registrationId)) {
            log.info("Google OAuth2 attributes: {}", attributes);
            return new GoogleUserDetails(attributes);
        } else if ("naver".equals(registrationId)) {
            log.info("Naver OAuth2 attributes: {}", attributes);
            return new NaverUserDetails(attributes);
        } else if ("kakao".equals(registrationId)) {
            log.info("Kakao OAuth2 attributes: {}", attributes);
            return new KakaoUserDetails(attributes);
        } else {
            log.error("Unsupported OAuth2 provider: {}", registrationId);
            throw new OAuth2AuthenticationException("지원하지 않는 OAuth2 제공자입니다: " + registrationId);
        }
    }
}