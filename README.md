# SuperchargedNotes

Transform your study materials into powerful learning tools with SuperchargedNotes - an AI-powered platform that converts handwritten notes into interactive study materials.

![SuperchargedNotes](public/note.png)

## Features

- **Intelligent Note Conversion**
  - Accurate handwriting recognition, even with messy handwriting
  - Preserves document structure (headings, lists, formatting)
  - Supports multiple input formats (PDF, JPG, PNG)
  - Converts to clean, formatted markdown

- **Study Material Generation**
  - Create interactive quizzes from your notes
  - Generate digital flashcards for spaced repetition
  - Automatic summary generation
  - Structured learning materials

- **Modern User Experience**
  - Clean, intuitive interface
  - Responsive design for all devices
  - Real-time conversion preview
  - Secure authentication with Clerk

## Tech Stack

- **Frontend**
  - Next.js 14
  - React
  - TypeScript
  - Tailwind CSS
  - Clerk Authentication

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/notestocards.git
cd notestocards
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Set up environment variables
Create a `.env.local` file in the root directory and add your Clerk credentials:
```env
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_publishable_key
CLERK_SECRET_KEY=your_secret_key
```

4. Run the development server
```bash
npm run dev
# or
yarn dev
```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. **Sign Up/Sign In**
   - Create an account or sign in using your preferred method
   - Access your personal dashboard

2. **Upload Notes**
   - Upload your handwritten or typed notes
   - Support for various formats (PDF, JPG, PNG)

3. **Convert and Study**
   - View your converted notes in clean markdown format
   - Generate quizzes and flashcards
   - Track your learning progress

## Project Structure

```
frontend/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── landing/     # Landing page components
│   │   └── ui/          # Reusable UI components
│   └── middleware.ts    # Authentication middleware
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 