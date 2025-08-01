# AIX: An Agnostic Intelligence Coalition Framework

> ⚠️ **Experimental Notice**  
> Prototype created in Google AI Studio via declarative prompts. This project has **not undergone systematic testing or fine-tuning**; extensive refinement is required before any production use.

## 🧱 Core Concepts

### 🏛️ The Protocol-Driven Coalition

AIX operates on a dynamic, protocol-driven architecture that allows the coalition of AI units to self-organize and adapt to any task. This is a departure from rigid, hardcoded workflows and enables true scalability and resilience.

The core cognitive loop follows this protocol:

1.  **Task Announcement:** When a request is received, the **`Comms Chief`** (the coalition's master strategist) broadcasts a "Task Announcement" to all Room Managers.
2.  **Bidding Phase:** Each **`Room Manager`** analyzes the announcement and, if its room's specialty is relevant, submits a "bid" back to the Comms Chief.
3.  **Dynamic Itinerary Creation:** The Comms Chief gathers all bids and dynamically constructs a unique, optimized **"itinerary"**—a tailored workflow sequence for that specific task.
4.  **Orchestrated Execution:** The Comms Chief executes the itinerary, activating the chosen rooms sequentially. It manages resource usage by differentiating between provider types: initiating a **"load-execute-unload"** cycle for local units to conserve system resources, and directly activating always-on cloud provider units via their APIs.
5.  **Hierarchical Action:** Within each activated room, the Manager directs its specialist units. They perform their analysis, enriching a shared **`Data Packet`** with layered metadata, before the Manager synthesizes the findings and signals completion to the Comms Chief.
6.  **Sanctioned Reporting:** The process culminates in the **`Sanctions Room`**, where the `Chief Arbiter` gives final authorization. If an action is required (e.g., running a script), it is performed first. The `Chat Responder` then reports the outcome to the user, delivering not just text but also any generated media like images.

### 🧠 Units

Units serve as modular cognitive agents. They:

- Bind to local Ollama, LM Studio, or cloud LLM providers with editable configurations.
- Adhere to a dual-activation protocol: local provider units await a 'load' command before executing, while cloud provider units are always-on and await direct API activation.
- Manage a **Training Vector Space** fed by uploaded documents (`PDF`, `DOCX`, `TXT`, `CSV`). Files are automatically parsed, chunked, and converted into "neurons," with a live-updated neuron count.
- Configure specific **embedding models** for each unit's Training Vector and for each RAG Base, with support for fetching models from local providers like LM Studio.
- Have their learning managed by a global **`RF Arbiter`**, which writes `Experience Neurons` (from user or system feedback) to their experience vector, ensuring a consistent learning protocol.
- Use **Data Packets** (`ImagePacket`, `AudioPacket`) for collaborative, layered analysis of rich media.
- Can produce rich media outputs, such as images from the **Visual Room**, that are rendered directly in the chat interface.
- Choose between **Standard DB** or **Scale DB** for memory storage.
- Can be configured as **Drive Units** with internal homeostatic loops.
- **Core Protection:** Units essential for framework operation cannot be deleted. Any newly created unit is automatically "indoctrinated" to follow the coalition protocol.

### 🤖 The RF Arbiter & Centralized Learning

To ensure consistent and standardized learning across the entire coalition, AIX employs a centralized reinforcement feedback (RF) mechanism managed by the **`RF Arbiter`** unit.

-   **Global Experience Engine:** The `RF Arbiter` acts as the single source of truth for learning. It is the only unit responsible for processing feedback and writing to the experience vectors of other units.
-   **Consistent Embedding:** It uses its own **globally configured embedding engine** to create `Experience Neurons` from all feedback (both user-provided and system-generated).
-   **Standardized Learning:** By embedding and distributing these neurons to all units that participated in a task, it guarantees that the coalition learns from a unified perspective, preventing fractured or contradictory learning patterns. This centralization is key to the coalition's long-term coherence and adaptive capability.


---

## 🚀 Key Features

| Feature                       | Description                                                                                                   |
|-------------------------------|---------------------------------------------------------------------------------------------------------------|
| Dynamic Workflow Protocol     | Self-organizing task execution via a bidding and itinerary protocol, making the system scalable and resilient.  |
| Centralized RF & Learning     | A global `RF Arbiter` processes all feedback, creating and embedding Experience Neurons for all units using a single, consistent engine. This standardizes the coalition's learning process. |
| In-Chat Media Generation      | Specialist rooms, like the Visual Room, can generate and display rich media like images directly in the chat.   |
| Hierarchical Command Structure| A clear chain of command from managers to specialists ensures deliberate, auditable action.                     |
| Resource-Conscious Execution  | Differentiates between local and cloud providers, using a "load/unload" cycle for local units to conserve resources and direct API activation for cloud units. |
| Layered Data Processing       | Structured `Data Packets` allow units to collaboratively enrich images and audio with metadata.               |
| Modular Coalitions            | Create, modify, and dissolve Rooms and Units at runtime. New units automatically integrate into the protocol. |
| Granular Model Control        | Assign distinct LLM and embedding models to each Unit from local (Ollama, LM Studio) or cloud providers.        |
| Training Vector Ingestion     | Upload documents (`PDF`, `DOCX`, `CSV`, `.txt`, `.md`) to a unit's Training Vector. Simple `.txt` files are ideal for quick topic training. |
| RAG Ecosystem                 | Information Room hosts RAG Units & Bases for vector-store retrieval and reranking.                            |
| Integrated Audio Pipeline     | Features push-to-talk, live input/output meters, and noise suppression. All audio processing is centralized to ensure settings are respected for both UI feedback and voice chat recording. |
| State Persistence             | All configurations and data stored locally for seamless experimentation.                                      |
| Rich UI Support               | Markdown, LaTeX, code blocks, file upload, provider dropdowns, and interactive feedback.                      |
| API & Webhook Support         | Expose a chat API endpoint and configure webhook callbacks for audio output.                                  |
| Core Unit Protection          | Units required for project operation cannot be removed.                                                        |


---
## ✨ Recent Architectural Updates

This version introduces several major architectural enhancements to move from a static system to a dynamic, protocol-driven AGI framework.

-   **Refined Activation Protocol:** Enhanced the core workflow to differentiate between `local` and `cloud` LLM providers. The system now correctly applies a resource-saving "load-execute-unload" cycle for local units (e.g., Ollama) and uses direct, always-on API activation for cloud units. This logic is now embedded in the `Comms Chief`'s orchestration and the `Coalition Manager`'s unit creation process.
-   **Dynamic Bidding Protocol:** Replaced the hardcoded, sequential workflow with a flexible bidding system. The `Comms Chief` now dynamically creates a custom "itinerary" for each task based on bids from relevant Room Managers. This makes the system robust and scalable.
-   **Centralized Reinforcement Feedback (RF):** Introduced the `RF Arbiter` as the Global Experience Embedding Engine. This unit centralizes all learning, processing feedback and writing `Experience Neurons` to all participating units using a single, consistent embedding model.
-   **Layered Data Packets:** Introduced `ImagePacket` and `AudioPacket` data structures. These packets are passed between units, allowing each specialist to add its own layer of analysis to the packet's metadata without overwriting others.
-   **In-Chat Media Previews:** The `Chat Responder` can now render AI-generated images directly within the chat window, providing immediate visual feedback for creative tasks.
-   **Protocol-Aware Unit Creation:** Ensured that any new unit created, whether manually or by the `Coalition Manager`, is automatically configured with a prompt that makes it compliant with the new hierarchical protocol.
-   **Advanced Vector Configuration:** Implemented a file ingestion system for Training Vectors, allowing documents like PDF, DOCX, CSV, and simple `.txt` files to be processed into neurons. Added granular control for selecting specific embedding models for training and RAG vectors, including fetching models from local providers.
-   **Robust Audio Pipeline & UI Stability:** Overhauled the entire audio processing system to use a single, centralized `AudioContext`. This ensures that features like push-to-talk, live volume meters, and noise suppression work reliably. Resolved a bug causing audio visualizations in the settings panel to freeze during re-renders, ensuring a smoother user experience.

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