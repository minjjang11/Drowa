"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Lang = "ko" | "en";

// UI string dictionary. Keep keys stable; add new strings here, both languages.
const DICT = {
  en: {
    // empty / hero
    emptyTitle: "Nothing here yet",
    emptyPrompt: "Ask AI to build something",
    promptPlaceholder: "Describe what you want to build…",
    askDev: "Ask about logic, structure, behavior.",
    askDesign: "Ask about color, layout, typography.",
    chatPlaceholder: "describe a change…",
    // toolbar
    deploy: "Deploy",
    deployTip: "Download a deployable site",
    export: "Export",
    exportTip: "Download App.tsx",
    invite: "Invite",
    inviteTip: "Invite a teammate",
    templatesTip: "Browse templates",
    inspirationTip: "AI inspiration & styles",
    designTip: "Design system",
    saveVersionTip: "Save current version",
    versionsTip: "Version history",
    filesTip: "Toggle file tree",
    pull: "Pull",
    pullTip: "Pull latest from GitHub",
    sync: "Sync",
    syncTip: "Push changes to GitHub",
    signOut: "Sign out",
    // status
    ready: "Ready",
    building: "Building…",
    error: "Error",
    // preview
    preview: "Preview",
    code: "Code",
    edit: "edit",
    editing: "editing",
    somethingWrong: "Something went wrong",
    fixAuto: "Fix automatically",
    dismiss: "Dismiss",
    // version / fix
    saveVersion: "Save version",
    versionHistory: "Version history",
    reviewFix: "Review the fix",
    apply: "Apply fix",
    cancel: "Cancel",
    restore: "Restore",
    // misc
    contextEdit: "Edit",
  },
  ko: {
    emptyTitle: "아직 비어 있어요",
    emptyPrompt: "AI에게 만들어달라고 해보세요",
    promptPlaceholder: "만들고 싶은 걸 설명해보세요…",
    askDev: "로직, 구조, 동작에 대해 물어보세요.",
    askDesign: "색상, 레이아웃, 타이포에 대해 물어보세요.",
    chatPlaceholder: "바꾸고 싶은 걸 적어보세요…",
    deploy: "배포",
    deployTip: "배포 가능한 사이트 다운로드",
    export: "내보내기",
    exportTip: "App.tsx 다운로드",
    invite: "초대",
    inviteTip: "팀원 초대",
    templatesTip: "템플릿 둘러보기",
    inspirationTip: "AI 영감 & 스타일",
    designTip: "디자인 시스템",
    saveVersionTip: "현재 버전 저장",
    versionsTip: "버전 기록",
    filesTip: "파일 트리 토글",
    pull: "가져오기",
    pullTip: "GitHub에서 최신 가져오기",
    sync: "올리기",
    syncTip: "GitHub에 변경사항 올리기",
    signOut: "로그아웃",
    ready: "준비됨",
    building: "만드는 중…",
    error: "오류",
    preview: "미리보기",
    code: "코드",
    edit: "편집",
    editing: "편집 중",
    somethingWrong: "문제가 발생했어요",
    fixAuto: "자동으로 고치기",
    dismiss: "닫기",
    saveVersion: "버전 저장",
    versionHistory: "버전 기록",
    reviewFix: "수정 내용 확인",
    apply: "적용하기",
    cancel: "취소",
    restore: "복구",
    contextEdit: "편집",
  },
} as const;

export type TKey = keyof typeof DICT["en"];

const I18nCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string }>({
  lang: "en",
  setLang: () => {},
  t: (k) => DICT.en[k],
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    const saved = localStorage.getItem("drowa-lang") as Lang | null;
    if (saved === "ko" || saved === "en") setLangState(saved);
    else setLangState(navigator.language?.toLowerCase().startsWith("ko") ? "ko" : "en");
  }, []);

  function setLang(l: Lang) {
    setLangState(l);
    localStorage.setItem("drowa-lang", l);
  }

  const t = (k: TKey) => DICT[lang][k] ?? DICT.en[k];
  return <I18nCtx.Provider value={{ lang, setLang, t }}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  return useContext(I18nCtx);
}
