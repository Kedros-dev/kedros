import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    if (pathname.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/account", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" }
  }
);

export const config = {
  matcher: ["/account/:path*", "/admin/:path*"]
};
