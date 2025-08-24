package com.my.backend.store.controller;

import com.my.backend.account.entity.Account;
import com.my.backend.global.dto.ResponseDto;
import com.my.backend.global.security.user.UserDetailsImpl;
import com.my.backend.store.dto.CartDto;
import com.my.backend.store.entity.Cart;
import com.my.backend.store.service.CartService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * 장바구니 관련 API 컨트롤러
 */
@RestController
@RequestMapping("/api/carts")
@RequiredArgsConstructor
public class CartController {

    private final CartService cartService;

    @GetMapping
    public List<CartDto> getCurrentUserCart(@AuthenticationPrincipal UserDetailsImpl userDetails) {
        // 인증 검증
        if (userDetails == null) {
            System.out.println("ERROR: userDetails가 null입니다. 인증이 필요합니다.");
            throw new RuntimeException("인증이 필요합니다.");
        }

        Long accountId = userDetails.getAccount().getId();
        return cartService.getCartDtoByAccountId(accountId);
    }

    @PostMapping
    public ResponseDto<?> addToCart(@AuthenticationPrincipal UserDetailsImpl userDetails,
                                 @RequestParam Long productId,
                                 @RequestParam(required = false, defaultValue = "1") int quantity) {

        if(userDetails == null || userDetails.getAccount() == null) {
            System.out.println("ERROR: userDetails가 null입니다. 인증이 필요합니다.");
            return ResponseDto.fail("로그인 필요","로그인이 필요합니다.");
        }
        
        Account account = userDetails.getAccount();
        
        // 네이버 상품인지 일반 상품인지 구분
        // 네이버 상품 ID는 일반적으로 큰 숫자 (예: 5767909253)
        // 일반 상품 ID는 작은 숫자 (예: 1, 2, 3, ...)
        if (productId > 1000000) { // 100만 이상이면 네이버 상품으로 간주
            try {
                Cart cart = cartService.addNaverProductToCart(account.getId(), productId, quantity);
                return ResponseDto.success(cartService.toDto(cart));
            } catch (Exception e) {
                System.out.println("네이버 상품 장바구니 추가 실패: " + e.getMessage());
                return ResponseDto.fail("네이버 상품 추가 실패", e.getMessage());
            }
        } else {
            try {
                Cart cart = cartService.addToCart(account.getId(), productId, quantity);
                return ResponseDto.success(cartService.toDto(cart));
            } catch (Exception e) {
                System.out.println("일반 상품 장바구니 추가 실패: " + e.getMessage());
                return ResponseDto.fail("상품 추가 실패", e.getMessage());
            }
        }
    }

    @DeleteMapping("/{cartId}")
    public void removeFromCart(@PathVariable Long cartId) {
        cartService.removeFromCart(cartId);
    }

    @PutMapping("/{cartId}")
    public CartDto updateQuantity(@PathVariable Long cartId,
                                  @RequestParam int quantity) {
        Cart cart = cartService.updateCartQuantity(cartId, quantity);
        CartDto result = cartService.toDto(cart);
        
        return result;
    }
}
