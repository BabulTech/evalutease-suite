import { useEffect, useState } from "react";

function isMobile() {
  return typeof window !== "undefined" && window.innerWidth < 768;
}

export type PaginationState = {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
};

export function usePaginationState(
  mobileDefault = 10,
  desktopDefault = 25,
  initialPage = 0,
): PaginationState {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(() =>
    isMobile() ? mobileDefault : desktopDefault,
  );

  useEffect(() => {
    setPage(0);
  }, [pageSize]);

  return { page, pageSize, setPage, setPageSize };
}
