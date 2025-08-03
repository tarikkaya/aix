# AIX: An Agnostic Intelligence Coalition Framework

> ⚠️ **Experimental Notice**  
> Prototype created in Google AI Studio via declarative prompts. This project has **not undergone systematic testing or fine-tuning**; extensive refinement is required before any production use.

## 🧱 Core Concepts

### 🏛️ The Protocol-Driven Coalition

AIX operates on a deterministic, hierarchical protocol that simulates a structured cognitive process, ensuring every action is deliberate and traceable.

The core cognitive loop follows this strict protocol:

1.  **Input Reception & Sensory Analysis:** All user requests (text, images, or audio) are first received by the **`Admin Manager`**. If the input contains rich media, it's packaged and routed to the appropriate sensory room (`Visual` or `Sound`) for a deep, layered analysis by specialist units.
2.  **Cognitive Synthesis:** The request (now enriched with sensory data if applicable) is forwarded to the **`Thought Room`**. The `Lead Thinker` orchestrates a sequential consultation with its specialist units (e.g., `Ethical Governor`, `Hypothesis Generator`) to form a cohesive strategy and action plan.
3.  **Final Sanction & Execution:** The complete plan is sent to the **`Sanctions Room`**. The `Chief Arbiter` acts as the final authority, reviewing the plan for safety and alignment before sanctioning it. It then tasks the appropriate specialist (e.g., `Chat Responder`, `Image Generation Specialist`, `Text-to-Speech Synthesizer`) to execute the final action.
4.  **Unified Response:** The user receives a single, unified response from "AIX." The complex internal dialogue is hidden, presenting a seamless AGI experience. If the initial input was audio, the final response is also delivered as synthesized speech.

In addition to the primary cognitive loop, AIX includes a special **Diagnostic Protocol**. When a user issues a command like "run diagnostics," the `Admin Manager` activates the `System Test Unit`. This specialist unit methodically checks the configuration of every unit in the coalition, verifying that all providers and connections are correctly set. It then compiles a report, which is delivered to the user via the `Chat Responder`, providing a complete system health overview.


### 🧠 Units

Units serve as modular cognitive agents. They:

- Bind to local Ollama, LM Studio, or cloud LLM providers with editable configurations.
- Adhere to a dual-activation protocol: local provider units await a 'load' command before executing, while cloud provider units are always-on and await direct API activation.
- **Secure Cloud & Local Connections:** Connect to both cloud and local server providers using a **Centralized Connections Manager**. This eliminates redundant key/URL entry, enhances security, and improves usability.
- Manage a **Training Vector Space** fed by uploaded documents (`PDF`, `DOCX`, `TXT`, `CSV`). Files are automatically parsed, chunked, and semantically embedded using the framework's **Global Embedding Engine**.
- Have their learning managed by a global **`RF Arbiter`**, which writes `Experience Neurons` (from user or system feedback) to their experience vector, ensuring a consistent learning protocol.
- Use **Data Packets** (`ImagePacket`, `AudioPacket`) for collaborative, layered analysis of rich media.
- Can produce rich media outputs, such as images from the **Visual Room**, that are rendered directly in the chat interface.
- Choose between **Standard DB** or **Scale DB** for memory storage.
- Can be configured as **Drive Units** with internal homeostatic loops.
- **Core Protection:** Units essential for framework operation cannot be deleted. Any newly created unit is automatically "indoctrinated" to follow the coalition protocol.

### 🤖 The RF Arbiter & Centralized Learning

To ensure consistent and standardized learning across the entire coalition, AIX employs a centralized reinforcement feedback (RF) mechanism managed by the **`RF Arbiter`** unit.

-   **Global Experience Engine:** The `RF Arbiter` acts as the single source of truth for learning. It is the only unit responsible for processing feedback and writing to the experience vectors of other units.
-   **Rich Contextual Memory:** It creates `Experience Neuron`s that are rich with context. These neurons capture not just the text of a response, but also detailed metadata from **sensory analysis** (like image descriptions or word-level audio timestamps), precise ISO timestamps, and efficient **file references** to any associated media. This provides the AGI with a deep and comprehensive memory of its interactions.
-   **Consistent Embedding:** It uses the framework's single, **centrally configured Global Embedding Engine** to embed these rich, contextual neurons. By distributing them to all participating units, it guarantees that the coalition learns from a unified, detailed perspective, preventing fractured learning and enabling more advanced, context-aware adaptation.


---

## 🚀 Key Features

| Feature                       | Description                                                                                                   |
|-------------------------------|---------------------------------------------------------------------------------------------------------------|
| Hierarchical Workflow Protocol| A strict, sequential cognitive workflow (`Admin -> Thought -> Sanctions`) ensures deliberate, auditable action. |
| Centralized Embedding Engine  | A single, global engine handles all embedding tasks (training, RAG, experience) for framework-wide consistency. |
| Centralized RF & Learning     | A global `RF Arbiter` processes all feedback and embeds Experience Neurons for all units using the global engine. |
| Rich Contextual Memory        | `ExperienceNeuron`s store detailed sensory analysis, timestamps, and file references for a comprehensive learning record. |
| System-Wide Diagnostics       | A special protocol to check the configuration status of every unit in the coalition, reporting any issues.    |
| Collective Sensory Analysis   | Specialist rooms perform layered analysis on images and audio, enriching data with deep contextual metadata.    |
| Streamlined Audio I/O         | Full audio pipeline from mic input (with push-to-talk) to synthesized audio responses.                        |
| In-Chat Media Generation      | Specialist rooms, like the Visual Room, can generate and display rich media like images directly in the chat.   |
| Centralized Cloud Connections | Manage all cloud provider connections (LLMs, DBs) from a single, secure interface with provider-specific fields. |
| Centralized Local Provider Mgmt | Manage all local server URLs (Ollama, LM Studio) from a single interface with connection testing. |
| Enforced Provider Configuration| A critical check prevents the AI from responding if its core units are not properly configured.               |
| Modular Coalitions            | Create, modify, and dissolve Rooms and Units at runtime. New units automatically integrate into the protocol. |
| Granular Model Control        | Assign distinct LLM models to each Unit from local (Ollama, LM Studio) or cloud providers.        |
| Training Vector Ingestion     | Upload documents (`PDF`, `DOCX`, `CSV`, `.txt`, `.md`) to a unit's Training Vector.                             |
| RAG Ecosystem                 | Information Room hosts RAG Units & Bases for vector-store retrieval and reranking, powered by the global engine.|
| Integrated Audio Pipeline     | Stable, integrated audio pipeline with push-to-talk (with easy hotkey cancellation), live I/O meters, and robust noise suppression. |
| State Persistence             | All configurations and data stored locally for seamless experimentation.                                      |
| API & Webhook Support         | Expose a chat API endpoint and configure webhook callbacks for audio output.                                  |
| Core Unit Protection          | Units required for project operation cannot be removed.                                                        |


---
## ✨ Recent Architectural Updates

This version introduces several major architectural enhancements to move from a dynamic bidding system to a more structured, realistic AGI simulation.

-   **Enhanced Memory Architecture:** The AGI's learning foundation has been significantly upgraded. `ExperienceNeuron`s now store the complete context of an interaction, including detailed sensory analysis metadata (visual/audio), word-level timestamps, and efficient file references instead of full file content. This provides the AGI with a much richer and more contextual basis for learning.
-   **Centralized Provider Management:** Implemented a secure, central system for managing all **Cloud Connections** and **Local Provider Connections**. This removes redundant entry of API keys and URLs, enhances security, improves usability, and ensures data isolation between units. It includes connection testing for local servers.
-   **Centralized the Embedding Engine:** A major architectural refactor was performed to introduce a single, **Global Embedding Engine**. All unit-specific and RAG-base-specific embedding configurations have been removed. This new centralized engine, configurable in the main settings, now handles all semantic embedding tasks across the entire framework (training data, RAG, experience neurons), ensuring absolute consistency and simplifying management.
-   **Implemented a Strict Hierarchical Protocol:** Replaced the previous dynamic "bidding" system with a deterministic, sequential cognitive workflow (`Admin Room` -> `Thought Room` -> `Sanctions Room`). This enhances realism and simulates a more structured cognitive process. All unit prompts have been updated to reflect their specific roles within this new hierarchy.
-   **Refined User-Facing Chat:** The internal, step-by-step dialogue between AI units is no longer displayed in the chat window. The user now only sees the final, polished response from "AIX," creating a more believable and less cluttered AGI experience.
-   **Enforced Provider Configuration:** Added a critical validation step. The system now checks if core units are properly configured with LLM providers before attempting to process a request. If not, the process halts and a clear error message is displayed, ensuring the AI only operates when its logical foundation is intact.
-   **Collective Sensory Analysis:** The `Visual` and `Sound` rooms now perform a collective, layered analysis on incoming media. Specialist units are activated sequentially to enrich data packets with multiple layers of metadata (e.g., transcription plus sound classification), leading to a deeper contextual understanding.
-   **Streamlined Audio Responses:** Integrated a text-to-speech (TTS) pipeline. If a user's initial input is an audio file, the system's final, sanctioned response will be generated and played back as audio, creating a natural conversational loop.

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
```