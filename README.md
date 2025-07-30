# AIX: An Agnostic Intelligence Coalition Framework

> ⚠️ **Experimental Notice**  
> Prototype created in Google AI Studio via declarative prompts. This project has **not undergone systematic testing or fine-tuning**; extensive refinement is required before any production use.

## 🧱 Core Concepts

### 🏛️ Rooms & Coalition Logic

Rooms group Units by specialization and host a Manager Unit for lifecycle control. Coalitions form when Rooms cooperate, synchronized by the Communication Room.

#### Room Types

- **Admin Room**  
  - First entry point for user messages.  
  - Manager Unit forwards tasks to the Communication Room’s Manager.  
  - Includes a Unit for creating, editing, and deleting other Units.

- **Communication Room**  
  - Coordinates open/close loops and propagates directives across Rooms via its Manager Unit.  
  - Implements a stepping mechanism: the Admin Room’s manager can wake each coalition Unit in turn, collect its response, then return it to sleep.

- **Thought Room**  
  - Central reasoning hub; issues decisions that trigger actions in other Rooms.  
  - Hosts: Emotional Motor Units, a Self-Interest Unit with subordinate Ethics Unit, a Hypothesis Generator, and a Psychosocial Profile Unit (dreams, motivation, libido, personality traits, values, mood, user bio).

- **Information Room**  
  - Stores knowledge with paired RAG Units and RAG Bases.  
  - Hosts Digging Units to excavate deep insights from document neurons.  
  - Includes a System Profiler Unit to query and record host environment details.

- **Visual Room**  
  - Contains VLM and Stable Diffusion Units for stage-by-stage image interpretation and generation.

- **Voice Room**  
  - Performs layered analysis of incoming speech and layered audio synthesis.

- **Sanction Room**  
  - Enforces actions decided by the Thought Room.  
  - Contains:  
    - Desktop Control Unit (inspects GUI elements, background, object positions, current state, emojis)  
    - Sanction Units (apply and reapply penalties)  
    - Responder Unit (communicates results back to the user)  
    - Sanction Manager Unit

### 🧠 Units

Units serve as modular cognitive agents. They:

- Bind to local Ollama, Lmstudio, or cloud LLM providers with editable configurations.  
- Support **Prompt Templates** for custom instructions with dynamic variable injection.  
- Manage **Training Vectors** and **Experience Vectors** to evolve over time.  
- Choose between **Standard DB** or **Scalable DB** for memory storage.  
- Use **Todo Vectors** to handle long-running workflows without token-limit interruptions.  
- Add, remove, or reinforce document “neurons” on demand, inspired by mind-map memory.  
- Convertible into **Motor Units** with internal control loops.  
- **Provider Support:** Every vector store or database attached to a Unit can select from a dropdown of supported providers (local or cloud).  
- **Core Protection:** Units essential for framework operation cannot be deleted.

## 🚀 Key Features

| Feature                       | Description                                                                                                   |
|-------------------------------|---------------------------------------------------------------------------------------------------------------|
| Modular Coalitions            | Create, modify, and dissolve Rooms and Units at runtime                                                       |
| LLM Agnosticism               | Assign each Unit to local or cloud models with full configuration control                                     |
| Prompt Support                | Custom prompt templates per Unit with dynamic variable injection                                              |
| Mind-Map Memory               | Removable, editable neuron-style document memory                                                              |
| RAG Ecosystem                 | Information Room hosts RAG Units & Bases for vector-store retrieval and reranking                             |
| Data Excavation               | Digging Units mine deep knowledge from document neurons                                                       |
| System Profiling              | System Profiler Unit records host environment details                                                         |
| Visual Interpretation         | Stage-by-stage image analysis and generation via VLM and Stable Diffusion                                     |
| Audio Agents                  | Layered speech analysis and synthesis in the Voice Room                                                       |
| GUI Inspection                | Desktop Control Unit reads GUI and detects UI elements and emojis                                             |
| Enforcement Logic             | Sanction Units enact and reapply actions based on reasoning outputs                                           |
| Task Persistence              | Todo Vectors preserve task state across execution flows                                                       |
| Motorization                  | Units can become internal controllers with state-feedback loops                                               |
| Extensible Tooling            | Attach custom scripts and tools to any Unit                                                                   |
| Provider Selection            | Dropdown menus for vector-store and database providers in every Unit’s memory configuration                   |
| State Persistence             | All configurations and data stored locally for seamless experimentation                                       |
| Rich UI Support               | Markdown, LaTeX, code blocks, file upload, provider dropdowns, and interactive feedback                       |
| Core Unit Protection          | Units required for project operation cannot be removed                                                         |
| Settings Panel                | Microphone, audio volume, and theme options are available                                                      |
| API Output Configuration      | Configure framework API endpoints and payload formats                                                          |

---

## 🛠️ Tech Stack & Getting Started

- **Frontend:** React (TypeScript) + Vite + TailwindCSS  
- **LLM Integration:** Ollama for local inference, configurable Cloud APIs  
- **RAG Support:** pdf.js, mammoth.js, @xenova/transformers reranker  
- **UI Enhancements:** react-markdown, remark-gfm, rehype-katex, syntax highlighter  

### Setup

```bash
git clone https://github.com/tarikkaya/aix
cd aix && npm install
npm run dev  # → http://localhost:5173
