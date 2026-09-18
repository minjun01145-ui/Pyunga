"use client";

import { useEffect } from "react";

const DEFAULT_MESSAGE = "저장하지 않은 변경사항이 있습니다. 저장하지 않고 이동하시겠습니까?";

export function useUnsavedChangesGuard(isDirty: boolean, message = DEFAULT_MESSAGE): void {
  useEffect(() => {
    if (!isDirty) return;

    let currentHistoryIndex = getNavigationHistoryIndex();
    let restoringHistory = false;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    function handleDocumentClick(event: MouseEvent) {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
        || !(event.target instanceof Element)
      ) {
        return;
      }

      const anchor = event.target.closest("a");
      if (!anchor || anchor.target === "_blank" || !anchor.href) return;
      const targetUrl = new URL(anchor.href, window.location.href);
      if (targetUrl.origin !== window.location.origin || targetUrl.href === window.location.href) return;
      if (window.confirm(message)) return;

      event.preventDefault();
      event.stopPropagation();
    }

    function handlePopState() {
      const nextHistoryIndex = getNavigationHistoryIndex();
      if (restoringHistory) {
        restoringHistory = false;
        currentHistoryIndex = nextHistoryIndex;
        return;
      }
      if (
        currentHistoryIndex === undefined
        || nextHistoryIndex === undefined
        || currentHistoryIndex === nextHistoryIndex
      ) {
        return;
      }
      if (window.confirm(message)) {
        currentHistoryIndex = nextHistoryIndex;
        return;
      }

      restoringHistory = true;
      window.history.go(currentHistoryIndex - nextHistoryIndex);
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("popstate", handlePopState);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("popstate", handlePopState);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [isDirty, message]);
}

type WindowWithNavigationHistory = Window & {
  navigation?: {
    currentEntry?: {
      index?: number;
    } | null;
  };
};

function getNavigationHistoryIndex(): number | undefined {
  const index = (window as WindowWithNavigationHistory).navigation?.currentEntry?.index;
  return typeof index === "number" && Number.isInteger(index) ? index : undefined;
}
