"use client";

import dynamic from "next/dynamic";

const UserPanel = dynamic(
  () => import("@/components/layout/UserPanel").then((mod) => mod.UserPanel),
  { ssr: false }
);
const LoginModal = dynamic(
  () => import("@/components/auth/LoginModal").then((mod) => mod.LoginModal),
  { ssr: false }
);
const BackToTop = dynamic(
  () => import("@/components/layout/BackToTop").then((mod) => mod.BackToTop),
  { ssr: false }
);

export function ClientOverlays() {
  return (
    <>
      <UserPanel />
      <LoginModal />
      <BackToTop />
    </>
  );
}
