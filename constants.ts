export const DEFAULT_SOURCE_CODE = `// Example: Legacy jQuery to React Migration
$(document).ready(function() {
  var count = 0;
  
  $('#counter-btn').click(function() {
    count++;
    $('#count-display').text('Count: ' + count);
    
    if (count > 10) {
      $('#message').fadeIn();
    }
  });

  $('#reset-btn').on('click', function() {
    count = 0;
    $('#count-display').text('Count: 0');
    $('#message').hide();
  });
});`;

export const ANALYSIS_PROMPT_TEMPLATE = `
You are an expert Senior Software Architect specializing in legacy code migration.
Analyze the following source code written in {sourceLang}.
Identify the key logic, dependencies, state management patterns, and potential risks when migrating to {targetLang}.

Output strict JSON with this structure:
{
  "summary": "Brief executive summary of the code's purpose",
  "complexity": "Low" | "Medium" | "High",
  "dependencies": ["list", "of", "external", "libs"],
  "patterns": ["list", "of", "coding", "patterns", "identified"],
  "risks": ["list", "of", "potential", "migration", "risks"]
}
`;

export const REPO_ANALYSIS_PROMPT_TEMPLATE = `
You are a Principal Software Architect. You are analyzing a full repository file list and README to plan a migration.

Repository File Structure:
{fileList}

README Content:
{readme}

Your task:
1. Detect the primary source language/framework.
2. The target is ALWAYS "Next.js 16.1 (App Router) + TypeScript + Tailwind CSS".
3. Summarize the application architecture.
4. Create a prompt description for an architecture diagram representing the OLD legacy system.

Output strict JSON:
{
  "summary": "Executive summary of the application",
  "complexity": "Low" | "Medium" | "High",
  "dependencies": ["inferred", "dependencies"],
  "patterns": ["architectural", "patterns"],
  "risks": ["migration", "risks"],
  "detectedFramework": "name of source framework",
  "recommendedTarget": "Next.js 16.1 + TypeScript",
  "architectureDescription": "A detailed visual description of the legacy system architecture for a diagram generator."
}
`;

export const PROJECT_SCAFFOLD_PROMPT = `
You are a Lead Architect designing a modern Next.js 16.1 (App Router) project structure to replace a legacy application.

Legacy Application Context:
{analysisSummary}

Test Suite Requirement:
{testRequirement}

User Configuration:
{userConfig}

Task:
Design a clean, production-ready file structure for the new Next.js application.
Include standard files like \`package.json\`, \`tsconfig.json\`, \`app/layout.tsx\`, \`app/page.tsx\`, and any necessary components or lib utilities based on the likely needs of the legacy app.
Do not include node_modules or standard git files.

Output strict JSON as a flat array of strings representing file paths:
["package.json", "app/layout.tsx", "app/page.tsx", "components/ui/Button.tsx", ...]
`;

export const GENERATION_PROMPT_TEMPLATE = `
You are an expert Senior Full-Stack Engineer.
Your task is to generate the code for a specific file in a new Next.js 16.1 (App Router) project, migrating functionality from a legacy codebase.

Target File Path: {targetFilePath}

User Configuration:
{userConfig}

Legacy Code Context (Reference):
{sourceContext}

Related Files Context (Definitions/Exports from dependencies):
{relatedFilesContext}

Instructions:
1. Generate the full code for \`{targetFilePath}\`.
2. Follow the User Configuration strictly (e.g., use the selected State Management library).
3. Use TypeScript, functional components, and the selected UI Framework.
4. Ensure it implements functionality equivalent to the legacy code where applicable.
5. If the file is \`package.json\`, include dependencies relevant to the project and the User Configuration.
6. validation: Add Zod schema validation for any data inputs if applicable.
7. Error Handling: Add try/catch blocks and proper error states.

Output ONLY the code content. Do not use markdown blocks.
`;

export const CONVERSION_PROMPT_TEMPLATE = `
You are an autonomous coding agent.
Convert the following {sourceLang} code to modern, clean, production-ready {targetLang}.
Use the analysis provided below to guide your refactoring decisions.
Ensure the new code follows best practices for {targetLang} (e.g., Hooks for React, Type Safety for TypeScript).

Analysis:
{analysisJson}

Source Code:
{sourceCode}

Output ONLY the converted code. Do not include markdown fences like \`\`\` or explanations outside the code.
`;

export const VERIFICATION_PROMPT_TEMPLATE = `
You are a QA Engineer and Strict Code Reviewer.
Review the following {targetLang} code that was migrated from {sourceLang}.
Check for:
1. Syntax errors.
2. Logic equivalence to the original intent (inferred).
3. Best practices violations (e.g., any, unused vars, potential memory leaks).

If the code is good, return JSON: { "passed": true, "issues": [] }
If there are issues, fix the code and return JSON: { "passed": false, "issues": ["description of issue"], "fixedCode": "FULL_FIXED_CODE_HERE" }

Code to Verify:
{targetCode}
`;
