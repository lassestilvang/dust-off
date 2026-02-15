# Gemini Integration

DustOff leverages the cutting-edge capabilities of **Gemini 3 models** to function not just as a code generator, but as an intelligent, reasoning autonomous agent.

### Core Features Used

- **Reasoning with "Thinking Mode"**: We utilize `gemini-3-pro-preview` with configured **Thinking Budgets** (1024-2048 tokens) for complex cognitive tasks. This allows the system to deeply analyze repository structures, infer architectural patterns from file names, and plan a comprehensive migration strategy before writing a single line of code.
- **High-Speed Code Synthesis**: For the bulk generation of Next.js components, we deploy `gemini-3-flash-preview`. Its superior speed and expanded context window allow us to feed it large chunks of legacy source context, ensuring the new TypeScript code creates faithful reproductions of logic while adopting modern patterns.
- **Visual Architecture Generation**: Beyond text, we use `gemini-3-pro-image-preview` to visualize the legacy system. The agent reads the codebase and hallucinates a whiteboard-style architecture diagram, giving users an instant visual mental model of what is being migrated.
- **Self-Correction**: The "Verifier" agent uses Gemini 3 Pro to review its own output, checking for type safety and compilation errors, ensuring a higher success rate than standard "fire and forget" LLM coding.

By combining the reasoning depth of Pro for planning and the speed of Flash for execution, DustOff demonstrates a full-stack agentic workflow.
