# AIX: An Agnostic AI Coalition Framework

AIX is not just another AI application; it is a **meta-framework** for architecting, managing, and interacting with bespoke coalitions of AI agents. It operates as a highly flexible and introspective environment, providing you with the foundational blueprint to build your own AGI-like system. Here, you are the architect—you define the structure, purpose, and interactions of every cognitive component.

**Disclaimer:** This is an experimental project and has not been thoroughly tested. Use it as a learning tool and a foundation for your own development.

## Getting Started

This project is a standard React/Vite application. The only requirement is a current version of Node.js and npm.

1.  **Clone the Repository**:
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```

2.  **Install Dependencies**:
    This single command installs all necessary libraries for the framework to run.
    ```bash
    npm install
    ```

3.  **Run the Development Server**:
    This command starts the local development server.
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:5173`.

### A Note on AI Models
The framework UI will run without any AI models connected. However, the *default configuration* of the units is pre-wired to use local AI services via **Ollama**. To use the framework 'out-of-the-box' with its initial setup, you will need Ollama running on your machine. You are free to change the providers for each unit to cloud-based services in the UI at any time.

## The Core Philosophy: A Canvas for Your Ideas

This project is fundamentally **agnostic by design**. Its core purpose is to be a blank canvas that can adapt to **any conceptual model or cognitive architecture you can envision**. Whether your goal is to build a hierarchical collective, a competitive ecosystem of agents, or a model based on esoteric psychology, AIX provides the tools to structure that vision.

## Your Framework, Your Vision

AIX is not a ready-to-use, polished application. It is a foundational framework intended to be a starting point. You are strongly encouraged to **fork this repository, edit the code, and develop the framework to suit your own unique concepts**. Change the units, redefine the rooms, and build the AI you want to see.

## Key Features

*   **Dynamic Coalition Structure**: Add, remove, and configure AI units on the fly.
*   **Hierarchical Management**: Rooms provide a logical separation of concerns.
*   **Deep Unit Configuration**: Fine-tune the LLM provider, model, prompts, and memory systems for each individual unit.
*   **Flexible RAG (Retrieval-Augmented Generation)**: Built-in support for RAG units, including client-side document ingestion (`.pdf`, `.docx`, `.txt`) and a choice of vector stores and rerankers (including a zero-configuration embedded model).
*   **Drive Units**: Special units that model the AGI's internal state (e.g., mood, motivation) to influence its behavior over time.
*   **Interactive Chat**: A rich chat interface with support for multi-modal file uploads, markdown (including code blocks and LaTeX math formulas), and reinforcement feedback.
*   **Extensible Tool System**: Create custom scripts that can be assigned to and used by any unit.
*   **State Persistence**: All configuration changes are automatically saved to your browser's Local Storage, so you can pick up right where you left off.

## Technical Stack & Libraries

AIX is built with a modern, professional development stack.

*   **Core Framework**:
    *   [React](https://react.dev/) with TypeScript for building the user interface.
    *   [Vite](https://vitejs.dev/) for a fast, modern development and build experience.

*   **UI & Styling**:
    *   [Tailwind CSS](https://tailwindcss.com/) for rapid, utility-first styling.

*   **Markdown & Code Rendering**:
    *   [react-markdown](https://github.com/remarkjs/react-markdown): To render chat messages.
    *   [remark-gfm](https://github.com/remarkjs/remark-gfm): For GitHub-flavored markdown.
    *   [remark-math](https://github.com/remarkjs/remark-math) & [rehype-katex](https://github.com/remarkjs/rehype-katex): For beautiful LaTeX math rendering.
    *   [react-syntax-highlighter](https://github.com/react-syntax-highlighter/react-syntax-highlighter): For themed code block highlighting.

*   **Client-Side Data Processing**:
    *   **RAG Document Ingestion**:
        *   [pdf.js](https://mozilla.github.io/pdf.js/): For in-browser PDF text extraction.
        *   [mammoth.js](https://github.com/mwilliamson/mammoth.js): For in-browser DOCX text extraction.
    *   **In-Browser AI Models**:
        *   [@xenova/transformers](https://github.com/xenova/transformers.js): Powers the zero-configuration "Embedded Reranker" that runs entirely in the browser.