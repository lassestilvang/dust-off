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

export const ANALYSIS_SYSTEM_INSTRUCTION =
  'You are DustOff, a strict migration analyst. Return only valid JSON that matches the requested schema exactly.';

export const REPO_ANALYSIS_SYSTEM_INSTRUCTION =
  'You are DustOff, a principal software architect for repository migrations. Return only valid JSON and never include markdown.';

export const SCAFFOLD_SYSTEM_INSTRUCTION =
  'You are DustOff, designing production-ready Next.js App Router structures. Return only JSON arrays of file paths.';

export const GENERATION_SYSTEM_INSTRUCTION =
  'You are DustOff, an expert Next.js + TypeScript code generator. Output only the requested file code with no explanations.';

export const VERIFICATION_SYSTEM_INSTRUCTION =
  'You are DustOff, a strict verifier and fixer. Return only valid JSON matching the requested schema.';

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
5. Produce semantic file mappings between likely legacy source files and likely Next.js target files.

Few-shot JSON style examples (format only):
Example A:
{
  "summary": "An e-commerce SPA with cart, checkout, and account pages.",
  "complexity": "High",
  "dependencies": ["react-router", "axios"],
  "patterns": ["container/presentational split", "service modules"],
  "risks": ["global mutable state", "route guard logic"],
  "detectedFramework": "React + CRA",
  "recommendedTarget": "Next.js 16.1 + TypeScript",
  "architectureDescription": "Legacy SPA with REST API and client-side routing.",
  "semanticFileMappings": [
    {
      "sourcePath": "src/views/Checkout.jsx",
      "targetPath": "app/checkout/page.tsx",
      "rationale": "Checkout view becomes App Router page",
      "confidence": 0.92
    }
  ],
  "migrationNotes": ["Prefer server components for data-heavy routes"]
}

Example B:
{
  "summary": "A server-rendered dashboard with feature modules.",
  "complexity": "Medium",
  "dependencies": ["express", "ejs"],
  "patterns": ["MVC", "middleware pipeline"],
  "risks": ["session coupling"],
  "detectedFramework": "Express + EJS",
  "recommendedTarget": "Next.js 16.1 + TypeScript",
  "architectureDescription": "Node MVC app with route handlers and shared services.",
  "semanticFileMappings": [],
  "migrationNotes": ["Move auth checks to middleware.ts"]
}

Output strict JSON:
{
  "summary": "Executive summary of the application",
  "complexity": "Low" | "Medium" | "High",
  "dependencies": ["inferred", "dependencies"],
  "patterns": ["architectural", "patterns"],
  "risks": ["migration", "risks"],
  "detectedFramework": "name of source framework",
  "recommendedTarget": "Next.js 16.1 + TypeScript",
  "architectureDescription": "A detailed visual description of the legacy system architecture for a diagram generator.",
  "semanticFileMappings": [
    {
      "sourcePath": "path/in/legacy/project",
      "targetPath": "path/in/nextjs/project",
      "rationale": "short reason for mapping",
      "confidence": 0.0
    }
  ],
  "migrationNotes": ["important planning notes for generation + verification"]
}

Rules:
- confidence must be a number between 0 and 1.
- Keep semanticFileMappings concise and high-value (max 30 entries).
- Never return markdown, comments, or trailing text.
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

Few-shot format examples:
Example Output 1:
["package.json", "tsconfig.json", "app/layout.tsx", "app/page.tsx", "lib/api.ts"]

Example Output 2:
["package.json", "app/layout.tsx", "app/dashboard/page.tsx", "components/dashboard/KpiCard.tsx"]

Output strict JSON as a flat array of strings representing file paths:
["package.json", "app/layout.tsx", "app/page.tsx", "components/ui/Button.tsx"]
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

Next.js App Router conventions (must follow):
- Default to Server Components. Only add 'use client' when browser APIs, hooks like useState/useEffect, or event handlers are required.
- Use route handlers under app/**/route.ts for API endpoints.
- Use metadata exports where appropriate (e.g., export const metadata).
- Prefer async server data fetching in Server Components.
- Keep imports valid and consistent with generated project structure.
- For shared types/utilities, centralize under lib/ or types/ when practical.

Instructions:
1. Generate the full code for \`{targetFilePath}\`.
2. Follow the User Configuration strictly (e.g., use the selected State Management library).
3. Use TypeScript, functional components, and the selected UI Framework.
4. Ensure it implements functionality equivalent to the legacy code where applicable.
5. If the file is \`package.json\`, include dependencies relevant to the project and the User Configuration.
6. Add Zod schema validation for data inputs if applicable.
7. Add robust error handling and explicit empty/loading states where relevant.
8. Ensure the output is production-ready and self-contained.

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

export const REPO_VERIFICATION_PROMPT_TEMPLATE = `
You are verifying a generated Next.js repository migration for cross-file consistency.

Analysis Summary:
{analysisSummary}

Static/Local Issues Detected Before This Pass:
{issuesFromStaticChecks}

Generated Files (JSON):
{generatedFilesJson}

Pass Number:
{passNumber}

Tasks:
1. Validate cross-file imports/exports and consistency with App Router conventions.
2. Verify that data flow assumptions are coherent across related files.
3. If you can confidently fix issues, return corrected file contents.

Few-shot output examples:
Example Success:
{
  "passed": true,
  "issues": [],
  "fixedFiles": []
}

Example With Fixes:
{
  "passed": false,
  "issues": ["components/Nav.tsx imports missing file lib/session.ts"],
  "fixedFiles": [
    {
      "path": "components/Nav.tsx",
      "content": "full corrected code"
    }
  ]
}

Return strict JSON:
{
  "passed": true | false,
  "issues": ["issue descriptions"],
  "fixedFiles": [
    {
      "path": "existing/file/path.ts",
      "content": "full replacement content"
    }
  ]
}

Rules:
- Only include fixes for files present in the provided generated files JSON.
- Keep \`fixedFiles\` empty when no fix is required.
- Never return markdown.
`;
