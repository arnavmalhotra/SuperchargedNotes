"use client";

import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Navbar() {
    const pathname = usePathname();
    const isHomePage = pathname === "/";

    return (
        <>
        {isHomePage ? (
        <nav className="w-fit h-12 mx-auto sticky top-4 z-50">
            <div className="bg-blue-500 text-white rounded-full px-6 flex items-center justify-center h-full shadow-lg gap-2">
                <h1 className="text-l font-bold">SuperchargedNotes</h1>
                <SignedOut>
                    <div className="flex gap-2">
                        <SignInButton mode="modal">
                            <Button variant="ghost" className="text-white hover:bg-blue-600 rounded-full text-sm">
                                Sign In
                            </Button>
                        </SignInButton>
                        <SignUpButton mode="modal">
                            <Button className="bg-white text-blue-500 hover:bg-blue-50 rounded-full text-sm">
                                Sign Up
                            </Button>
                        </SignUpButton>
                    </div>
                </SignedOut>
                <SignedIn>
                    <div className="flex items-center gap-8 px-4">
                        <div className="flex items-center gap-6">
                            <Link 
                                href="/dashboard" 
                                className="text-sm text-white hover:text-blue-100 transition-colors"
                            >
                                Dashboard
                            </Link>
                        </div>
                        <UserButton 
                            appearance={{
                                elements: {
                                    avatarBox: "w-8 h-8"
                                }
                            }}
                        />
                    </div>
                </SignedIn>
            </div>
        </nav>
        ) : (
            <></>
        )}
        </>
    );
}