import { SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { motion } from 'framer-motion';

const CallToAction = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 }
    }
  };

  return (
    <section className="bg-gradient-to-b from-white to-blue-50 py-16 sm:py-24 lg:py-32 w-full">
      <motion.div 
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={containerVariants}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center"
      >
        <motion.h2 
          variants={itemVariants}
          className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-gray-900 max-w-3xl mx-auto"
        >
          Turn into the academic powerhouse you were meant to be
        </motion.h2>
        
        <motion.p 
          variants={itemVariants}
          className="mt-4 text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto"
        >
          Start improving your grades with SuperchargedNotes
        </motion.p>

        <motion.div 
          variants={itemVariants}
          className="mt-8 flex flex-col sm:flex-row justify-center gap-4 items-center"
        >
          <SignedOut>
            <div className="flex gap-4">
              <SignUpButton mode="modal">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button 
                    variant="default" 
                    className="bg-blue-600 text-white hover:bg-blue-500 rounded-full px-8 py-2 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                  >
                    Get Started
                  </Button>
                </motion.div>
              </SignUpButton>
              <SignInButton mode="modal">
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Button 
                    variant="outline" 
                    className="rounded-full px-8 py-2 text-lg font-medium border-2 hover:bg-gray-50 transition-all duration-300"
                  >
                    Sign In
                  </Button>
                </motion.div>
              </SignInButton>
            </div>
          </SignedOut>
          
          <SignedIn>
            <motion.div 
              whileHover={{ scale: 1.05 }} 
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-8 px-4"
            >
              <Button 
                variant="default" 
                className="bg-blue-600 text-white hover:bg-blue-500 rounded-full px-8 py-2 text-lg font-medium shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Link href="/dashboard">
                  Go to Dashboard
                </Link>
              </Button>
            </motion.div>
          </SignedIn>
        </motion.div>
      </motion.div>
    </section>
  );
};

export default CallToAction;
