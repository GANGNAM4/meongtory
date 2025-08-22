"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
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
      const { accessToken } = response.data.data;
      localStorage.setItem("accessToken", accessToken);
      console.log("토큰 갱신 성공");
      return accessToken;
    } catch (err) {
      console.error("토큰 갱신 실패:", err);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("nickname");
      localStorage.removeItem("email");
      localStorage.removeItem("role");
      return null;
    }
  }, []);

  const checkLoginStatus = useCallback(async () => {
    if (isCheckingLogin || hasCheckedLogin.current || typeof window === "undefined") return;
    setIsCheckingLogin(true);
    try {
      const accessToken = localStorage.getItem("accessToken");
      if (!accessToken) return;

      const response = await axios.get(`${getBackendUrl()}/api/accounts/me`, {
        headers: { Access_Token: accessToken },
        timeout: 5000,
      });
      const { id, email, name, role } = response.data.data;

      // 상태 업데이트 최적화: 변경된 경우에만 set 호출
      if (!currentUser || currentUser.id !== id || currentUser.email !== email || currentUser.name !== name) {
        setCurrentUser({ id, email, name });
      }
      if (isAdmin !== (role === "ADMIN")) {
        setIsAdmin(role === "ADMIN");
      }
      if (!isLoggedIn) {
        setIsLoggedIn(true);
      }
      console.log("Initial login check successful:", { id, email, name, role });
      hasCheckedLogin.current = true; // 체크 완료 플래그 설정
    } catch (err: any) {
      console.error("사용자 정보 조회 실패:", err);
      if (err.response?.status === 401) {
        const newToken = await refreshAccessToken();
        if (newToken) {
          try {
            const response = await axios.get(`${getBackendUrl()}/api/accounts/me`, {
              headers: { Access_Token: newToken },
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
            console.log("Retry login check successful:", { id, email, name, role });
            hasCheckedLogin.current = true; // 체크 완료 플래그 설정
          } catch (retryErr) {
            console.error("재시도 실패:", retryErr);
            localStorage.removeItem("accessToken");
            localStorage.removeItem("refreshToken");
            setIsLoggedIn(false);
            setCurrentUser(null);
            setIsAdmin(false);
            hasCheckedLogin.current = true;
          }
        } else {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          setIsLoggedIn(false);
          setCurrentUser(null);
          setIsAdmin(false);
          hasCheckedLogin.current = true;
        }
      } else {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        setIsLoggedIn(false);
        setCurrentUser(null);
        setIsAdmin(false);
        hasCheckedLogin.current = true;
      }
    } finally {
      setIsCheckingLogin(false);
    }
  }, [isCheckingLogin, isLoggedIn, isAdmin, currentUser, refreshAccessToken]);

  useEffect(() => {
    if (!hasCheckedLogin.current) {
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

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <button onClick={() => onNavigate("home")} className="flex items-center space-x-2">
            <Image src="/KakaoTalk_20250729_160046076.png" alt="멍토리 로고" width={100} height={40} className="h-auto" />
          </button>
          <nav className="hidden md:flex items-center space-x-8">
            <button
              onClick={() => onNavigate("adoption")}
              className={`text-sm font-medium transition-colors ${
                currentPage === "adoption" ? "text-blue-600" : "text-gray-700 hover:text-blue-600"
              }`}
            >
              입양
            </button>
            <button
              onClick={() => onNavigate("insurance")}
              className={`text-sm font-medium transition-colors ${
                currentPage === "insurance" ? "text-blue-600" : "text-gray-700 hover:text-blue-600"
              }`}
            >
              펫보험
            </button>
            <button
              onClick={() => onNavigate("diary")}
              className={`text-sm font-medium transition-colors ${
                currentPage === "diary" ? "text-blue-600" : "text-gray-700 hover:text-blue-600"
              }`}
            >
              성장일기
            </button>
            <button
              onClick={() => onNavigate("community")}
              className={`text-sm font-medium transition-colors ${
                currentPage === "community" ? "text-blue-600" : "text-gray-700 hover:text-blue-600"
              }`}
            >
              커뮤니티
            </button>
            <button
              onClick={() => onNavigate("store")}
              className={`text-sm font-medium transition-colors ${
                currentPage === "store" ? "text-blue-600" : "text-gray-700 hover:text-blue-600"
              }`}
            >
              스토어
            </button>
            <button
              onClick={() => onNavigate("research")}
              className={`text-sm font-medium transition-colors ${
                currentPage === "research" ? "text-blue-600" : "text-gray-700 hover:text-blue-600"
              }`}
            >
              강아지 연구소
            </button>
            {isLoggedIn && (
              <button
                onClick={() => onNavigate("my")}
                className={`text-sm font-medium transition-colors ${
                  currentPage === "my" ? "text-blue-600" : "text-gray-700 hover:text-blue-600"
                }`}
              >
                마이페이지
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => onNavigate("admin")}
                className={`text-sm font-medium transition-colors ${
                  currentPage === "admin" ? "text-red-600" : "text-red-700 hover:text-red-600"
                }`}
              >
                관리자
              </button>
            )}
          </nav>
          <div className="flex items-center space-x-3">
            {isLoggedIn ? (
              <Button onClick={onLogout} variant="outline" size="sm" className="text-sm bg-transparent">
                로그아웃
              </Button>
            ) : (
              <Button onClick={() => { console.log("로그인 버튼 클릭"); onLogin(); }} variant="outline" size="sm" className="text-sm bg-transparent">
                <User className="w-4 h-4 mr-1" />
                로그인
              </Button>
            )}
          </div>
        </div>
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
      if (accessToken) {
        await axios.post(`${getBackendUrl()}/api/accounts/logout`,
          {},
          { headers: { "Content-Type": "application/json", "Access_Token": accessToken } }
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
      const response = await axios.post(`${getBackendUrl()}/api/accounts/register`,
        userData,
        { headers: { "Content-Type": "application/json" } }
      );
      const { id, email, name, role } = response.data.data;
      setCurrentUser({ id, email, name });
      setIsLoggedIn(true);
      setIsAdmin(role === "ADMIN");
      setShowSignupModal(false);
      toast.success("회원가입 및 로그인이 완료되었습니다", { duration: 5000 });
      router.push("/");
    } catch (err: any) {
      console.error("회원가입 실패:", err.response?.data?.message || err.message);
      toast.error("회원가입에 실패했습니다", { duration: 5000 });
    }
  };

  return (
    <>
      <NavigationHeader
        currentPage={currentPage}
        onNavigate={(page) => router.push(`/${page === "home" ? "" : page}`)}
        onLogin={() => {
          console.log("onLogin 호출됨");
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
          onLoginSuccess={() => {
            setShowLoginModal(false);
            checkLoginStatus();
          }}
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
            console.log("비밀번호 복구:", email);
            toast.success("비밀번호 복구 이메일이 전송되었습니다", { duration: 5000 });
            setShowPasswordRecovery(false);
          }}
        />
      )}
    </>
  );
}