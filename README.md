# DustOff 🚀

An intelligent, AI-powered tool designed to automate the migration of legacy codebases to modern frameworks (specifically Next.js + TypeScript). Built for the GitHub Copilot CLI Challenge.

## Features ✨

- **Deep Repository Analysis**: Scans GitHub repositories to understand structure, dependencies, and architecture.
- **Architecture Visualization**: Generates visual diagrams of legacy system architecture using Gemini 3.0 Pro Image (Nano Banana).
- **Automated Migration**: Converts legacy code (PHP, Vue, old React, etc.) into modern Next.js 16 (App Router) + TypeScript components using Gemini 3.0 Pro.
- **Project Scaffolding**: Automatically generates a full project structure including configuration files using Gemini 3.0 Flash.
- **Detailed Reports**: Provides a migration summary with modernization scores, test coverage estimates, and key improvements.
- **Zip Download**: Download the fully migrated project as a zip file, ready to run.

## Screenshots 📸

_Coming soon_

## Tech Stack 🛠️

- **Frontend**: React 19, Vite, Tailwind CSS, Bun
- **AI Models**: Google Gemini 3.0 Pro (Analysis) & Gemini 3.0 Flash (Code Gen)
- **Visualization**: Mermaid.js (via Gemini)
- **State Management**: React Context / Hooks

## Getting Started

### Prerequisites

- Bun (v1.0 or higher)
- A Google Gemini API Key (Get one [here](https://aistudio.google.com/))

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/lassestilvang/dust-off.git
   cd dust-off
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Set up environment variables:
   Create a `.env.local` file in the root directory and add your API key:

   ```env
   GEMINI_API_KEY=your_api_key_here
   ```

4. Run the development server:
   ```bash
   bun dev
   ```

The app will be available at `http://localhost:3000`.

## How to Use

1. Enter the GitHub URL of the repository you want to migrate.
2. Click "Analyze Repo" to start the scanning process.
3. Review the generated architecture diagram and analysis summary.
4. Click "Build Next.js App" to start the code generation.
5. Watch as files are generated in real-time in the file explorer.
6. Once complete, click "Download Project" to get your migrated codebase.

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for more details.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
