import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Create a route matcher for paths that should be protected
const isProtectedRoute = createRouteMatcher([
  "/dashboard(.*)",
  "/forum(.*)",
  "/account(.*)",
  "/profile(.*)",
  "/settings(.*)",
  "/upload(.*)",
  "/calendar(.*)",
  "/chat(.*)",
  "/courses(.*)",
  "/onboarding(.*)",
]);

// Create a matcher for the home page
const isHomePage = createRouteMatcher(["/"]);

export default clerkMiddleware(async (auth, req) => {
  const { userId } = await auth();
  
  // Redirect unauthenticated users on protected routes to the home page
  if (!userId && isProtectedRoute(req)) {
    return NextResponse.redirect(new URL("/", req.url));
  }
  
  // If user is authenticated and on home page, redirect to dashboard
  if (userId && isHomePage(req)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  
  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
