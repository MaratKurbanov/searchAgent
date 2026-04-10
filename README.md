# Cloudflare AI Search - Chat Page

A clean, minimal React + Vite application featuring the Cloudflare AI Search chat interface using the `@cloudflare/ai-search-snippet` library.

## Features

- **Full-page Chat Interface** - Complete conversation experience with history
- **Dark/Light Mode** - Automatic theme detection
- **Clean UI** - Focused, distraction-free chat experience
- **JavaScript/JSX** - No TypeScript, simple and straightforward

## Project Setup

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173/`

### Build

Build for production:

```bash
npm run build
```

### Preview

Preview the production build:

```bash
npm run preview
```

## API Configuration

The app uses the Cloudflare AI Search endpoint:

```
https://acd9b9c4-3509-4687-a554-7705f3d55141.search.ai.cloudflare.com/
```

To change the endpoint, modify the `API_URL` constant in `src/App.jsx`.

## Project Structure

```
src/
├── App.jsx         # Main chat application
├── App.css         # Application styling
├── main.jsx        # React entry point
└── index.css       # Base styles

public/            # Static assets
dist/              # Production build (after npm run build)
```

## Technologies

- **React 19** - UI framework
- **Vite 5** - Fast build tool
- **JavaScript/JSX** - No TypeScript complexity
- **@cloudflare/ai-search-snippet** - AI search Web Component

## Component

Uses the `<chat-page-snippet>` Web Component from `@cloudflare/ai-search-snippet`:
- Full-page chat with conversation history
- Session management
- Sidebar for past conversations
- Responsive design

## Development Notes

- The Web Component is imported as a side-effect in `App.jsx`
- CSS variables handle theme switching (light/dark mode)
- Fully responsive and mobile-optimized
- Simple, minimal build configuration
