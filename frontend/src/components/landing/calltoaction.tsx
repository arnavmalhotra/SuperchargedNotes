import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const CallToAction = () => {
  return (
    <section className="bg-white py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-gray-900 sm:text-4xl">
          Turn into the academic powerhouse you were meant to be
        </h2>
        <p className="mt-4 text-xl text-gray-500 max-w-2xl mx-auto">
            Start improving your grades with SuperchargedNotes
        </p>
        <div className="mt-8 flex justify-center gap-4">
          <SignedOut>
            <div className="flex gap-2">
              <SignUpButton mode="modal">
              <Button variant="default" className="bg-blue-600 text-white hover:bg-blue-500 rounded-full text-sm hover:text-black">
              Sign Up
                </Button>
              </SignUpButton>
            </div>
          </SignedOut>
          <SignedIn>
            <div className="flex items-center gap-8 px-4">
                <Button variant="default" className="bg-blue-100 text-blue-500 hover:bg-blue-300 rounded-full text-sm">
              <Link 
                href="/dashboard" 
                className="text-sm text-blue-500 hover:text-blue-600 transition-colors"
              >
                Dashboard
              </Link>
              </Button>
            </div>
          </SignedIn>
        </div>
      </div>
    </section>
  );
};

export default CallToAction;
