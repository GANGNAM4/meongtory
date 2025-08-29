package com.my.backend.account.service;

import com.my.backend.account.dto.AccountRegisterRequestDto;
import com.my.backend.account.dto.AccountResponseDto;
import com.my.backend.account.dto.LoginResponseDto;
import com.my.backend.account.dto.LoginRequestDto;
import com.my.backend.account.entity.Account;
import com.my.backend.account.entity.RefreshToken;
import com.my.backend.account.repository.AccountRepository;
import com.my.backend.account.repository.RefreshTokenRepository;
import com.my.backend.global.dto.ResponseDto;
import com.my.backend.global.security.jwt.dto.TokenDto;
import com.my.backend.global.security.jwt.util.JwtUtil;
import com.my.backend.pet.entity.MyPet;
import com.my.backend.pet.repository.MyPetRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDate;

@Slf4j
@Service
@RequiredArgsConstructor
public class AccountService {
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final RefreshTokenRepository refreshTokenRepository;
    private final MyPetRepository myPetRepository;

    @Transactional
    public ResponseDto<?> register(AccountRegisterRequestDto requestDto) {
        log.info("회원가입 처리 시작: email={}", requestDto.getEmail());
        if (accountRepository.findByEmail(requestDto.getEmail()).isPresent()) {
            log.warn("이미 사용 중인 이메일: {}", requestDto.getEmail());
            return ResponseDto.fail("EMAIL_ALREADY_TAKEN", "이미 사용 중인 이메일입니다.");
        }

        requestDto.setEncodePwd(passwordEncoder.encode(requestDto.getPassword()));
        Account account = new Account(requestDto);
        accountRepository.save(account);
        log.info("계정 저장 완료: email={}", account.getEmail());

        // 펫 정보 저장 로직
        if (requestDto.getPet() != null && requestDto.getPetBreeds() != null) {
            try {
                MyPet myPet = MyPet.builder()
                        .owner(account)
                        .name(account.getName() + "의 " + requestDto.getPet().name()) // PetType Enum 값을 그대로 사용
                        .breed(requestDto.getPetBreeds())
                        .age(parseAge(requestDto.getPetAge()))
                        .gender(MyPet.Gender.UNKNOWN)
                        .type(requestDto.getPet().name()) // PetType Enum 값을 String으로 설정
                        .medicalHistory("")
                        .vaccinations("")
                        .notes("")
                        .microchipId("")
                        .specialNeeds("")
                        .build();
                myPetRepository.save(myPet);
                log.info("펫 정보 저장 완료: email={}", account.getEmail());
            } catch (Exception e) {
                log.warn("펫 정보 저장 실패: {}", e.getMessage());
                return ResponseDto.fail("PET_SAVE_FAILED", "펫 정보 저장 중 오류가 발생했습니다: " + e.getMessage());
            }
        }

        AccountResponseDto responseDto = new AccountResponseDto(
                account.getId(),
                account.getEmail(),
                account.getName(),
                account.getRole()
        );
        log.info("회원가입 성공: email={}", responseDto.getEmail());
        return ResponseDto.success(responseDto);
    }

    private Integer parseAge(String petAge) {
        if (petAge == null || petAge.isEmpty()) {
            return null;
        }
        try {
            // "2살" 또는 "5개월" 같은 문자열에서 숫자만 추출
            String[] parts = petAge.split("[^0-9]");
            for (String part : parts) {
                if (!part.isEmpty()) {
                    return Integer.parseInt(part);
                }
            }
            return null;
        } catch (NumberFormatException e) {
            log.warn("펫 나이 파싱 실패: petAge={}, error={}", petAge, e.getMessage());
            return null;
        }
    }

    @Transactional
    public LoginResponseDto accountLogin(LoginRequestDto request) {
        Account account = accountRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 이메일입니다."));

        if (!passwordEncoder.matches(request.getPassword(), account.getPassword())) {
            throw new IllegalArgumentException("비밀번호가 일치하지 않습니다.");
        }

        TokenDto tokenDto = jwtUtil.createAllToken(account.getEmail(), account.getRole());
        RefreshToken refreshToken = RefreshToken.builder()
                .accountEmail(account.getEmail())
                .refreshToken(tokenDto.getRefreshToken())
                .build();
        refreshTokenRepository.save(refreshToken);
        log.info("로그인 성공: {}", account.getEmail());
        
        // 사용자 정보와 토큰을 모두 포함한 응답 반환
        return new LoginResponseDto(
                account.getId(),
                account.getEmail(),
                account.getName(),
                account.getRole(),
                tokenDto.getAccessToken(),
                tokenDto.getRefreshToken()
        );
    }

    @Transactional
    public void accountLogout(String email) {
        refreshTokenRepository.deleteByAccountEmail(email);
        log.info("로그아웃 성공: {}", email);
    }

    public AccountResponseDto getUserInfoByEmail(String email) {
        if (email == null || email.isEmpty()) {
            throw new IllegalArgumentException("이메일이 제공되지 않았습니다.");
        }
        Account account = accountRepository.findByEmail(email)
                .orElseThrow(() -> new RuntimeException("계정이 없습니다: " + email));
        return new AccountResponseDto(
                account.getId(),
                account.getEmail(),
                account.getName(),
                account.getRole()
        );
    }
    
    // 펫 타입을 한글 표시명으로 변환
    private String getPetDisplayName(com.my.backend.account.entity.PetType petType) {
        if (petType == null) return "반려동물";
        switch (petType) {
            case DOG:
                return "강아지";
            case CAT:
                return "고양이";
            default:
                return "반려동물";
        }
    }

    @Transactional
    public TokenDto refreshAccessToken(String refreshToken) {
        if (!jwtUtil.refreshTokenValidation(refreshToken)) {
            log.warn("유효하지 않은 리프레시 토큰: {}", refreshToken);
            throw new IllegalArgumentException("유효하지 않은 리프레시 토큰입니다.");
        }

        String email = jwtUtil.getEmailFromToken(refreshToken);
        Account account = accountRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("존재하지 않는 계정입니다: " + email));

        // 새로운 액세스 토큰 생성
        String newAccessToken = jwtUtil.createToken(email, account.getRole(), "Access");
        log.info("새로운 액세스 토큰 생성 성공: email={}", email);

        return new TokenDto(newAccessToken, refreshToken);
    }
    

}