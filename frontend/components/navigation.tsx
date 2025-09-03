"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User, Menu, X } from "lucide-react";
import axios from "axios";
import { toast } from "react-hot-toast";
import Image from "next/image";
import LoginModal from "@/components/modals/login-modal";
import SignupModal from "@/components/modals/signup-modal";
import PasswordRecoveryModal from "@/components/modals/password-recovery-modal";
import { getBackendUrl } from "@/lib/api";

// AuthContext 타입 정의
interface AuthContextType {
  isLoggedIn: boolean;
  isAdmin: boolean;
  currentUser: { id: number; email: string; name: string } | null;
  setIsLoggedIn: (value: boolean) => void;
  setIsAdmin: (value: boolean) => void;
  setCurrentUser: (user: { id: number; email: string; name: string } | null) => void;
  refreshAccessToken: () => Promise<string | null>;
  checkLoginStatus: () => Promise<void>;
}

// AuthContext 생성
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// AuthContext 훅
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

// AuthProvider 컴포넌트
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; name: string } | null>(null);
  const [isCheckingLogin, setIsCheckingLogin] = useState(false);
  const hasCheckedLogin = useRef(false); // 초기 로그인 체크 여부 추적
  const retryCount = useRef(0);
  const MAX_RETRIES = 3;

  const refreshAccessToken = useCallback(async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        console.error("리프레시 토큰이 없습니다.");
        return null;
      }
      const response = await axios.post(
        `${getBackendUrl()}/api/accounts/refresh`,
        { refreshToken },
        { headers: { "Content-Type": "application/json" } }
      );
      console.log("리프레시 응답:", response.data);
      const { accessToken, refreshToken: newRefreshToken } = response.data.data;
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", newRefreshToken);
      return accessToken;
    } catch (err) {
      console.error("토큰 갱신 실패:", err);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      return null;
    }
  }, []);

  const checkLoginStatus = useCallback(async () => {
    // 수정: 재시도 횟수 초과 시 즉시 종료
    if (retryCount.current >= MAX_RETRIES) {
      console.error(`최대 재시도 횟수(${MAX_RETRIES}) 초과`);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      setIsLoggedIn(false);
      setCurrentUser(null);
      setIsAdmin(false);
      hasCheckedLogin.current = true;
      retryCount.current = 0;
      toast.error("인증에 실패했습니다. 다시 로그인해주세요.", { duration: 5000 });
      return;
    }

    if (isCheckingLogin || hasCheckedLogin.current || typeof window === "undefined") {
      return;
    }
    setIsCheckingLogin(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      // 수정: 요청 전 헤더와 토큰 상태 확인
      if (!accessToken) {
        return;
      }

      const response = await axios.get(`${getBackendUrl()}/api/accounts/me`, {
        headers: { 
          "Access_Token": accessToken,
          // 수정: ALB가 소문자 헤더를 기대할 경우 대비
          "access_token": accessToken 
        },
        timeout: 5000,
      });
      const { id, email, name, role } = response.data.data;

      if (!currentUser || currentUser.id !== id || currentUser.email !== email || currentUser.name !== name) {
        setCurrentUser({ id, email, name });
      }
      if (isAdmin !== (role === "ADMIN")) {
        setIsAdmin(role === "ADMIN");
      }
      if (!isLoggedIn) {
        setIsLoggedIn(true);
      }
      hasCheckedLogin.current = true;
      retryCount.current = 0;
    } catch (err: any) {
      console.error("사용자 정보 조회 실패:", err.response?.data?.message || err.message);
      if (err.response?.status === 401) {
        retryCount.current += 1;
        console.log("401 에러 발생, 재시도 횟수:", retryCount.current);
        const newToken = await refreshAccessToken();
        if (newToken) {
          try {
            const response = await axios.get(`${getBackendUrl()}/api/accounts/me`, {
              headers: { 
                "Access_Token": newToken,
                "access_token": newToken // 수정: 소문자 헤더 추가
              },
              timeout: 5000,
            });
            const { id, email, name, role } = response.data.data;
            if (!currentUser || currentUser.id !== id || currentUser.email !== email || currentUser.name !== name) {
              setCurrentUser({ id, email, name });
            }
            if (isAdmin !== (role === "ADMIN")) {
              setIsAdmin(role === "ADMIN");
            }
            if (!isLoggedIn) {
              setIsLoggedIn(true);
            }
            hasCheckedLogin.current = true;
            retryCount.current = 0;
          } catch (retryErr) {
            console.error("재시도 실패:", retryErr);
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            setIsLoggedIn(false);
            setCurrentUser(null);
            setIsAdmin(false);
            hasCheckedLogin.current = true;
            retryCount.current = 0;
          }
        } else {
          console.log("토큰 갱신 실패, 인증 정보 초기화");
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setIsLoggedIn(false);
          setCurrentUser(null);
          setIsAdmin(false);
          hasCheckedLogin.current = true;
          retryCount.current = 0;
        }
      } else {
        console.error("기타 에러로 인증 정보 초기화:", err);
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setIsLoggedIn(false);
        setCurrentUser(null);
        setIsAdmin(false);
        hasCheckedLogin.current = true;
        retryCount.current = 0;
      }
    } finally {
      setIsCheckingLogin(false);
    }
  }, [isCheckingLogin, isLoggedIn, isAdmin, currentUser, refreshAccessToken]);

  useEffect(() => {
    if (!hasCheckedLogin.current && !isCheckingLogin) {
      checkLoginStatus();
    }
  }, [checkLoginStatus]);

  return (
    <AuthContext.Provider value={{ isLoggedIn, isAdmin, currentUser, setIsLoggedIn, setIsAdmin, setCurrentUser, refreshAccessToken, checkLoginStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

// NavigationHeader 컴포넌트 정의
interface NavigationHeaderProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogin: () => void;
  onLogout: () => void;
}

function NavigationHeader({
  currentPage,
  onNavigate,
  onLogin,
  onLogout,
}: NavigationHeaderProps) {
  const { isLoggedIn, isAdmin } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // 디버깅: isAdmin 상태 변화 추적
  useEffect(() => {
  }, [isLoggedIn, isAdmin]);

  // 모바일 메뉴 토글
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // 네비게이션 클릭 핸들러
  const handleNavigation = (page: string) => {
    onNavigate(page);
    setIsMobileMenuOpen(false); // 모바일 메뉴 닫기
  };

  // 네비게이션 메뉴 아이템들
  const navigationItems = [
    { key: "adoption", label: "입양", path: "adoption" },
    { key: "insurance", label: "펫보험", path: "insurance" },
    { key: "diary", label: "성장일기", path: "diary" },
    { key: "community", label: "커뮤니티", path: "community" },
    { key: "store", label: "스토어", path: "store" },
    { key: "research", label: "강아지 연구소", path: "research" },
  ];

  // 로그인된 사용자용 메뉴 아이템들
  const userMenuItems = [
    ...(isLoggedIn ? [{ key: "my", label: "마이페이지", path: "my" }] : []),
    ...(isAdmin ? [{ key: "admin", label: "관리자", path: "admin", isAdmin: true }] : []),
  ];

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* 로고 */}
          <button onClick={() => handleNavigation("home")} className="flex items-center space-x-2">
            <Image src="/KakaoTalk_20250729_160046076.png" alt="멍토리 로고" width={100} height={40} className="h-auto" />
          </button>

          {/* 데스크톱 네비게이션 */}
          <nav className="hidden lg:flex items-center space-x-8">
            {navigationItems.map((item) => (
              <button
                key={item.key}
                onClick={() => handleNavigation(item.path)}
                className={`text-sm font-medium transition-colors ${
                  currentPage === item.path ? "text-blue-600" : "text-gray-700 hover:text-blue-600"
                }`}
              >
                {item.label}
              </button>
            ))}
            {userMenuItems.map((item) => (
              <button
                key={item.key}
                onClick={() => handleNavigation(item.path)}
                className={`text-sm font-medium transition-colors ${
                  currentPage === item.path 
                    ? (item.isAdmin ? "text-red-600" : "text-blue-600")
                    : (item.isAdmin ? "text-red-700 hover:text-red-600" : "text-gray-700 hover:text-blue-600")
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* 데스크톱 로그인/로그아웃 버튼 */}
          <div className="hidden lg:flex items-center space-x-3">
            {isLoggedIn ? (
              <Button onClick={onLogout} variant="outline" size="sm" className="text-sm bg-transparent">
                로그아웃
              </Button>
            ) : (
              <Button onClick={() => { onLogin(); }} variant="outline" size="sm" className="text-sm bg-transparent">
                <User className="w-4 h-4 mr-1" />
                로그인
              </Button>
            )}
          </div>

          {/* 모바일 메뉴 버튼 */}
          <button
            onClick={toggleMobileMenu}
            className="lg:hidden p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* 모바일 메뉴 */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-gray-200 bg-white">
            <nav className="px-4 py-2 space-y-1">
              {/* 메인 네비게이션 */}
              {navigationItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleNavigation(item.path)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentPage === item.path 
                      ? "bg-blue-100 text-blue-600" 
                      : "text-gray-700 hover:bg-gray-100 hover:text-blue-600"
                  }`}
                >
                  {item.label}
                </button>
              ))}
              
              {/* 사용자 메뉴 */}
              {userMenuItems.map((item) => (
                <button
                  key={item.key}
                  onClick={() => handleNavigation(item.path)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    currentPage === item.path 
                      ? (item.isAdmin ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-600")
                      : (item.isAdmin ? "text-red-700 hover:bg-red-50 hover:text-red-600" : "text-gray-700 hover:bg-gray-100 hover:text-blue-600")
                  }`}
                >
                  {item.label}
                </button>
              ))}

              {/* 모바일 로그인/로그아웃 버튼 */}
              <div className="border-t border-gray-200 pt-2 mt-2">
                {isLoggedIn ? (
                  <button
                    onClick={() => {
                      onLogout();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-red-700 hover:bg-red-50 hover:text-red-600 transition-colors"
                  >
                    로그아웃
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      onLogin();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-md text-sm font-medium text-blue-700 hover:bg-blue-50 hover:text-blue-600 transition-colors flex items-center"
                  >
                    <User className="w-4 h-4 mr-2" />
                    로그인
                  </button>
                )}
              </div>
            </nav>
          </div>
        )}

        {/* 디버깅용 - 개발 완료 후 제거 */}
        {process.env.NODE_ENV === 'development' && (
          <div className="lg:hidden text-xs text-gray-400 px-4 py-1">
            isAdmin: {isAdmin ? 'true' : 'false'}
          </div>
        )}
      </div>
    </header>
  );
}

export default function Navigation() {
  const router = useRouter();
  const pathname = usePathname();
  const [currentPage, setCurrentPage] = useState("home");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const { isLoggedIn, setIsLoggedIn, setIsAdmin, setCurrentUser, refreshAccessToken, checkLoginStatus } = useAuth();

  // OAuth2 콜백 처리
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get("success");
    const accessToken = urlParams.get("accessToken");
    const refreshToken = urlParams.get("refreshToken");
    const email = urlParams.get("email");
    const name = urlParams.get("name");
    const role = urlParams.get("role");
    
    if (success === "true" && accessToken && refreshToken && email && name && role) {
      // 토큰 저장
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("email", email);
      localStorage.setItem("nickname", name);
      localStorage.setItem("role", role);
      
      // AuthContext 상태 즉시 업데이트
      setCurrentUser({ id: 0, email, name }); // ID는 /api/accounts/me에서 가져올 예정
      setIsLoggedIn(true);
      setIsAdmin(role === "ADMIN");
      

      
      // 강제 리렌더링을 위한 약간의 지연 후 상태 재설정
      setTimeout(() => {
        setIsAdmin(role === "ADMIN");
      }, 100);
      
      // 사용자 상세 정보 가져오기
      const fetchUserDetails = async () => {
        try {
          const response = await axios.get(`${getBackendUrl()}/api/accounts/me`, {
            headers: { 
              Access_Token: accessToken,
              access_token: accessToken
            }
          });
          const userData = response.data?.data;
          if (userData) {
            const { id, email: userEmail, name: userName, role: userRole } = userData;
            setCurrentUser({ id, email: userEmail, name: userName });
            setIsAdmin(userRole === "ADMIN");
          }
        } catch (err) {
          console.error("사용자 정보 조회 실패:", err);
        }
      };
      
      fetchUserDetails();
      toast.success("로그인에 성공했습니다", { duration: 5000 });
      
      // URL 파라미터 정리
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [setCurrentUser, setIsLoggedIn, setIsAdmin]);

  // 현재 페이지 결정
  useEffect(() => {
    const getCurrentPage = () => {
      if (pathname === "/") return "home";
      const path = pathname.split("/")[2] || pathname.split("/")[1];
      return path || "home";
    };
    setCurrentPage(getCurrentPage());
  }, [pathname]);

  // 로그아웃 핸들러
  const handleLogout = async () => {
    try {
      const accessToken = localStorage.getItem("accessToken");
      // 수정: 로그아웃 요청 전 토큰 상태 확인
      if (accessToken) {
        await axios.post(
          `${getBackendUrl()}/api/accounts/logout`,
          {},
          { headers: { "Content-Type": "application/json", Access_Token: accessToken, access_token: accessToken } }
        );
      }
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("nickname");
      localStorage.removeItem("email");
      localStorage.removeItem("role");
      setIsLoggedIn(false);
      setIsAdmin(false);
      setCurrentUser(null);
      toast.success("로그아웃 되었습니다", { duration: 5000 });
      router.push("/");
    } catch (err: any) {
      console.error("로그아웃 실패:", err.response?.data?.message || err.message);
      toast.error("로그아웃 실패", { duration: 5000 });
    }
  };

  // 회원가입 핸들러
  const handleSignup = async (userData: any) => {
    try {
      const { id, name, email, password, role } = userData;
      setCurrentUser({ id, email, name });
      setIsLoggedIn(true);
      setIsAdmin(role === "ADMIN");

      // 자동 로그인 처리
      const loginResponse = await axios.post(
        `${getBackendUrl()}/api/accounts/login`,
        { email, password },
        { headers: { "Content-Type": "application/json" } }
      );
      const { accessToken, refreshToken, id: userId, name: userName, role: userRole } = loginResponse.data.data;
      localStorage.setItem("accessToken", accessToken);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("email", email);
      localStorage.setItem("nickname", userName);
      localStorage.setItem("role", userRole);
      setCurrentUser({ id: userId, email, name: userName });
      setIsAdmin(userRole === "ADMIN");

      // 수정: 회원가입 후 토큰 저장 확인
      toast.success("회원가입 및 로그인이 완료되었습니다", { duration: 5000 });
      router.push("/");
    } catch (err: any) {
      console.error("로그인 처리 실패:", err.response?.data?.message || err.message);
      toast.error("로그인 처리에 실패했습니다", { duration: 5000 });
    }
  };

  // 로그인 성공 핸들러
  const handleLoginSuccess = (
    loginData: {
      id: number;
      email: string;
      name: string;
      role: string;
      accessToken: string;
      refreshToken: string;
    }
  ) => {
    const { id, email, name, role, accessToken, refreshToken } = loginData;
    
    setCurrentUser({ id, email, name });
    setIsLoggedIn(true);
    setIsAdmin(role === "ADMIN");
    


    toast.success("로그인에 성공했습니다", { duration: 5000 });
    router.push("/");
  };

  return (
    <>
      <NavigationHeader
        currentPage={currentPage}
        onNavigate={(page) => router.push(`/${page === "home" ? "" : page}`)}
        onLogin={() => {
          setShowLoginModal(true);
        }}
        onLogout={handleLogout}
      />
      {showLoginModal && (
        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onSwitchToSignup={() => {
            setShowLoginModal(false);
            setShowSignupModal(true);
          }}
          onLoginSuccess={handleLoginSuccess}
        />
      )}
      {showSignupModal && (
        <SignupModal
          isOpen={showSignupModal}
          onClose={() => setShowSignupModal(false)}
          onSignup={handleSignup}
          onSwitchToLogin={() => {
            setShowSignupModal(false);
            setShowLoginModal(true);
          }}
        />
      )}
      {showPasswordRecovery && (
        <PasswordRecoveryModal
          onClose={() => setShowPasswordRecovery(false)}
          onRecover={(email) => {
            toast.success("비밀번호 복구 이메일이 전송되었습니다", { duration: 5000 });
            setShowPasswordRecovery(false);
          }}
        />
      )}
    </>
  );
}